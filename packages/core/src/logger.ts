import { mkdirSync, createWriteStream, type WriteStream } from "node:fs";
import { resolve } from "node:path";
import { LogEntry, AgentRole } from "./types.js";

// ---------------------------------------------------------------------------
// LogWriter — singleton that tees NDJSON lines to a file in logs/
// ---------------------------------------------------------------------------

class LogWriter {
  private stream: WriteStream | null = null;
  private filePath: string | null = null;

  /**
   * Enable file logging. Creates `<projectRoot>/logs/run-<ISO>.ndjson`.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  enable(projectRoot: string): string {
    if (this.stream) return this.filePath!;

    const logsDir = resolve(projectRoot, "logs");
    mkdirSync(logsDir, { recursive: true });

    const ts = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\.\d+Z$/, "");
    this.filePath = resolve(logsDir, `run-${ts}.ndjson`);
    this.stream = createWriteStream(this.filePath, { flags: "a" });

    return this.filePath;
  }

  write(line: string): void {
    if (this.stream) {
      this.stream.write(line + "\n");
    }
  }

  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}

const logWriter = new LogWriter();

/**
 * Enable file logging for all Logger instances.
 * Call once at startup from main.ts.
 * Returns the absolute path to the log file.
 */
export function enableFileLogging(projectRoot: string): string {
  return logWriter.enable(projectRoot);
}

/** Close the log file. Call on graceful shutdown. */
export function closeFileLogging(): void {
  logWriter.close();
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export class Logger {
  constructor(
    private agentId: string,
    private agentRole: AgentRole,
    private taskId?: string
  ) {}

  withTask(taskId: string): Logger {
    return new Logger(this.agentId, this.agentRole, taskId);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }

  private log(level: LogEntry["level"], message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      agentId: this.agentId,
      agentRole: this.agentRole,
      taskId: this.taskId,
      message,
      data,
    };
    const line = JSON.stringify(entry);
    process.stdout.write(line + "\n");
    logWriter.write(line);
  }
}

export function createLogger(agentId: string, role: AgentRole, taskId?: string): Logger {
  return new Logger(agentId, role, taskId);
}
