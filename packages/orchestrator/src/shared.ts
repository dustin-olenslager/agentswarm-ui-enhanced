import { readFile } from "node:fs/promises";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger, getRecentCommits, getFileTree } from "@agentswarm/core";
import {
  AuthStorage,
  createAgentSession,
  createReadOnlyTools,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type { LLMConfig } from "./config.js";

const logger = createLogger("shared", "root-planner");

export interface RepoState {
  fileTree: string[];
  recentCommits: string[];
  featuresJson: string | null;
  specMd: string | null;
  agentsMd: string | null;
  decisionsMd: string | null;
}

export interface RawTaskInput {
  id?: string;
  description: string;
  scope?: string[];
  acceptance?: string;
  branch?: string;
  priority?: number;
}

const MAX_FILE_TREE_ENTRIES = 300;
const MAX_FEATURES_JSON_CHARS = 20_000;

export async function readRepoState(targetRepoPath: string): Promise<RepoState> {
  const cwd = targetRepoPath;

  let fileTree = await getFileTree(cwd);
  if (fileTree.length > MAX_FILE_TREE_ENTRIES) {
    const truncated = fileTree.length - MAX_FILE_TREE_ENTRIES;
    fileTree = [
      ...fileTree.slice(0, MAX_FILE_TREE_ENTRIES),
      `... (${truncated} more files)`,
    ];
  }

  const commits = await getRecentCommits(15, cwd);
  const recentCommits = commits.map((c) => `${c.hash.slice(0, 8)} ${c.message} (${c.author})`);

  let featuresJson: string | null = null;
  try {
    const raw = await readFile(join(cwd, "FEATURES.json"), "utf-8");
    featuresJson = raw.length > MAX_FEATURES_JSON_CHARS
      ? raw.slice(0, MAX_FEATURES_JSON_CHARS) + "\n... (truncated)"
      : raw;
  } catch {
    // FEATURES.json may not exist yet
  }

  const readOptionalFile = async (filename: string, maxChars: number): Promise<string | null> => {
    try {
      const raw = await readFile(join(cwd, filename), "utf-8");
      return raw.length > maxChars ? raw.slice(0, maxChars) + "\n... (truncated)" : raw;
    } catch {
      return null;
    }
  };

  const [specMd, agentsMd, decisionsMd] = await Promise.all([
    readOptionalFile("SPEC.md", 20_000),
    readOptionalFile("AGENTS.md", 10_000),
    readOptionalFile("DECISIONS.md", 10_000),
  ]);

  logger.debug("Repo state loaded", {
    fileTreeSize: fileTree.length,
    commitsCount: recentCommits.length,
    featuresJsonSize: featuresJson?.length ?? 0,
    specMdSize: specMd?.length ?? 0,
    agentsMdSize: agentsMd?.length ?? 0,
    decisionsMdSize: decisionsMd?.length ?? 0,
  });
  return { fileTree, recentCommits, featuresJson, specMd, agentsMd, decisionsMd };
}

/**
 * Counting semaphore for bounding concurrent async operations.
 * Replaces the old serial dispatchLock mutex.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private waitQueue: (() => void)[] = [];

  constructor(private readonly maxConcurrent: number) {
    if (maxConcurrent < 1) throw new Error("maxConcurrent must be >= 1");
  }

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  getActive(): number {
    return this.active;
  }

  getQueueLength(): number {
    return this.waitQueue.length;
  }
}

/**
 * Serializes local git operations to prevent index.lock contention
 * when multiple concurrent tasks touch the same repository.
 */
export class GitMutex extends ConcurrencyLimiter {
  constructor() {
    super(1);
  }

  isLocked(): boolean {
    return this.getActive() > 0;
  }
}

const BRANCH_SLUG_MAX_LENGTH = 50;

/**
 * Convert a task description into a branch-safe slug.
 * e.g. "Implement JWT token generation in src/auth" → "implement-jwt-token-generation-in-src-auth"
 */
export function slugifyForBranch(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")   // non-alphanumeric → hyphens
    .replace(/^-+|-+$/g, "")       // trim leading/trailing hyphens
    .replace(/-{2,}/g, "-")        // collapse consecutive hyphens
    .slice(0, BRANCH_SLUG_MAX_LENGTH)
    .replace(/-+$/, "");           // trim trailing hyphen after truncation
}

export function parseLLMTaskArray(content: string): RawTaskInput[] {
  let cleaned = content.trim();

  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    const lastBackticks = cleaned.lastIndexOf("```");
    if (firstNewline !== -1 && lastBackticks > firstNewline) {
      cleaned = cleaned.slice(firstNewline + 1, lastBackticks).trim();
    }
  }

  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error("LLM response is not an array");
    }
    logger.debug("Parsed LLM task array", { taskCount: parsed.length, contentLength: content.length });
    return parsed;
  } catch (error) {
    logger.error("Failed to parse LLM response as tasks", {
      content: content.slice(0, 500),
    });
    throw new Error(
      `Failed to parse LLM task decomposition: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface PiSessionOptions {
  systemPrompt: string;
  targetRepoPath: string;
  llmConfig: LLMConfig;
}

export interface PiSessionResult {
  session: AgentSession;
  tempDir: string;
}

function registerPiModel(llmConfig: LLMConfig) {
  const authStorage = new AuthStorage();
  const modelRegistry = new ModelRegistry(authStorage);

  // Pi doesn't support multi-endpoint; take the first one.
  const endpoint = llmConfig.endpoints[0];

  modelRegistry.registerProvider("agentswarm", {
    baseUrl: endpoint.endpoint + "/v1",
    apiKey: endpoint.apiKey || "no-key-needed",
    api: "openai-completions",
    models: [{
      id: llmConfig.model,
      name: llmConfig.model,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 131072,
      maxTokens: llmConfig.maxTokens,
      compat: {
        maxTokensField: "max_tokens",
        supportsUsageInStreaming: true,
      },
    }],
  });

  const model = modelRegistry.find("agentswarm", llmConfig.model);
  if (!model) {
    throw new Error(`Model "${llmConfig.model}" not found in registry after registration`);
  }

  return { model, authStorage, modelRegistry };
}

export async function createPlannerPiSession(options: PiSessionOptions): Promise<PiSessionResult> {
  const { systemPrompt, targetRepoPath, llmConfig } = options;

  const tempDir = mkdtempSync(join(tmpdir(), "agentswarm-planner-"));
  logger.debug("Creating Pi session", {
    tempDir,
    modelName: llmConfig.model,
    endpoint: llmConfig.endpoints[0]?.name,
    maxTokens: llmConfig.maxTokens,
    temperature: llmConfig.temperature,
    targetRepoPath,
  });
  writeFileSync(join(tempDir, "AGENTS.md"), systemPrompt, "utf-8");

  const { model, authStorage, modelRegistry } = registerPiModel(llmConfig);

  const { session } = await createAgentSession({
    cwd: tempDir,
    model,
    tools: createReadOnlyTools(targetRepoPath),
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory(),
    thinkingLevel: "off",
  });

  return { session, tempDir };
}

export function cleanupPiSession(session: AgentSession, tempDir: string): void {
  session.dispose();
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}
