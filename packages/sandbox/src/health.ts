import type { HealthResponse } from "@agentswarm/core";

export class HealthTracker {
  private startTime: number;
  private currentTaskId?: string;
  private currentStatus: "healthy" | "unhealthy" = "healthy";

  constructor(private sandboxId: string) {
    this.startTime = Date.now();
  }

  setTask(taskId: string): void {
    this.currentTaskId = taskId;
  }

  clearTask(): void {
    this.currentTaskId = undefined;
  }

  setUnhealthy(): void {
    this.currentStatus = "unhealthy";
  }

  getHealth(): HealthResponse {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    return {
      type: "health",
      sandboxId: this.sandboxId,
      status: this.currentStatus,
      uptime: Date.now() - this.startTime,
      memoryUsageMb,
      taskId: this.currentTaskId,
      taskStatus: this.currentTaskId ? "running" : undefined,
    };
  }
}
