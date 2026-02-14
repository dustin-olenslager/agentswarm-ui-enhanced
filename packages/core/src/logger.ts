import { LogEntry, AgentRole } from "./types.js";

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
    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}

export function createLogger(agentId: string, role: AgentRole, taskId?: string): Logger {
  return new Logger(agentId, role, taskId);
}
