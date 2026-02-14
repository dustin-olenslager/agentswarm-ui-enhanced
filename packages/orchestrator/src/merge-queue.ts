import type { HarnessConfig } from "@agentswarm/core";
import {
  checkoutBranch,
  mergeBranch as coreMergeBranch,
  getConflicts,
  createLogger,
} from "@agentswarm/core";

export type MergeStrategy = HarnessConfig["mergeStrategy"];

export interface MergeQueueResult {
  success: boolean;
  status: "merged" | "skipped" | "failed" | "conflict";
  branch: string;
  message: string;
  conflicts?: string[];
}

export interface MergeStats {
  totalMerged: number;
  totalSkipped: number;
  totalFailed: number;
  totalConflicts: number;
}

async function abortMerge(cwd: string): Promise<void> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  try {
    await execFileAsync("git", ["merge", "--abort"], { cwd });
  } catch {
    try {
      await execFileAsync("git", ["rebase", "--abort"], { cwd });
    } catch {
      // Neither merge nor rebase in progress — clean state
    }
  }
}

const logger = createLogger("merge-queue", "root-planner");

export class MergeQueue {
  private queue: string[];
  private merged: Set<string>;
  private stats: MergeStats;
  private mergeStrategy: MergeStrategy;
  private mainBranch: string;
  private repoPath: string;

  constructor(config: {
    mergeStrategy: MergeStrategy;
    mainBranch: string;
    repoPath: string;
  }) {
    this.queue = [];
    this.merged = new Set();
    this.stats = {
      totalMerged: 0,
      totalSkipped: 0,
      totalFailed: 0,
      totalConflicts: 0,
    };
    this.mergeStrategy = config.mergeStrategy;
    this.mainBranch = config.mainBranch;
    this.repoPath = config.repoPath;
  }

  enqueue(branch: string): void {
    if (this.merged.has(branch)) {
      logger.debug(`Branch ${branch} already merged, skipping`);
      return;
    }

    if (this.queue.includes(branch)) {
      logger.debug(`Branch ${branch} already in queue, skipping`);
      return;
    }

    this.queue.push(branch);
    logger.debug(`Enqueued branch ${branch}`);
  }

  dequeue(): string | undefined {
    return this.queue.shift();
  }

  getQueue(): string[] {
    return [...this.queue];
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  async processQueue(): Promise<MergeQueueResult[]> {
    const results: MergeQueueResult[] = [];

    while (this.queue.length > 0) {
      const branch = this.dequeue();
      if (branch) {
        const result = await this.mergeBranch(branch);
        results.push(result);
      }
    }

    return results;
  }

  async mergeBranch(branch: string): Promise<MergeQueueResult> {
    const cwd = this.repoPath;

    logger.info(`Attempting to merge branch ${branch} into ${this.mainBranch}`);

    try {
      // 1. Checkout main branch
      await checkoutBranch(this.mainBranch, cwd);

      // 2. Attempt merge using configured strategy
      const result = await coreMergeBranch(branch, this.mainBranch, this.mergeStrategy, cwd);

      if (result.success) {
        this.merged.add(branch);
        this.stats.totalMerged++;
        logger.info(`Successfully merged branch ${branch}: ${result.message}`);
        return { success: true, status: "merged", branch, message: result.message };
      }

      if (result.conflicted) {
        const conflicts = await getConflicts(cwd);
        await abortMerge(cwd);

        this.stats.totalConflicts++;
        logger.warn(`Merge conflict on branch ${branch}: ${conflicts.length} conflicting files`);
        return {
          success: false,
          status: "conflict",
          branch,
          message: `Merge conflict: ${conflicts.length} conflicting files`,
          conflicts,
        };
      }

      // Merge failed for other reason
      this.stats.totalFailed++;
      logger.error(`Failed to merge branch ${branch}: ${result.message}`);
      return { success: false, status: "failed", branch, message: result.message };
    } catch (error) {
      this.stats.totalFailed++;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Error merging branch ${branch}: ${msg}`);

      // Try to restore main branch on failure
      try {
        await checkoutBranch(this.mainBranch, cwd);
      } catch {
        // Best effort
      }

      return { success: false, status: "failed", branch, message: msg };
    }
  }

  isBranchMerged(branch: string): boolean {
    return this.merged.has(branch);
  }

  getMergeStats(): MergeStats {
    return { ...this.stats };
  }
}
