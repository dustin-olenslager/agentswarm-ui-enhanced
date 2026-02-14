import http from "node:http";
import type { TaskAssignment, TaskResult } from "@agentswarm/core";
import { createLogger } from "@agentswarm/core";
import { runAgent, type AgentConfig } from "./agent.js";
import { HealthTracker } from "./health.js";

const PORT = parseInt(process.env.PORT || "8080", 10);
const SANDBOX_ID = process.env.SANDBOX_ID || `sandbox-${Date.now()}`;

const logger = createLogger("server", "worker");
const healthTracker = new HealthTracker(SANDBOX_ID);

async function parseRequestBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        if (body) {
          resolve(JSON.parse(body));
        } else {
          resolve(null);
        }
      } catch (error) {
        reject(error);
      }
    });
    
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  data: unknown
): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function sendError(
  res: http.ServerResponse,
  statusCode: number,
  message: string
): void {
  sendJson(res, statusCode, { error: message });
}

async function handleTask(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  try {
    const body = await parseRequestBody(req);
    const assignment = body as TaskAssignment;

    if (!assignment.task || !assignment.systemPrompt || !assignment.llmConfig) {
      sendError(res, 400, "Invalid task assignment: missing required fields");
      return;
    }

    logger.info("Received task", { taskId: assignment.task.id });
    healthTracker.setTask(assignment.task.id);

    const config: AgentConfig = {
      llmEndpoint: assignment.llmConfig.endpoint,
      llmModel: assignment.llmConfig.model,
      maxTokens: assignment.llmConfig.maxTokens,
      temperature: assignment.llmConfig.temperature,
      maxIterations: 50,
      systemPrompt: assignment.systemPrompt,
    };

    const result = await runAgent(assignment.task, config);

    const taskResult: TaskResult = {
      type: "task_result",
      handoff: result.handoff,
    };

    healthTracker.clearTask();
    
    logger.info("Task completed", { 
      taskId: assignment.task.id,
      toolCalls: result.handoff.metrics.toolCallCount 
    });

    sendJson(res, 200, taskResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Task failed", { error: message });
    healthTracker.clearTask();
    healthTracker.setUnhealthy();
    sendError(res, 500, message);
  }
}

function handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): void {
  const health = healthTracker.getHealth();
  sendJson(res, 200, health);
}

function handleRoot(_req: http.IncomingMessage, res: http.ServerResponse): void {
  sendJson(res, 200, { status: "ready", sandboxId: SANDBOX_ID });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  logger.debug("Request", { method: req.method, url });

  if (url === "/task" && req.method === "POST") {
    await handleTask(req, res);
  } else if (url === "/health" && req.method === "GET") {
    handleHealth(req, res);
  } else if (url === "/" && req.method === "GET") {
    handleRoot(req, res);
  } else if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
  } else {
    sendError(res, 404, "Not found");
  }
});

server.listen(PORT, () => {
  logger.info("Server started", { port: PORT, sandboxId: SANDBOX_ID });
});

export { server, SANDBOX_ID };
