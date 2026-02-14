import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Monitor } from "../monitor.js";
import type { MonitorConfig } from "../monitor.js";
import type { WorkerPool, Worker } from "../worker-pool.js";
import type { TaskQueue } from "../task-queue.js";

function createMockWorkerPool(workers: Worker[] = []): WorkerPool {
  return {
    getAllWorkers: () => workers,
    getAvailableWorkers: () => workers.filter(w => w.sandboxStatus.status === "ready"),
    getWorkerCount: () => workers.length,
    getActiveTaskCount: () => workers.filter(w => w.sandboxStatus.status === "working").length,
    checkWorkerHealth: async () => null,
  } as unknown as WorkerPool;
}

function createMockTaskQueue(counts = { pending: 0, completed: 0, failed: 0, running: 0 }): TaskQueue {
  return {
    getPendingCount: () => counts.pending,
    getCompletedCount: () => counts.completed,
    getFailedCount: () => counts.failed,
    getRunningCount: () => counts.running,
  } as unknown as TaskQueue;
}

function makeWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: "sandbox-1",
    sandboxStatus: {
      sandboxId: "sandbox-1",
      status: "ready",
      healthCheck: { lastPing: Date.now(), consecutiveFailures: 0 }
    },
    createdAt: Date.now(),
    lastHealthCheck: Date.now(),
    ...overrides,
  } as Worker;
}

function createConfig(): MonitorConfig {
  return {
    healthCheckInterval: 60,
    stuckWorkerThreshold: 30,
    workerTimeout: 300,
  };
}

describe("Monitor", () => {
  let monitor: Monitor;
  let config: MonitorConfig;

  afterEach(() => {
    if (monitor && monitor.isRunning()) {
      monitor.stop();
    }
  });

  describe("start/stop", () => {
    it("start sets running to true", () => {
      config = createConfig();
      monitor = new Monitor(config, createMockWorkerPool(), createMockTaskQueue());
      monitor.start();
      assert.strictEqual(monitor.isRunning(), true);
      monitor.stop();
    });

    it("stop sets running to false", () => {
      config = createConfig();
      monitor = new Monitor(config, createMockWorkerPool(), createMockTaskQueue());
      monitor.start();
      assert.strictEqual(monitor.isRunning(), true);
      monitor.stop();
      assert.strictEqual(monitor.isRunning(), false);
    });
  });

  describe("isWorkerStuck", () => {
    it("returns false for ready worker", () => {
      config = createConfig();
      const worker = makeWorker({ sandboxStatus: { sandboxId: "sandbox-1", status: "ready", healthCheck: { lastPing: Date.now(), consecutiveFailures: 0 } } });
      monitor = new Monitor(config, createMockWorkerPool([worker]), createMockTaskQueue());
      assert.strictEqual(monitor.isWorkerStuck(worker), false);
    });

    it("returns false for recent working worker", () => {
      config = createConfig();
      const now = Date.now();
      const worker = makeWorker({
        sandboxStatus: { sandboxId: "sandbox-1", status: "working", healthCheck: { lastPing: now, consecutiveFailures: 0 } },
        lastHealthCheck: now
      });
      monitor = new Monitor(config, createMockWorkerPool([worker]), createMockTaskQueue());
      assert.strictEqual(monitor.isWorkerStuck(worker), false);
    });

    it("returns true for stale working worker", () => {
      config = createConfig();
      const staleTime = Date.now() - (config.stuckWorkerThreshold * 1000) - 10000;
      const worker = makeWorker({
        sandboxStatus: { sandboxId: "sandbox-1", status: "working", healthCheck: { lastPing: staleTime, consecutiveFailures: 0 } },
        lastHealthCheck: staleTime
      });
      monitor = new Monitor(config, createMockWorkerPool([worker]), createMockTaskQueue());
      assert.strictEqual(monitor.isWorkerStuck(worker), true);
    });
  });

  describe("isWorkerTimedOut", () => {
    it("returns false for non-working worker", () => {
      config = createConfig();
      const worker = makeWorker({ sandboxStatus: { sandboxId: "sandbox-1", status: "ready", healthCheck: { lastPing: Date.now(), consecutiveFailures: 0 } } });
      monitor = new Monitor(config, createMockWorkerPool([worker]), createMockTaskQueue());
      assert.strictEqual(monitor.isWorkerTimedOut(worker), false);
    });

    it("returns false for recently started worker", () => {
      config = createConfig();
      const now = Date.now();
      const worker = makeWorker({
        sandboxStatus: { sandboxId: "sandbox-1", status: "working", healthCheck: { lastPing: now, consecutiveFailures: 0 } },
        currentTask: { id: "task-1", startedAt: now, description: "test", scope: [], acceptance: "", branch: "", status: "running", createdAt: now, priority: 0 }
      });
      monitor = new Monitor(config, createMockWorkerPool([worker]), createMockTaskQueue());
      assert.strictEqual(monitor.isWorkerTimedOut(worker), false);
    });

    it("returns true for long-running worker", () => {
      config = createConfig();
      const startedAt = Date.now() - (config.workerTimeout * 1000) - 10000;
      const worker = makeWorker({
        sandboxStatus: { sandboxId: "sandbox-1", status: "working", healthCheck: { lastPing: Date.now(), consecutiveFailures: 0 } },
        currentTask: { id: "task-1", startedAt, description: "test", scope: [], acceptance: "", branch: "", status: "running", createdAt: startedAt - 1000, priority: 0 }
      });
      monitor = new Monitor(config, createMockWorkerPool([worker]), createMockTaskQueue());
      assert.strictEqual(monitor.isWorkerTimedOut(worker), true);
    });

    it("returns false when no startedAt", () => {
      config = createConfig();
      const worker = makeWorker({
        sandboxStatus: { sandboxId: "sandbox-1", status: "working", healthCheck: { lastPing: Date.now(), consecutiveFailures: 0 } },
        currentTask: { id: "task-1", description: "test", scope: [], acceptance: "", branch: "", status: "running", createdAt: Date.now(), priority: 0 }
      });
      monitor = new Monitor(config, createMockWorkerPool([worker]), createMockTaskQueue());
      assert.strictEqual(monitor.isWorkerTimedOut(worker), false);
    });
  });

  describe("getSnapshot", () => {
    it("returns correct metrics", () => {
      config = createConfig();
      const worker = makeWorker({ sandboxStatus: { sandboxId: "sandbox-1", status: "working", healthCheck: { lastPing: Date.now(), consecutiveFailures: 0 } } });
      const pool = createMockWorkerPool([worker]);
      const queue = createMockTaskQueue({ pending: 5, completed: 10, failed: 2, running: 1 });
      monitor = new Monitor(config, pool, queue);

      const snapshot = monitor.getSnapshot();

      assert.strictEqual(snapshot.activeWorkers, 1);
      assert.strictEqual(snapshot.pendingTasks, 5);
      assert.strictEqual(snapshot.completedTasks, 10);
      assert.strictEqual(snapshot.failedTasks, 2);
      assert.ok(snapshot.timestamp > 0);
      assert.ok(snapshot.commitsPerHour >= 0);
      assert.ok(snapshot.mergeSuccessRate >= 0);
      assert.strictEqual(snapshot.totalTokensUsed, 0);
      assert.strictEqual(snapshot.totalCostUsd, 0);
    });
  });

  describe("recordTokenUsage", () => {
    it("accumulates tokens", () => {
      config = createConfig();
      monitor = new Monitor(config, createMockWorkerPool(), createMockTaskQueue());

      monitor.recordTokenUsage(100);
      monitor.recordTokenUsage(200);

      const snapshot = monitor.getSnapshot();
      assert.strictEqual(snapshot.totalTokensUsed, 300);
    });
  });

  describe("recordMergeAttempt", () => {
    it("tracks success rate", () => {
      config = createConfig();
      monitor = new Monitor(config, createMockWorkerPool(), createMockTaskQueue());

      monitor.recordMergeAttempt(true);
      monitor.recordMergeAttempt(true);
      monitor.recordMergeAttempt(true);
      monitor.recordMergeAttempt(false);

      const snapshot = monitor.getSnapshot();
      assert.strictEqual(snapshot.mergeSuccessRate, 0.75);
    });
  });

  describe("recordEmptyDiff", () => {
    it("fires callback", () => {
      config = createConfig();
      monitor = new Monitor(config, createMockWorkerPool(), createMockTaskQueue());

      let called = false;
      let receivedSandboxId = "";
      let receivedTaskId = "";

      monitor.onEmptyDiff((sandboxId, taskId) => {
        called = true;
        receivedSandboxId = sandboxId;
        receivedTaskId = taskId;
      });

      monitor.recordEmptyDiff("sandbox-abc", "task-xyz");

      assert.strictEqual(called, true);
      assert.strictEqual(receivedSandboxId, "sandbox-abc");
      assert.strictEqual(receivedTaskId, "task-xyz");
    });
  });

  describe("getStuckWorkers", () => {
    it("filters correctly", () => {
      config = createConfig();
      const now = Date.now();
      const staleTime = now - (config.stuckWorkerThreshold * 1000) - 10000;

      const readyWorker = makeWorker({ id: "worker-1", sandboxStatus: { sandboxId: "worker-1", status: "ready", healthCheck: { lastPing: now, consecutiveFailures: 0 } }, lastHealthCheck: now });
      const workingWorker = makeWorker({ id: "worker-2", sandboxStatus: { sandboxId: "worker-2", status: "working", healthCheck: { lastPing: now, consecutiveFailures: 0 } }, lastHealthCheck: now });
      const stuckWorker = makeWorker({ id: "worker-3", sandboxStatus: { sandboxId: "worker-3", status: "working", healthCheck: { lastPing: staleTime, consecutiveFailures: 0 } }, lastHealthCheck: staleTime });

      const pool = createMockWorkerPool([readyWorker, workingWorker, stuckWorker]);
      monitor = new Monitor(config, pool, createMockTaskQueue());

      const stuckWorkers = monitor.getStuckWorkers();

      assert.strictEqual(stuckWorkers.length, 1);
      assert.strictEqual(stuckWorkers[0].id, "worker-3");
    });
  });
});
