import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { ChatGroupBlock, type ChatMessageData, type ChatGroup, type ToolStepData } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ReasoningStream, type ReasoningStepData } from "@/components/chat/ReasoningStream";
import { mockMessages } from "@/components/chat/mockData";
import { chatWithOllamaStream, type OllamaMessage } from "@/lib/ollama-stream";
import { executeAllTools } from "@/lib/tools-client";
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
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStepData[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, reasoningSteps]);

  const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    setReasoningSteps([]);
    setStreamingContent("");

    try {
      // Step 1: Thinking
      const thinking: ReasoningStepData = {
        id: crypto.randomUUID(),
        type: "thinking",
        content: "Analyzing your query and planning approach...",
        status: "running",
      };
      setReasoningSteps([thinking]);

      // Step 2: Execute tools
      const toolResults = await executeAllTools(text);
      const toolStep: ReasoningStepData = {
        id: crypto.randomUUID(),
        type: "tool_use",
        content: `Searching regulatory data for relevant information...`,
        toolName: toolResults[0]?.toolName || "search",
        status: "running",
      };
      setReasoningSteps(prev => [...prev, toolStep]);

      // Get context from tools
      const contextInfo = toolResults
        .filter(t => t.status === "completed" && t.output !== "No results found")
        .map(t => `[${t.toolName}] ${t.output}`)
        .join("\n\n");

      const resultStep: ReasoningStepData = {
        id: crypto.randomUUID(),
        type: "tool_result",
        content: contextInfo 
          ? `Found ${toolResults.length} relevant rule(s) in the data`
          : "No specific rules found - responding from knowledge",
        status: contextInfo ? "completed" : "completed",
      };
      setReasoningSteps(prev => [...prev, resultStep]);

      // Build context prompt
      const systemPrompt = contextInfo
        ? `You are a regulatory compliance assistant. Use this reference data to answer accurately:\n\n${contextInfo}\n\nCite the rules in your response when applicable.`
        : "";

      const currentHistory: OllamaMessage[] = messages
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      
      if (systemPrompt) {
        currentHistory.unshift({ role: "system", content: systemPrompt });
      }
      currentHistory.push({ role: "user", content: text });

      // Step 3: Stream response from LLM
      const respondStep: ReasoningStepData = {
        id: crypto.randomUUID(),
        type: "responding",
        content: "Generating response...",
        status: "running",
      };
      setReasoningSteps(prev => [...prev, respondStep]);

      let fullContent = "";
      for await (const chunk of chatWithOllamaStream(currentHistory)) {
        fullContent = chunk;
        setStreamingContent(fullContent);
      }

      // Complete
      setReasoningSteps(prev =>
        prev.map(s => s.status === "running" ? { ...s, status: "completed" as const } : s)
      );

      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        toolSteps: [
          ...toolResults.map((t): ToolStepData => ({
            id: crypto.randomUUID(),
            toolName: t.toolName,
            status: t.status as "completed" | "failed",
            description: `Executed ${t.toolName} for: ${t.input}`,
            detail: t.output.slice(0, 200) + (t.output.length > 200 ? "..." : ""),
            durationMs: t.durationMs,
          })),
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");
    } catch (error) {
      const errorStep: ReasoningStepData = {
        id: crypto.randomUUID(),
        type: "responding",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        status: "failed",
      };
      setReasoningSteps(prev => [...prev, errorStep]);

      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}. Make sure Ollama is running.`,
        toolSteps: [{
          id: crypto.randomUUID(),
          toolName: "error",
          status: "failed",
          description: "Failed to process query",
          detail: "{}",
          durationMs: 0,
        }],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsThinking(false);
      setStreamingContent("");
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="shrink-0 px-6 py-4 flex items-center gap-3">
        <div className="h-7 w-7 rounded-lg bg-foreground/[0.06] flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
        </div>
        <div>
          <h1 className="text-[13px] font-semibold text-foreground tracking-tight leading-none">Agent Chat</h1>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">Chain of Thought + Tool Execution</p>
        </div>
      </header>

      <div className="h-px bg-border/40" />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-6 py-4">
          {groups.map((group, i) => (
            <div key={group.id}>
              {i > 0 && <div className="h-px bg-border/30 my-2" />}
              <ChatGroupBlock group={group} />
            </div>
          ))}
          
          {(isThinking || reasoningSteps.length > 0) && (
            <>
              <div className="h-px bg-border/30 my-2" />
              <ReasoningStream steps={reasoningSteps} />
              {streamingContent && (
                <div className="mt-3 animate-fade-in">
                  <p className="text-[13px] text-foreground/85 leading-[1.7]">
                    {streamingContent}
                    <span className="inline-flex gap-0.5 ml-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 animate-bounce [animation-delay:0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 animate-bounce [animation-delay:0.3s]" />
                    </span>
                  </p>
                </div>
              )}
              {isThinking && !streamingContent && <ThinkingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <div className="h-px bg-border/40" />
      <footer className="shrink-0 px-6 py-4">
        <ChatInput onSend={handleSend} disabled={isThinking} />
      </footer>
    </div>
  );
}