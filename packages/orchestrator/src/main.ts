import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createLogger } from "@agentswarm/core";
import { loadConfig } from "./config.js";
import { TaskQueue } from "./task-queue.js";
import { WorkerPool } from "./worker-pool.js";
import { MergeQueue } from "./merge-queue.js";
import { Monitor } from "./monitor.js";
import { Planner } from "./planner.js";
import { Reconciler } from "./reconciler.js";

const logger = createLogger("main", "root-planner");

async function readPrompt(name: string): Promise<string> {
  const promptPath = resolve(process.cwd(), "prompts", `${name}.md`);
  return readFile(promptPath, "utf-8");
}

async function main(): Promise<void> {
  const config = loadConfig();
  const [rootPrompt, workerPrompt, reconcilerPrompt] = await Promise.all([
    readPrompt("root-planner"),
    readPrompt("worker"),
    readPrompt("reconciler"),
  ]);

  logger.info("Config loaded", {
    maxWorkers: config.maxWorkers,
    targetRepo: config.targetRepoPath,
  });

  const taskQueue = new TaskQueue();

  const workerPool = new WorkerPool(
    {
      maxWorkers: config.maxWorkers,
      workerTimeout: config.workerTimeout,
      llm: config.llm,
      git: config.git,
      pythonPath: config.pythonPath,
    },
    workerPrompt,
  );

  const mergeQueue = new MergeQueue({
    mergeStrategy: config.mergeStrategy,
    mainBranch: config.git.mainBranch,
    repoPath: config.targetRepoPath,
  });

  const monitor = new Monitor(
    {
      healthCheckInterval: config.healthCheckInterval,
      workerTimeout: config.workerTimeout,
    },
    workerPool,
    taskQueue,
  );

  const planner = new Planner(
    config,
    { maxIterations: 100 },
    taskQueue,
    workerPool,
    mergeQueue,
    monitor,
    rootPrompt,
  );

  const reconciler = new Reconciler(
    config,
    { intervalMs: 300_000, maxFixTasks: 5 },
    taskQueue,
    monitor,
    reconcilerPrompt,
  );

  planner.onTaskCreated((task) => {
    logger.info("Task created", {
      taskId: task.id,
      desc: task.description.slice(0, 80),
    });
  });

  planner.onTaskCompleted((task, handoff) => {
    logger.info("Task completed", { taskId: task.id, status: handoff.status });
  });

  planner.onIterationComplete((iteration, tasks, handoffs) => {
    const snapshot = monitor.getSnapshot();
    logger.info("Iteration complete", {
      iteration,
      tasks: tasks.length,
      handoffs: handoffs.length,
      ...snapshot,
    });
  });

  planner.onError((error) => {
    logger.error("Planner error", { error: error.message });
  });

  reconciler.onSweepComplete((tasks) => {
    if (tasks.length > 0) {
      logger.info("Reconciler created fix tasks", { count: tasks.length });
    }
  });

  reconciler.onError((error) => {
    logger.error("Reconciler error", { error: error.message });
  });

  monitor.onWorkerTimeout((workerId, taskId) => {
    logger.error("Worker timed out", { workerId, taskId });
  });

  monitor.onEmptyDiff((workerId, taskId) => {
    logger.warn("Empty diff from worker", { workerId, taskId });
  });

  monitor.onMetricsUpdate((snapshot) => {
    logger.info("Metrics", { ...snapshot });
  });

  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down...");

    planner.stop();
    reconciler.stop();
    monitor.stop();
    await workerPool.stop();

    const snapshot = monitor.getSnapshot();
    logger.info("Final metrics", { ...snapshot });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  await workerPool.start();
  monitor.start();
  reconciler.start();

  logger.info("Orchestrator started — beginning planner loop");

  const request =
    "Build VoxelCraft according to SPEC.md and FEATURES.json in the target repository.";
  await planner.runLoop(request);

  // Normal completion
  reconciler.stop();
  monitor.stop();
  await workerPool.stop();

  const finalSnapshot = monitor.getSnapshot();
  logger.info("Planner loop complete", { ...finalSnapshot });
}

main().catch((error) => {
  logger.error("Fatal error", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
