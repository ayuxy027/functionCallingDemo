import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { ChatGroupBlock, type ChatMessageData, type ChatGroup, type ToolStepData } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { mockMessages } from "@/components/chat/mockData";
import { chatWithOllama, type OllamaMessage } from "@/lib/ollama";
import { executeAllTools, type ToolResult } from "@/lib/tools";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: ChatPage,
});

function groupMessages(messages: ChatMessageData[]): ChatGroup[] {
  const groups: ChatGroup[] = [];
  let i = 0;
  while (i < messages.length) {
    if (messages[i].role === "user") {
      const group: ChatGroup = {
        id: messages[i].id,
        userMessage: messages[i],
      };
      if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
        group.assistantMessage = messages[i + 1];
        i += 2;
      } else {
        i += 1;
      }
      groups.push(group);
    } else {
      // orphan assistant message — wrap it
      groups.push({
        id: messages[i].id,
        userMessage: { id: messages[i].id + "-empty", role: "user", content: "", timestamp: "" },
        assistantMessage: messages[i],
      });
      i += 1;
    }
  }
  return groups;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 py-5 animate-fade-in">
      <div className="shrink-0 h-7 w-7 rounded-full bg-foreground/[0.05] flex items-center justify-center">
        <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20 animate-[pulse_1.4s_ease-in-out_infinite]" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
    </div>
  );
}

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>(mockMessages);
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const toolStart = performance.now();
      const toolResults = await executeAllTools(text);
      const toolDuration = Math.round(performance.now() - toolStart);

      const contextInfo = toolResults
        .filter(t => t.status === "completed" && t.output !== "No results found")
        .map(t => `[${t.toolName}] ${t.output}`)
        .join("\n\n");

      const systemPrompt = contextInfo
        ? `You are a regulatory compliance assistant. Use the following reference data to answer accurately:\n\n${contextInfo}\n\nIf the reference data answers the question, cite it. Otherwise, say you don't know.`
        : "";

      const currentHistory: OllamaMessage[] = messages
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      
      if (systemPrompt) {
        currentHistory.unshift({ role: "system", content: systemPrompt });
      }
      currentHistory.push({ role: "user", content: text });

      const llmStart = performance.now();
      const response = await chatWithOllama(currentHistory);
      const llmDuration = Math.round(performance.now() - llmStart);
      const totalDuration = toolDuration + llmDuration;

      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        toolSteps: [
          ...toolResults.map((t): ToolStepData => ({
            id: crypto.randomUUID(),
            toolName: t.toolName,
            status: t.status as "completed" | "failed",
            description: `Searched data for: ${t.input}`,
            detail: t.output.slice(0, 200) + (t.output.length > 200 ? "..." : ""),
            durationMs: t.durationMs,
          })),
          {
            id: crypto.randomUUID(),
            toolName: "ollama_chat",
            status: "completed",
            description: "Query sent to local Gemma 4 model via Ollama",
            detail: `{\n  "model": "gemma4:e2b",\n  "context_used": ${contextInfo ? "yes" : "no"},\n  "latency_ms": ${llmDuration}\n}`,
            durationMs: llmDuration,
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error connecting to Ollama: ${error instanceof Error ? error.message : "Unknown error"}. Make sure Ollama is running locally.`,
        toolSteps: [
          {
            id: crypto.randomUUID(),
            toolName: "ollama_chat",
            status: "failed",
            description: "Failed to connect to local Ollama instance",
            detail: '{\n  "error": "connection_failed",\n  "url": "http://localhost:11434"\n}',
            durationMs: 0,
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsThinking(false);
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 flex items-center gap-3">
        <div className="h-7 w-7 rounded-lg bg-foreground/[0.06] flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
        </div>
        <div>
          <h1 className="text-[13px] font-semibold text-foreground tracking-tight leading-none">Agent Chat</h1>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">Reasoning trace & tool usage</p>
        </div>
      </header>

      <div className="h-px bg-border/40" />

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-6 py-4">
          {groups.map((group, i) => (
            <div key={group.id}>
              {i > 0 && <div className="h-px bg-border/30 my-2" />}
              <ChatGroupBlock group={group} />
            </div>
          ))}
          {isThinking && (
            <>
              <div className="h-px bg-border/30 my-2" />
              <ThinkingIndicator />
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <div className="h-px bg-border/40" />
      <footer className="shrink-0 px-6 py-4">
        <ChatInput onSend={handleSend} disabled={isThinking} />
      </footer>
    </div>
  );
}
