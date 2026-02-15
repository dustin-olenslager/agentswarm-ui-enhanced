#!/usr/bin/env node
/**
 * Run a single Stagehand browser session and persist recording metadata.
 *
 * Intended for:
 * - manual smoke recordings (`pnpm stagehand:record`)
 * - git hook automation after merges (`pnpm stagehand:record:hook`)
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import { Stagehand } from "@browserbasehq/stagehand";

const DEFAULT_URL = "http://127.0.0.1:5173";
const DEFAULT_WAIT_MS = 30_000;
const DEFAULT_NAV_TIMEOUT_MS = 60_000;
const DEFAULT_OUTPUT_DIR = "stagehand-runs";
const DEFAULT_MODEL = "openai/gpt-4.1-mini";

function parseArgs(argv) {
  const parsed = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;

    const trimmed = arg.slice(2);
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      parsed[trimmed] = "true";
      continue;
    }

    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    parsed[key] = value;
  }

  return parsed;
}

function parseIntValue(rawValue, fallback, name) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return fallback;
  const value = Number.parseInt(String(rawValue), 10);
  if (Number.isNaN(value) || value < 0) {
    throw new Error(`Invalid ${name}: "${rawValue}"`);
  }
  return value;
}

function parseBoolean(rawValue, fallback, name) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return fallback;
  const normalized = String(rawValue).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid ${name}: "${rawValue}"`);
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeMetadata(path, payload) {
  await writeFile(path, JSON.stringify(payload, null, 2), "utf-8");
}

function isLoopbackHost(urlString) {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function expandHome(pathLike) {
  if (!pathLike) return pathLike;
  if (!pathLike.startsWith("~/")) return pathLike;
  const home = process.env.HOME || "";
  if (!home) return pathLike;
  return join(home, pathLike.slice(2));
}

function resolveExistingPath(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = expandHome(candidate);
    if (existsSync(resolved)) return resolved;
  }
  return null;
}

function resolveLocalBrowserExecutablePath(args) {
  const explicitPath =
    args["local-browser-path"]
    || process.env.STAGEHAND_LOCAL_BROWSER_PATH
    || process.env.CHROME_PATH;
  if (explicitPath) {
    const resolvedExplicit = resolveExistingPath([explicitPath]);
    if (!resolvedExplicit) {
      throw new Error(
        `Configured local browser path does not exist: ${expandHome(explicitPath)} ` +
        "(set STAGEHAND_LOCAL_BROWSER_PATH to a valid Chromium-based browser executable)",
      );
    }
    return resolvedExplicit;
  }

  const preferredBrowser = (args["local-browser"] || process.env.STAGEHAND_LOCAL_BROWSER || "").toLowerCase();

  const appCandidatesByBrowser = {
    chrome: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "~/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    brave: [
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "~/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ],
    arc: [
      "/Applications/Arc.app/Contents/MacOS/Arc",
      "~/Applications/Arc.app/Contents/MacOS/Arc",
    ],
  };

  if (process.platform === "darwin") {
    const orderedCandidates = [];
    if (preferredBrowser && Object.hasOwn(appCandidatesByBrowser, preferredBrowser)) {
      orderedCandidates.push(...appCandidatesByBrowser[preferredBrowser]);
    }
    orderedCandidates.push(
      ...appCandidatesByBrowser.chrome,
      ...appCandidatesByBrowser.brave,
      ...appCandidatesByBrowser.arc,
    );

    const resolved = resolveExistingPath(orderedCandidates);
    if (resolved) return resolved;
  }

  return null;
}

async function resolveStagehandPage(stagehand) {
  const context = stagehand.context;
  if (!context) {
    throw new Error("Stagehand context is unavailable after initialization.");
  }

  try {
    return await context.awaitActivePage(10_000);
  } catch {
    // Fall through to other strategies.
  }

  const existingPages = context.pages();
  if (existingPages.length > 0) {
    return existingPages[existingPages.length - 1];
  }

  return await context.newPage();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const runTrigger = args.trigger || process.env.STAGEHAND_TRIGGER || "manual";
  const runUrl = args.url || process.env.STAGEHAND_RECORD_URL || DEFAULT_URL;
  const waitMs = parseIntValue(
    args["wait-ms"] ?? process.env.STAGEHAND_RECORD_WAIT_MS,
    DEFAULT_WAIT_MS,
    "wait-ms",
  );
  const navigationTimeoutMs = parseIntValue(
    args["nav-timeout-ms"] ?? process.env.STAGEHAND_NAV_TIMEOUT_MS,
    DEFAULT_NAV_TIMEOUT_MS,
    "nav-timeout-ms",
  );
  const verbose = parseIntValue(args.verbose ?? process.env.STAGEHAND_VERBOSE, 1, "verbose");
  const headless = parseBoolean(
    args.headless ?? process.env.STAGEHAND_HEADLESS,
    true,
    "headless",
  );

  const outputBaseDir = resolve(
    process.cwd(),
    args["output-dir"] || process.env.STAGEHAND_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
  );
  const runDir = join(outputBaseDir, `run-${timestampSlug()}`);
  await mkdir(runDir, { recursive: true });

  const metadataPath = join(runDir, "metadata.json");
  const screenshotPath = join(runDir, "final.png");
  const startedAt = new Date().toISOString();

  const requestedEnv = (args.env || process.env.STAGEHAND_ENV || "").toUpperCase();
  const stagehandEnv = requestedEnv || "BROWSERBASE";
  if (stagehandEnv !== "BROWSERBASE" && stagehandEnv !== "LOCAL") {
    throw new Error(`Invalid Stagehand env "${stagehandEnv}". Use "BROWSERBASE" or "LOCAL".`);
  }

  const modelName = args.model || process.env.STAGEHAND_MODEL || DEFAULT_MODEL;
  if (!process.env.MODEL_API_KEY && process.env.OPENAI_API_KEY) {
    process.env.MODEL_API_KEY = process.env.OPENAI_API_KEY;
  }
  if (!process.env.MODEL_API_KEY) {
    throw new Error(
      "Missing MODEL_API_KEY (or OPENAI_API_KEY). Stagehand requires an LLM key even for record-only runs.",
    );
  }

  if (stagehandEnv === "BROWSERBASE") {
    if (!process.env.BROWSERBASE_API_KEY) {
      throw new Error("Missing BROWSERBASE_API_KEY for BROWSERBASE mode.");
    }
    if (!process.env.BROWSERBASE_PROJECT_ID) {
      throw new Error("Missing BROWSERBASE_PROJECT_ID for BROWSERBASE mode.");
    }
    if (isLoopbackHost(runUrl)) {
      throw new Error(
        `BROWSERBASE mode cannot access loopback URL "${runUrl}". ` +
        "Use a public/tunneled URL (for example via ngrok/cloudflared) or set STAGEHAND_ENV=LOCAL.",
      );
    }
  }

  const localExecutablePath = stagehandEnv === "LOCAL"
    ? resolveLocalBrowserExecutablePath(args)
    : null;

  const config = {
    env: stagehandEnv,
    modelName,
    verbose,
    ...(stagehandEnv === "BROWSERBASE"
      ? {
          apiKey: process.env.BROWSERBASE_API_KEY,
          projectId: process.env.BROWSERBASE_PROJECT_ID,
        }
      : {
          localBrowserLaunchOptions: {
            headless,
            ...(localExecutablePath ? { executablePath: localExecutablePath } : {}),
          },
        }),
  };

  let stagehand = null;

  try {
    stagehand = new Stagehand(config);
    await stagehand.init();

    const page = await resolveStagehandPage(stagehand);

    const sessionId = stagehand.browserbaseSessionID ?? null;
    const sessionUrl = stagehand.browserbaseSessionURL ?? null;
    const debugUrl = stagehand.browserbaseDebugURL ?? null;

    console.log(`[stagehand] Trigger: ${runTrigger}`);
    console.log(`[stagehand] Environment: ${stagehandEnv}`);
    console.log(`[stagehand] URL: ${runUrl}`);
    if (localExecutablePath) console.log(`[stagehand] Local Browser Executable: ${localExecutablePath}`);
    if (sessionId) console.log(`[stagehand] Session ID: ${sessionId}`);
    if (sessionUrl) console.log(`[stagehand] Session URL: ${sessionUrl}`);
    if (debugUrl) console.log(`[stagehand] Live Debug URL: ${debugUrl}`);

    await page.goto(runUrl, {
      waitUntil: "domcontentloaded",
      timeout: navigationTimeoutMs,
    });

    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const completedAt = new Date().toISOString();
    const metadata = {
      status: "ok",
      trigger: runTrigger,
      stagehandEnv,
      modelName,
      startedAt,
      completedAt,
      url: runUrl,
      waitMs,
      navigationTimeoutMs,
      localExecutablePath,
      sessionId,
      sessionUrl,
      debugUrl,
      screenshotPath,
      outputDir: runDir,
    };

    await writeMetadata(metadataPath, metadata);

    console.log(`[stagehand] Recording complete.`);
    console.log(`[stagehand] Metadata: ${metadataPath}`);
    console.log(`[stagehand] Screenshot: ${screenshotPath}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const failedAt = new Date().toISOString();

    const failureMetadata = {
      status: "failed",
      trigger: runTrigger,
      stagehandEnv,
      modelName,
      startedAt,
      failedAt,
      url: runUrl,
      waitMs,
      navigationTimeoutMs,
      localExecutablePath,
      error: err.message,
      stack: err.stack,
      outputDir: runDir,
    };

    await writeMetadata(metadataPath, failureMetadata);
    console.error(`[stagehand] Recording failed: ${err.message}`);
    console.error(`[stagehand] Failure metadata: ${metadataPath}`);
    throw err;
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {
        // Best effort close.
      }
    }
  }
}

main().catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[stagehand] Setup failed: ${err.message}`);
  process.exit(1);
});
