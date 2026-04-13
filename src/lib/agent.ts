const OLLAMA_BASE = "http://localhost:11434";
const MODEL = "functiongemma";

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: Record<string, string>;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: {
        query: { type: "string"; description: string };
      };
      required: ["query"];
    };
  };
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "lookup",
      description: "Look up regulatory rules and guidelines by keyword. Use for specific terms like 'cooling off period', 'FLDG', 'consent', etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string"; description: "The keyword or phrase to search for in the regulatory data" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description: "Search across all regulatory data. Use when you need to find information but aren't sure of the exact keyword.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string"; description: "The search query / question" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Find exact matches for specific terms. Use when you need precise regulatory references.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string"; description: "The exact term to find" },
        },
        required: ["query"],
      },
    },
  },
];

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface StreamChunk {
  role: string;
  content: string;
  done: boolean;
  tool_calls?: ToolCall[];
}

export async function* streamChat(
  messages: OllamaMessage[],
  tools: ToolDefinition[] = AVAILABLE_TOOLS
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as StreamChunk;
        yield chunk;
        if (chunk.done) return;
      } catch {
        // Skip invalid JSON
      }
    }
  }
}

export async function chatWithFunctionGemma(
  messages: OllamaMessage[],
  tools: ToolDefinition[] = AVAILABLE_TOOLS
): Promise<{ content: string; toolCalls?: ToolCall[] }> {
  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      stream: false,
    } as OllamaChatRequest),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.message?.content || "",
    toolCalls: data.message?.tool_calls || [],
  };
}