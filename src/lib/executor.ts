import { chatWithFunctionGemma, streamChat, AVAILABLE_TOOLS, type OllamaMessage, type ToolCall } from "./agent";
import { lookup, search, grep, type ToolResult } from "./tools";

export type ReasoningStep = {
  id: string;
  type: "thinking" | "tool_use" | "tool_result" | "responding";
  content: string;
  toolName?: string;
  status?: "pending" | "running" | "completed" | "failed";
};

const TOOL_MAP: Record<string, (query: string) => Promise<ToolResult>> = {
  lookup: lookup as any,
  search: search as any,
  grep: grep as any,
};

export async function* runAgenticWorkflow(
  userQuery: string,
  history: OllamaMessage[]
): AsyncGenerator<ReasoningStep> {
  const messages: OllamaMessage[] = [
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userQuery },
  ];

  // Step 1: Think - ask FunctionGemma what to do
  yield {
    id: crypto.randomUUID(),
    type: "thinking",
    content: "Analyzing query and determining best approach...",
    status: "running",
  };

  const decisionPrompt: OllamaMessage[] = [
    {
      role: "system",
      content: `You are a regulatory compliance assistant. Your task is to:
1. First, explain your reasoning step by step in <thinking> tags
2. If you need to look up information, use the available tools

When searching for regulatory information, always use a tool first before responding.
Only respond directly if the question is a simple greeting or thanks.

Available tools:
- lookup: For specific terms like "cooling off period", "FLDG cap", "recovery hours"
- search: For general questions about regulations
- grep: For exact keyword matches`,
    },
    ...messages,
  ];

  // Stream the thinking
  let fullResponse = "";
  let toolCalls: ToolCall[] = [];
  
  for await (const chunk of streamChat(decisionPrompt, AVAILABLE_TOOLS)) {
    if (chunk.content) {
      fullResponse += chunk.content;
      yield {
        id: crypto.randomUUID(),
        type: "thinking",
        content: chunk.content,
        status: "running",
      };
    }
    if (chunk.tool_calls) {
      toolCalls = chunk.tool_calls;
    }
  }

  // Step 2: If tool calls, execute them
  if (toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const query = toolCall.function.arguments.query || toolCall.function.arguments.q || userQuery;

      yield {
        id: crypto.randomUUID(),
        type: "tool_use",
        content: `Using ${toolName} to find: ${query}`,
        toolName,
        status: "running",
      };

      const toolFn = TOOL_MAP[toolName];
      let toolResult: ToolResult;

      if (toolFn) {
        toolResult = await toolFn(query);
      } else {
        toolResult = {
          toolName: toolName || "unknown",
          status: "failed",
          input: query,
          output: `Tool ${toolName} not found`,
          durationMs: 0,
          source: "data/",
        };
      }

      yield {
        id: crypto.randomUUID(),
        type: "tool_result",
        content: `Found: ${toolResult.output.slice(0, 300)}...`,
        toolName: toolResult.toolName,
        status: toolResult.status === "completed" ? "completed" : "failed",
      };

      // Step 3: Get final response with tool context
      yield {
        id: crypto.randomUUID(),
        type: "thinking",
        content: "Synthesizing answer with retrieved information...",
        status: "running",
      };

      const finalPrompt: OllamaMessage[] = [
        {
          role: "system",
          content: `You are a regulatory compliance assistant.
Based on the search results provided, answer the user's question accurately.
If the search found relevant rules, cite them in your response.
If no relevant rules found, say so honestly.`,
        },
        ...messages,
        { role: "assistant", content: fullResponse },
        {
          role: "tool",
          content: toolResult.output,
          tool_calls: toolCall ? [{ id: toolCall.id, function: { name: toolName, arguments: { query } } }] : undefined,
        } as OllamaMessage,
      ];

      for await (const chunk of streamChat(finalPrompt, [])) { // No tools on final pass
        if (chunk.content) {
          yield {
            id: crypto.randomUUID(),
            type: "responding",
            content: chunk.content,
            status: "completed",
          };
        }
      }
    }
  } else {
    // No tools needed - respond directly
    yield {
      id: crypto.randomUUID(),
      type: "responding",
      content: fullResponse || "I don't have enough information to answer that. Could you rephrase?",
      status: "completed",
    };
  }
}