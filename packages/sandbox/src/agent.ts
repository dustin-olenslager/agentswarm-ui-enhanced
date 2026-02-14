import type { Task, Handoff } from "@agentswarm/core";
import { createLogger } from "@agentswarm/core";
import { TOOL_DEFINITIONS, executeTool, gitDiff, getChangedFiles, getDiffNumstat } from "./tools.js";

const logger = createLogger("agent", "worker");

export interface AgentConfig {
  llmEndpoint: string;
  llmModel: string;
  maxTokens: number;
  temperature: number;
  maxIterations: number;
  systemPrompt: string;
}

export interface AgentResult {
  handoff: Handoff;
  conversationLength: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface LLMResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function runAgent(task: Task, config: AgentConfig): Promise<AgentResult> {
  const startTime = Date.now();
  let tokensUsed = 0;
  let toolCallCount = 0;
  let completedIterations = 0;
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: config.systemPrompt,
    },
    {
      role: "user",
      content: buildUserMessage(task),
    },
  ];

  logger.info("Starting agent loop", { 
    taskId: task.id, 
    maxIterations: config.maxIterations 
  });

  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    completedIterations = iteration + 1;
    logger.debug(`Iteration ${completedIterations}/${config.maxIterations}`);

    const response = await callLLM(config, messages);
    
    if (!response.choices || response.choices.length === 0) {
      logger.error("No response from LLM");
      break;
    }

    const choice = response.choices[0];
    
    if (response.usage) {
      tokensUsed += response.usage.total_tokens;
    }

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: choice.message.content ?? null,
        tool_calls: choice.message.tool_calls,
      });

      for (const toolCall of choice.message.tool_calls) {
        logger.info("Executing tool", { 
          tool: toolCall.function.name,
          callId: toolCall.id 
        });

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          logger.warn("Failed to parse tool arguments", { 
            args: toolCall.function.arguments 
          });
        }

        const result = await executeTool(toolCall.function.name, args);
        toolCallCount++;

        messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
        });
      }
    } else if (choice.message.content) {
      messages.push({
        role: "assistant",
        content: choice.message.content,
      });

      logger.info("Agent completed without tool calls", { 
        iteration: iteration + 1 
      });
      break;
    } else {
      logger.warn("Empty response from LLM", { 
        finishReason: choice.finish_reason 
      });
      break;
    }
  }

  const durationMs = Date.now() - startTime;
  const finalDiff = await gitDiff();
  const filesChanged = await getChangedFiles();
  const numstat = await getDiffNumstat();

  const handoff: Handoff = {
    taskId: task.id,
    status: "complete",
    summary: `Completed in ${completedIterations} iterations with ${toolCallCount} tool calls`,
    diff: finalDiff,
    filesChanged,
    concerns: [],
    suggestions: [],
    metrics: {
      linesAdded: numstat.added,
      linesRemoved: numstat.removed,
      filesCreated: 0,
      filesModified: filesChanged.length,
      tokensUsed,
      toolCallCount,
      durationMs,
    },
  };

  logger.info("Agent finished", { 
    taskId: task.id,
    toolCallCount,
    tokensUsed,
    durationMs 
  });

  return {
    handoff,
    conversationLength: messages.length,
  };
}

function buildUserMessage(task: Task): string {
  let message = `Task ID: ${task.id}\n\n`;
  message += `Description: ${task.description}\n\n`;
  
  if (task.scope && task.scope.length > 0) {
    message += `Scope: ${task.scope.join(", ")}\n\n`;
  }
  
  message += `Acceptance Criteria: ${task.acceptance}\n\n`;
  message += `Branch: ${task.branch}\n`;
  
  return message;
}

async function callLLM(
  config: AgentConfig, 
  messages: ChatMessage[]
): Promise<LLMResponse> {
  const url = `${config.llmEndpoint}/chat/completions`;
  
  logger.debug("Calling LLM", { 
    endpoint: url, 
    model: config.llmModel 
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.llmModel,
      messages: messages,
      tools: TOOL_DEFINITIONS,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("LLM request failed", { 
      status: response.status, 
      error: errorText 
    });
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as LLMResponse;
  return data;
}
