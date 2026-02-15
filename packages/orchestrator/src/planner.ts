import type { Task, Handoff } from "@agentswarm/core";
import { createLogger } from "@agentswarm/core";
import type { OrchestratorConfig } from "./config.js";
import type { TaskQueue } from "./task-queue.js";
import type { WorkerPool } from "./worker-pool.js";
import type { MergeQueue } from "./merge-queue.js";
import type { Monitor } from "./monitor.js";
import { LLMClient, type LLMMessage } from "./llm-client.js";
import { type RepoState, type RawTaskInput, readRepoState, parseLLMTaskArray, ConcurrencyLimiter } from "./shared.js";

const logger = createLogger("planner", "root-planner");

const LOOP_SLEEP_MS = 500;

/**
 * Minimum handoffs received since the last plan before triggering a replan.
 * Kept low (3) so the planner can adapt quickly as early tasks in a batch
 * complete — the planner prompt now controls batch sizing dynamically
 * rather than relying on this constant to throttle planning frequency.
 */
const MIN_HANDOFFS_FOR_REPLAN = 3;

const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 30_000;
const MAX_CONSECUTIVE_ERRORS = 10;

/**
 * Context management constants.
 * ~100K tokens ≈ 400K chars. Leave headroom for the LLM response.
 */
const CONTEXT_CHAR_LIMIT = 400_000;

/** Keep the last N messages intact when compacting (3 user+assistant exchanges). */
const RECENT_MESSAGES_TO_KEEP = 6;

export interface PlannerConfig {
  maxIterations: number;
}

export class Planner {
  private config: OrchestratorConfig;
  private plannerConfig: PlannerConfig;
  private llmClient: LLMClient;
  private taskQueue: TaskQueue;
  private workerPool: WorkerPool;
  private mergeQueue: MergeQueue;
  private monitor: Monitor;
  private systemPrompt: string;
  private targetRepoPath: string;

  private running: boolean;
  private taskCounter: number;
  private dispatchLimiter: ConcurrencyLimiter;

  private pendingHandoffs: { task: Task; handoff: Handoff }[];
  private allHandoffs: Handoff[];
  private handoffsSinceLastPlan: Handoff[];
  private activeTasks: Set<string>;

  /** Persistent conversation history — the core of the continuous planner. */
  private conversationHistory: LLMMessage[];

  /** Scratchpad: rewritten (not appended) each iteration by the planner LLM. */
  private scratchpad: string;

  private taskCreatedCallbacks: ((task: Task) => void)[];
  private taskCompletedCallbacks: ((task: Task, handoff: Handoff) => void)[];
  private iterationCompleteCallbacks: ((iteration: number, tasks: Task[], handoffs: Handoff[]) => void)[];
  private errorCallbacks: ((error: Error) => void)[];

  constructor(
    config: OrchestratorConfig,
    plannerConfig: PlannerConfig,
    taskQueue: TaskQueue,
    workerPool: WorkerPool,
    mergeQueue: MergeQueue,
    monitor: Monitor,
    systemPrompt: string,
  ) {
    this.config = config;
    this.plannerConfig = plannerConfig;
    this.taskQueue = taskQueue;
    this.workerPool = workerPool;
    this.mergeQueue = mergeQueue;
    this.monitor = monitor;
    this.systemPrompt = systemPrompt;
    this.targetRepoPath = config.targetRepoPath;

    this.running = false;
    this.taskCounter = 0;
    this.dispatchLimiter = new ConcurrencyLimiter(config.maxWorkers);

    this.pendingHandoffs = [];
    this.allHandoffs = [];
    this.handoffsSinceLastPlan = [];
    this.activeTasks = new Set();

    this.conversationHistory = [];
    this.scratchpad = "";

    this.llmClient = new LLMClient({
      endpoints: config.llm.endpoints,
      model: config.llm.model,
      maxTokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
      timeoutMs: config.llm.timeoutMs,
    });

    this.taskCreatedCallbacks = [];
    this.taskCompletedCallbacks = [];
    this.iterationCompleteCallbacks = [];
    this.errorCallbacks = [];
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  async runLoop(request: string): Promise<void> {
    this.running = true;
    logger.info("Starting streaming planner loop", { request: request.slice(0, 200) });

    if (this.config.readinessTimeoutMs > 0) {
      await this.llmClient.waitForReady({
        maxWaitMs: this.config.readinessTimeoutMs,
        pollIntervalMs: 5_000,
      });
    }

    let iteration = 0;
    let planningDone = false;
    let consecutiveErrors = 0;

    while (this.running && iteration < this.plannerConfig.maxIterations) {
      try {
        this.collectCompletedHandoffs();

        const hasCapacity = this.dispatchLimiter.getActive() < this.config.maxWorkers;
        const hasEnoughHandoffs = this.handoffsSinceLastPlan.length >= MIN_HANDOFFS_FOR_REPLAN;
        const noActiveWork = this.activeTasks.size === 0 && iteration > 0;
        const needsPlan = hasCapacity && (iteration === 0 || hasEnoughHandoffs || noActiveWork);

        if (needsPlan && !planningDone) {
          logger.info(`Planning iteration ${iteration + 1}`, {
            activeWorkers: this.dispatchLimiter.getActive(),
            handoffsSinceLastPlan: this.handoffsSinceLastPlan.length,
            conversationLength: this.conversationHistory.length,
          });

          const repoState = await this.readRepoState();

          const newHandoffs = [...this.handoffsSinceLastPlan];
          const tasks = await this.plan(request, repoState, newHandoffs);

          iteration++;
          consecutiveErrors = 0;
          this.handoffsSinceLastPlan = [];

          if (tasks.length === 0 && this.activeTasks.size === 0) {
            logger.info("No more tasks to create and no active work. Planning complete.");
            planningDone = true;
          } else if (tasks.length > 0) {
            logger.info(`Created ${tasks.length} tasks for iteration ${iteration}`);
            this.dispatchTasks(tasks);

            for (const cb of this.iterationCompleteCallbacks) {
              cb(iteration, tasks, newHandoffs);
            }
          }
        }

        if (planningDone && this.activeTasks.size === 0) {
          break;
        }

        await sleep(LOOP_SLEEP_MS);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        consecutiveErrors++;

        const backoffMs = Math.min(
          BACKOFF_BASE_MS * Math.pow(2, consecutiveErrors - 1),
          BACKOFF_MAX_MS,
        );

        logger.error(`Planning failed (attempt ${consecutiveErrors}), retrying in ${(backoffMs / 1000).toFixed(0)}s`, {
          error: err.message,
          consecutiveErrors,
        });

        for (const cb of this.errorCallbacks) {
          cb(err);
        }

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          logger.error(`Aborting after ${MAX_CONSECUTIVE_ERRORS} consecutive planning failures`);
          break;
        }

        await sleep(backoffMs);
      }
    }

    if (this.activeTasks.size > 0) {
      logger.info("Waiting for remaining active tasks", { count: this.activeTasks.size });
      while (this.activeTasks.size > 0 && this.running) {
        this.collectCompletedHandoffs();
        await sleep(LOOP_SLEEP_MS);
      }
    }

    this.running = false;
    logger.info("Planner loop finished", { iterations: iteration, totalHandoffs: this.allHandoffs.length });
  }

  stop(): void {
    this.running = false;
    logger.info("Planner stop requested");
  }

  isRunning(): boolean {
    return this.running;
  }

  // ---------------------------------------------------------------------------
  // Continuous conversation planning
  // ---------------------------------------------------------------------------

  async readRepoState(): Promise<RepoState> {
    return readRepoState(this.targetRepoPath);
  }

  /**
   * Continuous conversation planner.
   *
   * First call:  system prompt + initial request + repo state → stored in history.
   * Subsequent:  incremental handoffs + fresh repo state appended as follow-up message.
   *
   * The LLM returns a JSON object: { scratchpad: string, tasks: Task[] }.
   * Scratchpad is rewritten each call — never appended.
   */
  async plan(request: string, repoState: RepoState, newHandoffs: Handoff[]): Promise<Task[]> {
    const isFirstPlan = this.conversationHistory.length === 0;
    const historySnapshot = [...this.conversationHistory];

    if (isFirstPlan) {
      const userMessage = this.buildInitialMessage(request, repoState);
      this.conversationHistory = [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: userMessage },
      ];
    } else {
      const followUp = this.buildFollowUpMessage(repoState, newHandoffs);
      this.conversationHistory.push({ role: "user", content: followUp });
    }

    this.manageContext();

    logger.info("Calling LLM for task decomposition", {
      isFirstPlan,
      historyMessages: this.conversationHistory.length,
      newHandoffs: newHandoffs.length,
    });

    try {
      let response = await this.llmClient.complete(this.conversationHistory);
      this.monitor.recordTokenUsage(response.usage.totalTokens);

      if (response.finishReason === "length") {
        logger.warn("LLM response truncated (finish_reason=length), requesting continuation", {
          completionTokens: response.usage.completionTokens,
        });

        this.conversationHistory.push({ role: "assistant", content: response.content });
        this.conversationHistory.push({
          role: "user",
          content: "Your response was truncated. Continue EXACTLY from where you left off — output only the remaining JSON. Do not restart or repeat.",
        });

        const continuation = await this.llmClient.complete(this.conversationHistory);
        this.monitor.recordTokenUsage(continuation.usage.totalTokens);

        this.conversationHistory.pop();
        this.conversationHistory.pop();

        response = {
          ...continuation,
          content: response.content + continuation.content,
          usage: {
            promptTokens: response.usage.promptTokens + continuation.usage.promptTokens,
            completionTokens: response.usage.completionTokens + continuation.usage.completionTokens,
            totalTokens: response.usage.totalTokens + continuation.usage.totalTokens,
          },
        };

        logger.info("Merged continuation response", {
          totalLength: response.content.length,
          continuationFinishReason: continuation.finishReason,
        });
      }

      this.conversationHistory.push({ role: "assistant", content: response.content });

      const { scratchpad, tasks: rawTasks } = this.parsePlannerResponse(response.content);
      if (scratchpad) {
        this.scratchpad = scratchpad;
      }

      const tasks: Task[] = rawTasks.map((raw) => {
        this.taskCounter++;
        const id = raw.id || `task-${String(this.taskCounter).padStart(3, "0")}`;
        return {
          id,
          description: raw.description,
          scope: raw.scope || [],
          acceptance: raw.acceptance || "",
          branch: raw.branch || `${this.config.git.branchPrefix}${id}`,
          status: "pending" as const,
          createdAt: Date.now(),
          priority: raw.priority || 5,
        };
      });

      return tasks;
    } catch (err) {
      this.conversationHistory = historySnapshot;
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Message builders
  // ---------------------------------------------------------------------------

  private buildInitialMessage(request: string, repoState: RepoState): string {
    let msg = `## Request\n${request}\n\n`;
    msg += `## Repository File Tree\n${repoState.fileTree.join("\n")}\n\n`;
    msg += `## Recent Commits\n${repoState.recentCommits.join("\n")}\n\n`;

    if (repoState.featuresJson) {
      msg += `## FEATURES.json\n${repoState.featuresJson}\n\n`;
    }

    msg += `This is the initial planning call. Produce your first batch of tasks and your scratchpad.\n`;
    return msg;
  }

  private buildFollowUpMessage(repoState: RepoState, newHandoffs: Handoff[]): string {
    let msg = `## Updated Repository State\n`;
    msg += `File tree:\n${repoState.fileTree.join("\n")}\n\n`;
    msg += `Recent commits:\n${repoState.recentCommits.join("\n")}\n\n`;

    if (repoState.featuresJson) {
      msg += `## FEATURES.json\n${repoState.featuresJson}\n\n`;
    }

    if (newHandoffs.length > 0) {
      msg += `## New Worker Handoffs (${newHandoffs.length} since last plan)\n`;
      for (const h of newHandoffs) {
        msg += `### Task ${h.taskId} — ${h.status}\n`;
        msg += `Summary: ${h.summary}\n`;
        msg += `Files changed: ${h.filesChanged.join(", ")}\n`;
        if (h.concerns.length > 0) msg += `Concerns: ${h.concerns.join("; ")}\n`;
        if (h.suggestions.length > 0) msg += `Suggestions: ${h.suggestions.join("; ")}\n`;
        msg += `\n`;
      }
    }

    if (this.scratchpad) {
      msg += `## Your Previous Scratchpad\n${this.scratchpad}\n\n`;
    }

    msg += `Continue planning. Review the new handoffs and current state. Rewrite your scratchpad and emit the next batch of tasks.\n`;
    return msg;
  }

  // ---------------------------------------------------------------------------
  // Response parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse the planner response. Accepts two formats:
   *
   * 1. Structured: { "scratchpad": "...", "tasks": [...] }
   * 2. Legacy fallback: plain JSON array of tasks (no scratchpad)
   *
   * If the JSON is truncated (e.g. max_tokens hit), attempts to salvage
   * any complete task objects from the partial response.
   */
  private parsePlannerResponse(content: string): { scratchpad: string; tasks: RawTaskInput[] } {
    // Try structured JSON object first.
    try {
      let cleaned = content.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
      }

      // Find the outermost { ... } if there's surrounding text.
      const objStart = cleaned.indexOf("{");
      const objEnd = cleaned.lastIndexOf("}");
      if (objStart !== -1 && objEnd > objStart) {
        const candidate = cleaned.slice(objStart, objEnd + 1);
        const parsed = JSON.parse(candidate);

        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.tasks)) {
          return {
            scratchpad: typeof parsed.scratchpad === "string" ? parsed.scratchpad : "",
            tasks: parsed.tasks,
          };
        }
      }
    } catch {
      // JSON parse failed — may be truncated. Try salvage before legacy fallback.
      const salvaged = this.salvageTruncatedResponse(content);
      if (salvaged.tasks.length > 0) {
        logger.warn("Salvaged tasks from truncated LLM response", {
          tasksRecovered: salvaged.tasks.length,
          contentLength: content.length,
        });
        return salvaged;
      }
    }

    // Fallback: plain JSON task array (backward compatible with subplanner/reconciler format).
    try {
      const tasks = parseLLMTaskArray(content);
      return { scratchpad: "", tasks };
    } catch {
      logger.warn("Failed to parse planner response", { contentPreview: content.slice(0, 300) });
      return { scratchpad: "", tasks: [] };
    }
  }

  /**
   * Attempt to recover complete task objects from a truncated JSON response.
   *
   * Strategy: find all complete JSON objects within the "tasks" array by
   * matching balanced braces. Each task that parses successfully is kept.
   */
  private salvageTruncatedResponse(content: string): { scratchpad: string; tasks: RawTaskInput[] } {
    let scratchpad = "";
    const tasks: RawTaskInput[] = [];

    // Try to extract scratchpad from partial JSON.
    const scratchpadMatch = content.match(/"scratchpad"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (scratchpadMatch) {
      try {
        scratchpad = JSON.parse(`"${scratchpadMatch[1]}"`);
      } catch {
        scratchpad = scratchpadMatch[1];
      }
    }

    // Find the "tasks" array start.
    const tasksKeyMatch = content.match(/"tasks"\s*:\s*\[/);
    if (!tasksKeyMatch || tasksKeyMatch.index === undefined) {
      return { scratchpad, tasks };
    }

    const tasksArrayStart = tasksKeyMatch.index + tasksKeyMatch[0].length;
    const remainder = content.slice(tasksArrayStart);

    // Extract individual task objects by tracking brace depth.
    let depth = 0;
    let objStart = -1;

    for (let i = 0; i < remainder.length; i++) {
      const ch = remainder[i];

      // Skip strings to avoid counting braces inside string values.
      if (ch === '"') {
        i++;
        while (i < remainder.length) {
          if (remainder[i] === '\\') {
            i++; // skip escaped character
          } else if (remainder[i] === '"') {
            break;
          }
          i++;
        }
        continue;
      }

      if (ch === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && objStart !== -1) {
          const objStr = remainder.slice(objStart, i + 1);
          try {
            const task = JSON.parse(objStr) as RawTaskInput;
            if (task.description) {
              tasks.push(task);
            }
          } catch {
            // Malformed task object — skip it.
          }
          objStart = -1;
        }
      }
    }

    return { scratchpad, tasks };
  }

  // ---------------------------------------------------------------------------
  // Context management (compaction)
  // ---------------------------------------------------------------------------

  /**
   * When conversation history approaches the context limit, compact older
   * exchanges into a summary message while keeping system + initial + recent.
   *
   * Strategy: keep system[0], initial user[1], initial assistant[2], then
   * summarize middle exchanges, and keep the most recent N messages intact.
   */
  private manageContext(): void {
    const totalChars = this.conversationHistory.reduce((sum, m) => sum + m.content.length, 0);

    if (totalChars <= CONTEXT_CHAR_LIMIT) return;

    logger.info("Context limit approaching, compacting older messages", {
      totalChars,
      limit: CONTEXT_CHAR_LIMIT,
      messageCount: this.conversationHistory.length,
    });

    // Need at least: system + initial user + initial assistant + summary + recent messages
    if (this.conversationHistory.length <= 3 + RECENT_MESSAGES_TO_KEEP) return;

    const system = this.conversationHistory[0];
    const initialUser = this.conversationHistory[1];
    const initialAssistant = this.conversationHistory[2];

    const middleStart = 3;
    const middleEnd = this.conversationHistory.length - RECENT_MESSAGES_TO_KEEP;

    if (middleEnd <= middleStart) return;

    const middleMessages = this.conversationHistory.slice(middleStart, middleEnd);

    // Build compact summary — extract signal, drop verbose content.
    const summaryParts: string[] = [];
    let handoffsDelivered = 0;
    let tasksGenerated = 0;

    for (const msg of middleMessages) {
      if (msg.role === "user") {
        const handoffMatch = msg.content.match(/New Worker Handoffs \((\d+)/);
        if (handoffMatch) {
          handoffsDelivered += parseInt(handoffMatch[1], 10);
        }
      } else if (msg.role === "assistant") {
        const taskIdMatches = msg.content.match(/"id"\s*:/g);
        if (taskIdMatches) {
          tasksGenerated += taskIdMatches.length;
        }
      }
    }

    summaryParts.push(`Compacted ${middleMessages.length} earlier messages.`);
    summaryParts.push(`~${handoffsDelivered} handoffs delivered, ~${tasksGenerated} tasks generated in compacted range.`);
    if (this.scratchpad) {
      summaryParts.push(`Current scratchpad has the latest synthesized state.`);
    }

    const summaryMessage: LLMMessage = {
      role: "user",
      content: `[CONTEXT COMPACTION]\n${summaryParts.join("\n")}`,
    };

    const recentMessages = this.conversationHistory.slice(middleEnd);

    this.conversationHistory = [
      system,
      initialUser,
      initialAssistant,
      summaryMessage,
      ...recentMessages,
    ];

    const newTotalChars = this.conversationHistory.reduce((sum, m) => sum + m.content.length, 0);
    logger.info("Context compacted", {
      removedMessages: middleMessages.length,
      oldChars: totalChars,
      newChars: newTotalChars,
      messageCount: this.conversationHistory.length,
    });
  }

  // ---------------------------------------------------------------------------
  // Task dispatch
  // ---------------------------------------------------------------------------

  private dispatchTasks(tasks: Task[]): void {
    for (const task of tasks) {
      this.taskQueue.enqueue(task);
      for (const cb of this.taskCreatedCallbacks) {
        cb(task);
      }

      this.activeTasks.add(task.id);
      this.dispatchSingleTask(task);
    }
  }

  /** Fire-and-forget: dispatches task to a worker, pushes result to pendingHandoffs on completion. */
  private dispatchSingleTask(task: Task): void {
    const promise = (async () => {
      await this.dispatchLimiter.acquire();

      // No local branch creation — branches are created inside sandboxes
      // and pushed to remote. Merge queue fetches from origin.

      this.taskQueue.assignTask(task.id, `ephemeral-${task.id}`);
      this.taskQueue.startTask(task.id);

      try {
        const handoff = await this.workerPool.assignTask(task);

        if (handoff.filesChanged.length === 0) {
          const workerId = this.taskQueue.getById(task.id)?.assignedTo || "unknown";
          this.monitor.recordEmptyDiff(workerId, task.id);
        }

        if (handoff.status === "complete") {
          this.taskQueue.completeTask(task.id);
        } else {
          this.taskQueue.failTask(task.id);
        }

        this.monitor.recordTokenUsage(handoff.metrics.tokensUsed);

        for (const cb of this.taskCompletedCallbacks) {
          cb(task, handoff);
        }

        this.pendingHandoffs.push({ task, handoff });
      } catch (error) {
        this.taskQueue.failTask(task.id);
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Task dispatch failed", { taskId: task.id, error: err.message });

        const failureHandoff: Handoff = {
          taskId: task.id,
          status: "failed",
          summary: `Worker failed: ${err.message}`,
          diff: "",
          filesChanged: [],
          concerns: [err.message],
          suggestions: ["Retry the task"],
          metrics: {
            linesAdded: 0,
            linesRemoved: 0,
            filesCreated: 0,
            filesModified: 0,
            tokensUsed: 0,
            toolCallCount: 0,
            durationMs: 0,
          },
        };
        this.pendingHandoffs.push({ task, handoff: failureHandoff });
      } finally {
        this.dispatchLimiter.release();
        this.activeTasks.delete(task.id);
      }
    })();

    promise.catch((error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Unhandled dispatch error", { taskId: task.id, error: err.message });
      this.activeTasks.delete(task.id);
      for (const cb of this.errorCallbacks) {
        cb(err);
      }
    });
  }

  /** Drains pendingHandoffs (populated by dispatchSingleTask) into allHandoffs + merge queue. */
  private collectCompletedHandoffs(): void {
    while (this.pendingHandoffs.length > 0) {
      const completed = this.pendingHandoffs.shift();
      if (!completed) break;

      const { task, handoff } = completed;

      this.allHandoffs.push(handoff);
      this.handoffsSinceLastPlan.push(handoff);

      if (handoff.status === "complete") {
        this.mergeQueue.enqueue(task.branch);
      }

      logger.info("Collected handoff", {
        taskId: task.id,
        status: handoff.status,
        filesChanged: handoff.filesChanged.length,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public: inject tasks from external sources (merge-queue conflict resolution)
  // ---------------------------------------------------------------------------

  /**
   * Inject a task directly into the planner's dispatch pipeline.
   * Used by the orchestrator to dispatch conflict-resolution fix tasks
   * without going through the LLM planning cycle.
   */
  injectTask(task: Task): void {
    this.taskQueue.enqueue(task);
    for (const cb of this.taskCreatedCallbacks) {
      cb(task);
    }
    this.activeTasks.add(task.id);
    this.dispatchSingleTask(task);
    logger.info("Injected external task", { taskId: task.id });
  }

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  onTaskCreated(callback: (task: Task) => void): void {
    this.taskCreatedCallbacks.push(callback);
  }

  onTaskCompleted(callback: (task: Task, handoff: Handoff) => void): void {
    this.taskCompletedCallbacks.push(callback);
  }

  onIterationComplete(callback: (iteration: number, tasks: Task[], handoffs: Handoff[]) => void): void {
    this.iterationCompleteCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
