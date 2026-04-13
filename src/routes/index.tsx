import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { ChatGroupBlock, type ChatMessageData, type ChatGroup, type ToolStepData } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { chatWithOllamaStream, type OllamaMessage } from "@/lib/ollama-stream";
import { executeAllTools } from "@/lib/tools-client";
import { Sparkles, Loader2 } from "lucide-react";

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

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolStepData[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [cursorThinking, setCursorThinking] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, cursorThinking]);

  const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    setActiveTools([]);
    setStreamingContent("");
    setCursorThinking("");

    try {
      // Cursor-style thinking
      setCursorThinking(`Let me search for "${text}"`);

      // Execute tools
      const toolResults = await executeAllTools(text);
      setActiveTools(toolResults.map((t): ToolStepData => ({
        id: crypto.randomUUID(),
        toolName: t.toolName,
        status: t.status,
        description: t.output.split("\n")[0].slice(0, 100),
        detail: t.output,
        durationMs: t.durationMs,
      })));

      setCursorThinking(`Analyzing ${toolResults.length} result(s)...`);

      // Build context
      const contextInfo = toolResults
        .filter(t => t.status === "completed")
        .map(t => `[${t.toolName}] ${t.output}`)
        .join("\n\n");

      const systemPrompt = contextInfo
        ? `Reference: ${contextInfo}\n\nProvide a clear, structured answer citing sources.`
        : "";

      const currentHistory: OllamaMessage[] = messages
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      
      if (systemPrompt) {
        currentHistory.unshift({ role: "system", content: systemPrompt });
      }
      currentHistory.push({ role: "user", content: text });

      // Clear thinking
      setCursorThinking("");
      
      // Stream response
      let fullContent = "";
      for await (const chunk of chatWithOllamaStream(currentHistory)) {
        fullContent = chunk;
        setStreamingContent(fullContent);
      }

      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        toolSteps: activeTools,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");
      setActiveTools([]);
    } catch (error) {
      setCursorThinking("");
      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Connection failed. Ensure Ollama is running on port 11434."}`,
        toolSteps: [{
          id: crypto.randomUUID(),
          toolName: "error",
          status: "failed",
          description: "Connection failed",
          detail: "{}",
          durationMs: 0,
        }],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsThinking(false);
      setCursorThinking("");
    }
  }, [messages]);

  const isStreaming = streamingContent.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 flex items-center gap-3 border-b border-border/20">
        <div className="h-8 w-8 rounded-lg bg-foreground/[0.05] flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-foreground/40" />
        </div>
        <div>
          <h1 className="text-[14px] font-semibold text-foreground">Agent Chat</h1>
          <p className="text-[11px] text-foreground/40">AI-powered regulatory assistant</p>
        </div>
      </header>

      {/* Main chat */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <Sparkles className="h-12 w-12 text-foreground/10 mb-4" />
              <p className="text-[15px] text-foreground/50 mb-2">Start a conversation</p>
              <p className="text-[12px] text-foreground/30">Ask about regulations, FLDG caps, cooling off period, etc.</p>
            </div>
          ) : (
            groups.map((group, i) => (
              <div key={group.id}>
                {i > 0 && <div className="h-px bg-border/10 my-2" />}
                <ChatGroupBlock group={group} isStreaming={isStreaming && i === groups.length - 1} />
              </div>
            ))
          )}
          
          {/* Thinking indicator */}
          {isThinking && (
            <>
              <div className="h-px bg-border/10 my-2" />
              <div className="flex items-start gap-3 py-4">
                <div className="h-8 w-8 rounded-full bg-foreground/[0.05] flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-foreground/40 animate-spin" />
                </div>
                <div className="flex-1">
                  {cursorThinking && (
                    <p className="text-[12px] text-foreground/40 mb-2">
                      {cursorThinking}
                    </p>
                  )}
                  
                  {/* Tool results */}
                  {activeTools.length > 0 && (
                    <div className="rounded-lg border border-border/20 overflow-hidden mb-3">
                      <div className="px-3 py-2 bg-foreground/[0.02] text-[11px] text-foreground/50">
                        Found {activeTools.length} result{activeTools.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                  
                  {/* Streaming content */}
                  {streamingContent && (
                    <div className="text-[14px] text-foreground/70 leading-relaxed whitespace-pre-wrap">
                      {streamingContent}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 px-6 py-4 border-t border-border/20">
        <ChatInput onSend={handleSend} disabled={isThinking} />
      </footer>
    </div>
  );
}