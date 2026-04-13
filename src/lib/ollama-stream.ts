const OLLAMA_BASE = "http://localhost:11434";

export const OLLAMA_MODELS = {
  reasoning: "deepseek-r1:1.5b",
  fast: "functiongemma:latest",
} as const;

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
}

interface OllamaChatResponse {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
}

export interface OllamaStreamChunk {
  content: string;
  thinking: string;
}

export async function chatWithOllama(
  history: OllamaMessage[],
  model = OLLAMA_MODELS.reasoning,
): Promise<string> {
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

export async function* chatWithOllamaStream(
  history: OllamaMessage[],
  model = OLLAMA_MODELS.reasoning,
): AsyncGenerator<OllamaStreamChunk> {
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
        const chunk = JSON.parse(line);
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
}
