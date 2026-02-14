import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  Task,
  Handoff,
  SandboxStatus,
  HarnessConfig,
  TaskAssignment,
  TaskResult,
  HealthResponse,
} from "@agentswarm/core";
import { createLogger } from "@agentswarm/core";

const execFileAsync = promisify(execFile);

const logger = createLogger("worker-pool", "root-planner");

export interface Worker {
  id: string;
  sandboxStatus: SandboxStatus;
  currentTask?: Task;
  createdAt: number;
  lastHealthCheck: number;
}

export class WorkerPool {
  private workers: Map<string, Worker>;
  private workerPrompt: string;
  private config: {
    maxWorkers: number;
    workerTimeout: number;
    llm: HarnessConfig["llm"];
    git: HarnessConfig["git"];
    pythonPath: string;
  };
  private taskCompleteCallbacks: ((handoff: Handoff) => void)[];
  private workerReadyCallbacks: ((sandboxId: string) => void)[];
  private workerFailedCallbacks: ((sandboxId: string, error: Error) => void)[];

  constructor(
    config: {
      maxWorkers: number;
      workerTimeout: number;
      llm: HarnessConfig["llm"];
      git: HarnessConfig["git"];
      pythonPath: string;
    },
    workerPrompt: string,
  ) {
    this.workers = new Map();
    this.workerPrompt = workerPrompt;
    this.config = config;
    this.taskCompleteCallbacks = [];
    this.workerReadyCallbacks = [];
    this.workerFailedCallbacks = [];
  }

  async start(): Promise<void> {
    logger.info("Starting worker pool", { maxWorkers: this.config.maxWorkers });
    const spawnPromises: Promise<string>[] = [];
    for (let i = 0; i < this.config.maxWorkers; i++) {
      spawnPromises.push(this.spawnWorker());
    }
    const results = await Promise.allSettled(spawnPromises);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    logger.info("Worker pool started", { succeeded, failed: results.length - succeeded });
  }

  async stop(): Promise<void> {
    logger.info("Stopping worker pool", { workerCount: this.workers.size });
    const terminatePromises = [...this.workers.keys()].map((id) =>
      this.terminateWorker(id),
    );
    await Promise.allSettled(terminatePromises);
    logger.info("Worker pool stopped");
  }

  async assignTask(task: Task): Promise<Handoff> {
    const available = this.getAvailableWorkers();
    if (available.length === 0) {
      throw new Error("No available workers");
    }

    const worker = available[0];
    worker.sandboxStatus.status = "working";
    worker.sandboxStatus.taskId = task.id;
    worker.currentTask = task;

    logger.info("Assigning task to worker", { taskId: task.id, workerId: worker.id });

    const assignment: TaskAssignment = {
      type: "task_assignment",
      task,
      systemPrompt: this.workerPrompt,
      repoSnapshot: this.config.git.repoUrl,
      llmConfig: this.config.llm,
    };

    try {
      const response = await fetch(`${worker.sandboxStatus.url}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignment),
      });

      if (!response.ok) {
        throw new Error(
          `Sandbox ${worker.id} returned ${response.status}: ${await response.text()}`,
        );
      }

      const result = (await response.json()) as TaskResult;

      worker.sandboxStatus.status = "ready";
      worker.sandboxStatus.taskId = undefined;
      worker.currentTask = undefined;

      for (const cb of this.taskCompleteCallbacks) {
        cb(result.handoff);
      }

      logger.info("Task completed", {
        taskId: task.id,
        workerId: worker.id,
        status: result.handoff.status,
      });

      return result.handoff;
    } catch (error) {
      worker.sandboxStatus.status = "error";
      worker.sandboxStatus.taskId = undefined;
      worker.currentTask = undefined;

      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Task assignment failed", { taskId: task.id, workerId: worker.id, error: err.message });
      throw err;
    }
  }

  async spawnWorker(): Promise<string> {
    const pythonScript = `
import asyncio, json
from infra.spawn_sandbox import SandboxManager

async def main():
    mgr = SandboxManager()
    info = await mgr.create_sandbox()
    print(json.dumps({"sandboxId": info.sandbox_id, "url": info.url}))

asyncio.run(main())
`;

    logger.info("Spawning new worker via Python");

    const { stdout } = await execFileAsync(
      this.config.pythonPath,
      ["-c", pythonScript],
      { cwd: process.cwd() },
    );

    let parsed: { sandboxId: string; url: string };
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {
      throw new Error(`Failed to parse spawn_sandbox output: ${stdout.trim().slice(0, 200)}`);
    }
    const sandboxId = parsed.sandboxId;
    const url = parsed.url;

    const worker: Worker = {
      id: sandboxId,
      sandboxStatus: {
        sandboxId,
        status: "ready",
        healthCheck: { lastPing: Date.now(), consecutiveFailures: 0 },
        url,
      },
      createdAt: Date.now(),
      lastHealthCheck: Date.now(),
    };

    this.workers.set(sandboxId, worker);

    logger.info("Worker spawned", { sandboxId, url });

    for (const cb of this.workerReadyCallbacks) {
      cb(sandboxId);
    }

    return sandboxId;
  }

  async terminateWorker(sandboxId: string): Promise<void> {
    const pythonScript = `
import asyncio
from infra.spawn_sandbox import SandboxManager

async def main():
    mgr = SandboxManager()
    await mgr.terminate_sandbox("${sandboxId}")

asyncio.run(main())
`;

    logger.info("Terminating worker", { sandboxId });

    try {
      await execFileAsync(this.config.pythonPath, ["-c", pythonScript], {
        cwd: process.cwd(),
      });
    } catch (error) {
      logger.warn("Error during worker termination", {
        sandboxId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const worker = this.workers.get(sandboxId);
    if (worker) {
      worker.sandboxStatus.status = "terminated";
    }
    this.workers.delete(sandboxId);

    logger.info("Worker terminated", { sandboxId });
  }

  async recycleWorker(sandboxId: string): Promise<string> {
    logger.info("Recycling worker", { sandboxId });
    await this.terminateWorker(sandboxId);
    return this.spawnWorker();
  }

  getWorker(sandboxId: string): Worker | undefined {
    return this.workers.get(sandboxId);
  }

  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  getAvailableWorkers(): Worker[] {
    return Array.from(this.workers.values()).filter(
      (w) => w.sandboxStatus.status === "ready",
    );
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  getActiveTaskCount(): number {
    return Array.from(this.workers.values()).filter(
      (w) => w.sandboxStatus.status === "working",
    ).length;
  }

  async checkWorkerHealth(sandboxId: string): Promise<HealthResponse | null> {
    const worker = this.workers.get(sandboxId);
    if (!worker?.sandboxStatus.url) {
      return null;
    }

    try {
      const response = await fetch(`${worker.sandboxStatus.url}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const health = (await response.json()) as HealthResponse;
      worker.lastHealthCheck = Date.now();
      worker.sandboxStatus.healthCheck.lastPing = Date.now();
      worker.sandboxStatus.healthCheck.consecutiveFailures = 0;
      return health;
    } catch (error) {
      worker.sandboxStatus.healthCheck.consecutiveFailures += 1;

      if (worker.sandboxStatus.healthCheck.consecutiveFailures >= 3) {
        worker.sandboxStatus.status = "error";
        const err = new Error(
          `Worker ${sandboxId} unhealthy after 3 consecutive failures`,
        );
        for (const cb of this.workerFailedCallbacks) {
          cb(sandboxId, err);
        }
        logger.error("Worker health check failed", {
          sandboxId,
          consecutiveFailures: worker.sandboxStatus.healthCheck.consecutiveFailures,
        });
      }

      return null;
    }
  }

  onTaskComplete(callback: (handoff: Handoff) => void): void {
    this.taskCompleteCallbacks.push(callback);
  }

  onWorkerReady(callback: (sandboxId: string) => void): void {
    this.workerReadyCallbacks.push(callback);
  }

  onWorkerFailed(callback: (sandboxId: string, error: Error) => void): void {
    this.workerFailedCallbacks.push(callback);
  }
}
