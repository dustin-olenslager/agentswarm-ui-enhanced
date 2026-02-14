// Task status
export type TaskStatus = "pending" | "assigned" | "running" | "complete" | "failed" | "cancelled";

// Agent roles
export type AgentRole = "root-planner" | "subplanner" | "worker" | "reconciler";

// A task assigned by a planner to a worker
export interface Task {
  id: string;                    // Unique task ID (uuid)
  parentId?: string;             // Parent task ID (if subtask)
  description: string;           // What to do (natural language)
  scope: string[];              // File paths the worker should focus on
  acceptance: string;           // How to know when done (natural language)
  branch: string;               // Git branch name for this task
  status: TaskStatus;
  assignedTo?: string;           // Sandbox ID
  createdAt: number;            // Unix timestamp ms
  startedAt?: number;
  completedAt?: number;
  priority: number;              // 1 (highest) to 10 (lowest)
}

// Handoff report from worker back to planner
export interface Handoff {
  taskId: string;
  status: "complete" | "partial" | "blocked" | "failed";
  summary: string;               // What was done
  diff: string;                 // Git diff output
  filesChanged: string[];       // List of changed file paths
  concerns: string[];           // Issues discovered
  suggestions: string[];        // Recommendations for planner
  metrics: {
    linesAdded: number;
    linesRemoved: number;
    filesCreated: number;
    filesModified: number;
    tokensUsed: number;
    toolCallCount: number;
    durationMs: number;
  };
}

// Worker sandbox status
export interface SandboxStatus {
  sandboxId: string;
  status: "starting" | "ready" | "working" | "completing" | "terminated" | "error";
  taskId?: string;
  progress?: string;             // Current activity description
  healthCheck: {
    lastPing: number;           // Unix timestamp ms
    consecutiveFailures: number;
  };
  url?: string;                  // Tunnel URL for HTTP access
}

// Configuration for the harness
export interface HarnessConfig {
  maxWorkers: number;           // Max concurrent sandboxes
  workerTimeout: number;        // Worker timeout in seconds
  mergeStrategy: "fast-forward" | "rebase" | "merge-commit";
  llm: {
    endpoint: string;           // GLM-5 API endpoint URL
    model: string;              // Model name (e.g. "glm-5")
    maxTokens: number;
    temperature: number;
    apiKey?: string;            // API key for authenticated endpoints (e.g. RunPod)
  };
  git: {
    repoUrl: string;            // Target repo URL
    mainBranch: string;         // Usually "main"
    branchPrefix: string;       // e.g. "worker/"
  };
  sandbox: {
    imageTag: string;           // Modal image tag
    cpuCores: number;
    memoryMb: number;
    idleTimeout: number;        // Seconds before auto-terminate
  };
}

// Structured log entry
export interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  agentId: string;
  agentRole: AgentRole;
  taskId?: string;
  message: string;
  data?: Record<string, unknown>;
}

// Metrics snapshot
export interface MetricsSnapshot {
  timestamp: number;
  activeWorkers: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  commitsPerHour: number;
  mergeSuccessRate: number;
  totalTokensUsed: number;
  totalCostUsd: number;
}
