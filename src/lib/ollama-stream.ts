const LLAMA_BASE = "http://127.0.0.1:8080";
const OLLAMA_BASE = "http://127.0.0.1:11434";

export const OLLAMA_MODELS = {
  reasoning: "qwen2_5-1_5b-q5-hf",
  fast: "functiongemma:latest",
} as const;

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface LlamaChatRequest {
  messages: OllamaMessage[];
  stream?: boolean;
  cache_prompt?: boolean;
}

interface LlamaChatResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
}

interface LlamaChatChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
    thinking?: string;
  };
}

export interface OllamaStreamChunk {
  content: string;
  thinking: string;
}

function extractThinkingBlock(text: string) {
  const match = text.match(/<think>([\s\S]*?)<\/think>/i);
  const thinking = match?.[1]?.trim() ?? "";
  const content = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return { thinking, content };
}

function isReasoningModel(model: string) {
  return model === OLLAMA_MODELS.reasoning;
}

export async function chatWithOllama(
  history: OllamaMessage[],
  model = OLLAMA_MODELS.reasoning,
): Promise<string> {
  if (!isReasoningModel(model)) {
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: history,
        stream: false,
      } as OllamaChatRequest),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message?.content?.trim() ?? "";
  }

  const response = await fetch(`${LLAMA_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history,
      stream: false,
      cache_prompt: true,
    } as LlamaChatRequest),
  });

  if (!response.ok) {
    throw new Error(`llama.cpp error: ${response.status}`);
  }

  const data = (await response.json()) as LlamaChatResponse;
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  const parsed = extractThinkingBlock(raw);
  return parsed.content || raw;
}

export async function* chatWithOllamaStream(
  history: OllamaMessage[],
  model = OLLAMA_MODELS.reasoning,
): AsyncGenerator<OllamaStreamChunk> {
  if (!isReasoningModel(model)) {
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: history,
        stream: true,
      } as OllamaChatRequest),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let fullThinking = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as OllamaChatResponse;
          let changed = false;
          if (chunk.message?.thinking) {
            fullThinking += chunk.message.thinking;
            changed = true;
          }
          if (chunk.message?.content) {
            fullContent += chunk.message.content;
            changed = true;
          }
          if (changed) {
            yield { content: fullContent, thinking: fullThinking };
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return;
  }

  const response = await fetch(`${LLAMA_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history,
      stream: true,
      cache_prompt: true,
    } as LlamaChatRequest),
  });

  if (!response.ok) {
    throw new Error(`llama.cpp error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullRaw = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload) as LlamaChatChunk;
        const deltaText = chunk.choices?.[0]?.delta?.content ?? "";
        const deltaReasoning = chunk.choices?.[0]?.delta?.reasoning_content ?? "";
        if (!deltaText && !deltaReasoning) continue;
        fullRaw += `${deltaReasoning}${deltaText}`;
        const parsed = extractThinkingBlock(fullRaw);
        yield {
          content: parsed.content,
          thinking: parsed.thinking,
        };
      } catch {
        // Skip malformed chunk
      }
    }
  }
}
