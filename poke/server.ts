/**
 * Poke MCP Server for AgentSwarm
 *
 * Exposes orchestrator state as MCP tools so you can text your Poke agent
 * questions like "how's the swarm doing?" and get live metrics back.
 *
 * Usage:
 *   npx tsx poke/server.ts
 *   npx poke tunnel http://localhost:8787/mcp --name "AgentSwarm"
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v4";
import { createServer } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

const PORT = Number(process.env.PORT) || Number(process.env.POKE_PORT) || 8787;
const REPO_ROOT = path.resolve(".");

let swarmProc: ChildProcess | null = null;
let swarmRequest = "";
let swarmStartedAt = 0;
const swarmLog: string[] = [];

function registerTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // Tool: launch_swarm
  // ---------------------------------------------------------------------------
  server.tool(
    "launch_swarm",
    "Launch the agent swarm to build a project. Spawns the orchestrator in the background.",
    { request: z.string().describe("The build request, e.g. 'Build Minecraft according to SPEC.md and FEATURES.json'") },
    async ({ request }) => {
      if (swarmProc && swarmProc.exitCode === null) {
        return {
          content: [{
            type: "text" as const,
            text: `Swarm is already running.\nRequest: ${swarmRequest}\nStarted: ${new Date(swarmStartedAt).toLocaleTimeString()}`,
          }],
        };
      }

      swarmRequest = request;
      swarmStartedAt = Date.now();
      swarmLog.length = 0;

      swarmProc = spawn("python3", ["main.py", request], {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const pushLog = (stream: NodeJS.ReadableStream, prefix: string) => {
        let buffer = "";
        stream.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) {
              swarmLog.push(`${prefix}${line}`);
              if (swarmLog.length > 200) swarmLog.shift();
            }
          }
        });
      };

      if (swarmProc.stdout) pushLog(swarmProc.stdout, "");
      if (swarmProc.stderr) pushLog(swarmProc.stderr, "[err] ");

      swarmProc.on("exit", (code) => {
        swarmLog.push(`Process exited with code ${code}`);
      });

      return {
        content: [{
          type: "text" as const,
          text: `Swarm launched!\nRequest: ${request}\nPID: ${swarmProc.pid}`,
        }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: swarm_status
  // ---------------------------------------------------------------------------
  server.tool(
    "swarm_status",
    "Get current swarm status: running/stopped, uptime, request, and recent log lines",
    {},
    async () => {
      if (!swarmProc) {
        return { content: [{ type: "text" as const, text: "No swarm has been launched yet." }] };
      }

      const running = swarmProc.exitCode === null;
      const elapsedSec = swarmStartedAt > 0 ? Math.round((Date.now() - swarmStartedAt) / 1000) : 0;
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;

      const lines = [
        `Status:  ${running ? "running" : `stopped (exit code ${swarmProc.exitCode})`}`,
        `Request: ${swarmRequest.slice(0, 120)}`,
        `Elapsed: ${mins}m ${secs}s`,
        `PID:     ${swarmProc.pid ?? "N/A"}`,
        `Log lines captured: ${swarmLog.length}`,
      ];

      // Include the last 15 log lines for quick context.
      if (swarmLog.length > 0) {
        lines.push("", "Recent log:");
        for (const l of swarmLog.slice(-15)) {
          lines.push(`  ${l.slice(0, 200)}`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: swarm_logs
  // ---------------------------------------------------------------------------
  server.tool(
    "swarm_logs",
    "Get the last N log lines from the running (or most recent) swarm",
    { count: z.number().optional().describe("Number of log lines to return (default 50, max 200)") },
    async ({ count }) => {
      if (swarmLog.length === 0) {
        return { content: [{ type: "text" as const, text: "No log output captured yet." }] };
      }

      const n = Math.min(Math.max(count ?? 50, 1), 200);
      const tail = swarmLog.slice(-n);
      return { content: [{ type: "text" as const, text: tail.join("\n") }] };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: stop_swarm
  // ---------------------------------------------------------------------------
  server.tool(
    "stop_swarm",
    "Gracefully stop the running agent swarm. Sends SIGTERM, then SIGKILL after 10s.",
    {},
    async () => {
      if (!swarmProc || swarmProc.exitCode !== null) {
        return {
          content: [{
            type: "text" as const,
            text: `Swarm is not running${swarmProc ? ` (exited with code ${swarmProc.exitCode})` : ""}.`,
          }],
        };
      }

      const pid = swarmProc.pid;
      swarmProc.kill("SIGTERM");

      // Give the process 10s to exit gracefully before force-killing.
      const forceKillTimer = setTimeout(() => {
        if (swarmProc && swarmProc.exitCode === null) {
          swarmProc.kill("SIGKILL");
          swarmLog.push("[poke] Force-killed after 10s timeout");
        }
      }, 10_000);

      await new Promise<void>((resolve) => {
        if (!swarmProc || swarmProc.exitCode !== null) {
          resolve();
          return;
        }
        swarmProc.on("exit", () => resolve());
      });

      clearTimeout(forceKillTimer);

      return {
        content: [{
          type: "text" as const,
          text: `Swarm stopped (PID ${pid}).\nFinal exit code: ${swarmProc?.exitCode ?? "unknown"}`,
        }],
      };
    },
  );
}

// ---------------------------------------------------------------------------
// HTTP server with Streamable HTTP transport
// ---------------------------------------------------------------------------
const httpServer = createServer(async (req, res) => {
  if (req.url === "/mcp" && req.method === "POST") {
    const mcpServer = new McpServer(
      { name: "AgentSwarm", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );
    registerTools(mcpServer);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } else if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", name: "AgentSwarm Poke Server" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

// Bind to 0.0.0.0 on Railway/container environments, localhost otherwise
const HOST = process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1";

httpServer.listen(PORT, HOST, async () => {
  console.log(`AgentSwarm Poke MCP server running on http://${HOST}:${PORT}/mcp`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log("");

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    // --- Railway deployment ---
    console.log("Railway public URL:");
    console.log(`  https://${process.env.RAILWAY_PUBLIC_DOMAIN}/mcp`);
    console.log("");
    console.log("Connect to Poke:");
    console.log(`  npx poke mcp add https://${process.env.RAILWAY_PUBLIC_DOMAIN}/mcp --name "AgentSwarm"`);
  } else {
    // --- Local dev: detect ngrok tunnel ---
    try {
      const resp = await fetch("http://127.0.0.1:4040/api/tunnels");
      const data = (await resp.json()) as { tunnels: Array<{ public_url: string; config: { addr: string } }> };
      const tunnel = data.tunnels.find(
        (t) => t.config.addr.includes(String(PORT)) && t.public_url.startsWith("https"),
      );
      if (tunnel) {
        console.log("ngrok tunnel detected:");
        console.log(`  ${tunnel.public_url}/mcp`);
        console.log("");
        console.log("Connect to Poke:");
        console.log(`  npx poke mcp add ${tunnel.public_url}/mcp --name "AgentSwarm"`);
      } else {
        printLocalInstructions();
      }
    } catch {
      // ngrok not running — show manual instructions
      printLocalInstructions();
    }
  }
});

function printLocalInstructions(): void {
  console.log("To expose to Poke, run one of these in another terminal:");
  console.log("");
  console.log("  Option A (ngrok):");
  console.log(`    pnpm poke:ngrok`);
  console.log(`    Then: npx poke mcp add https://<your-ngrok-url>/mcp --name "AgentSwarm"`);
  console.log("");
  console.log("  Option B (poke tunnel):");
  console.log(`    pnpm poke:tunnel`);
}
