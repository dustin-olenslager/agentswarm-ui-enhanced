/**
 * LLM Client for OpenAI-compatible endpoints (GLM-5)
 * Thin HTTP wrapper for chat completion API
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMClientConfig {
  endpoint: string;
  model: string;
  maxTokens: number;
  temperature: number;
  apiKey?: string;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Lean HTTP client for OpenAI-compatible LLM endpoints
 */
export class LLMClient {
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
  }

  /**
   * Send a chat completion request to the LLM endpoint
   */
  async complete(
    messages: LLMMessage[],
    overrides?: Partial<Pick<LLMClientConfig, "model" | "temperature" | "maxTokens">>
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.config.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: overrides?.model ?? this.config.model,
        messages,
        temperature: overrides?.temperature ?? this.config.temperature,
        max_tokens: overrides?.maxTokens ?? this.config.maxTokens,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 120_000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    };
  }
}
