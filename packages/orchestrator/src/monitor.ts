import type { MetricsSnapshot } from "@agentswarm/core";
import { createLogger } from "@agentswarm/core";
import type { WorkerPool, Worker } from "./worker-pool.js";
import type { TaskQueue } from "./task-queue.js";

const logger = createLogger("monitor", "root-planner");

export interface MonitorConfig {
  healthCheckInterval: number;
  stuckWorkerThreshold: number;
  workerTimeout: number;
}

export class Monitor {
  private config: MonitorConfig;
  private workerPool: WorkerPool;
  private taskQueue: TaskQueue;
  private mergeStats: { totalMerged: number; totalFailed: number };
  private pollTimer: ReturnType<typeof setInterval> | null;
  private running: boolean;

  private totalTokensUsed: number;
  private totalCostUsd: number;
  private mergeAttempts: number;
  private mergeSuccesses: number;
  private startTime: number;

  private onStuckCallbacks: ((sandboxId: string, lastProgress: string) => void)[];
  private onTimeoutCallbacks: ((sandboxId: string, taskId: string) => void)[];
  private onEmptyDiffCallbacks: ((sandboxId: string, taskId: string) => void)[];
  private onUnhealthyCallbacks: ((sandboxId: string) => void)[];
  private onMetricsCallbacks: ((snapshot: MetricsSnapshot) => void)[];

  constructor(config: MonitorConfig, workerPool: WorkerPool, taskQueue: TaskQueue) {
    this.config = config;
    this.workerPool = workerPool;
    this.taskQueue = taskQueue;
    this.mergeStats = { totalMerged: 0, totalFailed: 0 };
    this.pollTimer = null;
    this.running = false;

    this.totalTokensUsed = 0;
    this.totalCostUsd = 0;
    this.mergeAttempts = 0;
    this.mergeSuccesses = 0;
    this.startTime = Date.now();

    this.onStuckCallbacks = [];
    this.onTimeoutCallbacks = [];
    this.onEmptyDiffCallbacks = [];
    this.onUnhealthyCallbacks = [];
    this.onMetricsCallbacks = [];
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = Date.now();

    this.pollTimer = setInterval(async () => {
      await this.pollAllWorkers();
    }, this.config.healthCheckInterval * 1000);

    logger.info("Monitor started", { interval: this.config.healthCheckInterval });
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.running = false;
    logger.info("Monitor stopped");
  }

  isRunning(): boolean {
    return this.running;
  }

  async pollAllWorkers(): Promise<void> {
    const workers = this.workerPool.getAllWorkers();

    for (const worker of workers) {
      const health = await this.workerPool.checkWorkerHealth(worker.id);

      if (!health) {
        if (worker.sandboxStatus.status === "error") {
          for (const cb of this.onUnhealthyCallbacks) {
            cb(worker.id);
          }
        }
        continue;
      }

      if (this.isWorkerStuck(worker)) {
        const progress = worker.sandboxStatus.progress || "unknown";
        logger.warn("Worker stuck", { sandboxId: worker.id, taskId: worker.currentTask?.id, lastProgress: progress });
        for (const cb of this.onStuckCallbacks) {
          cb(worker.id, progress);
        }
      }

      if (this.isWorkerTimedOut(worker)) {
        const taskId = worker.currentTask?.id || "unknown";
        logger.error("Worker timed out", { sandboxId: worker.id, taskId });
        for (const cb of this.onTimeoutCallbacks) {
          cb(worker.id, taskId);
        }
      }
    }

    const snapshot = this.getSnapshot();
    for (const cb of this.onMetricsCallbacks) {
      cb(snapshot);
    }
  }

  isWorkerStuck(worker: Worker): boolean {
    if (worker.sandboxStatus.status !== "working") return false;
    const elapsed = (Date.now() - worker.lastHealthCheck) / 1000;
    return elapsed > this.config.stuckWorkerThreshold;
  }

  getStuckWorkers(): Worker[] {
    return this.workerPool.getAllWorkers().filter((w) => this.isWorkerStuck(w));
  }

  isWorkerTimedOut(worker: Worker): boolean {
    if (worker.sandboxStatus.status !== "working") return false;
    if (!worker.currentTask?.startedAt) return false;
    const elapsed = (Date.now() - worker.currentTask.startedAt) / 1000;
    return elapsed > this.config.workerTimeout;
  }

  getTimedOutWorkers(): Worker[] {
    return this.workerPool.getAllWorkers().filter((w) => this.isWorkerTimedOut(w));
  }

  getSnapshot(): MetricsSnapshot {
    const elapsedHours = Math.max((Date.now() - this.startTime) / 3600000, 0.001);
    const completedCount = this.taskQueue.getCompletedCount();

    return {
      timestamp: Date.now(),
      activeWorkers: this.workerPool.getActiveTaskCount(),
      pendingTasks: this.taskQueue.getPendingCount(),
      completedTasks: completedCount,
      failedTasks: this.taskQueue.getFailedCount(),
      commitsPerHour: completedCount / elapsedHours,
      mergeSuccessRate: this.mergeAttempts > 0 ? this.mergeSuccesses / this.mergeAttempts : 0,
      totalTokensUsed: this.totalTokensUsed,
      totalCostUsd: this.totalCostUsd,
    };
  }

  recordTokenUsage(tokens: number): void {
    this.totalTokensUsed += tokens;
  }

  recordMergeAttempt(success: boolean): void {
    this.mergeAttempts += 1;
    if (success) {
      this.mergeSuccesses += 1;
      this.mergeStats.totalMerged += 1;
    } else {
      this.mergeStats.totalFailed += 1;
    }
  }

  recordEmptyDiff(sandboxId: string, taskId: string): void {
    logger.warn("Empty diff detected", { sandboxId, taskId });
    for (const cb of this.onEmptyDiffCallbacks) {
      cb(sandboxId, taskId);
    }
  }

  onWorkerStuck(callback: (sandboxId: string, lastProgress: string) => void): void {
    this.onStuckCallbacks.push(callback);
  }

  onWorkerTimeout(callback: (sandboxId: string, taskId: string) => void): void {
    this.onTimeoutCallbacks.push(callback);
  }

  onEmptyDiff(callback: (sandboxId: string, taskId: string) => void): void {
    this.onEmptyDiffCallbacks.push(callback);
  }

  onWorkerUnhealthy(callback: (sandboxId: string) => void): void {
    this.onUnhealthyCallbacks.push(callback);
  }

  onMetricsUpdate(callback: (snapshot: MetricsSnapshot) => void): void {
    this.onMetricsCallbacks.push(callback);
  }
}
