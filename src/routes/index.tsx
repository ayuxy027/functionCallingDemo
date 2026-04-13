import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { ChatGroupBlock, ToolAccordion, type ChatMessageData, type ChatGroup, type ToolStepData } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { chatWithOllamaStream, type OllamaMessage } from "@/lib/ollama-stream";
import { executeAllTools } from "@/lib/tools-client";
import { Loader2, Command } from "lucide-react";

export const Route = createFileRoute("/")({
  component: ChatPage,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRandom<T>(options: T[]) {
  return options[Math.floor(Math.random() * options.length)];
}

function pickRandomDifferent(options: string[], previous: string) {
  if (options.length <= 1) return options[0] ?? "";
  let next = pickRandom(options);
  while (next === previous) {
    next = pickRandom(options);
  }
  return next;
}

function trimQuery(text: string) {
  const value = text.trim();
  return value.length <= 54 ? value : `${value.slice(0, 54)}...`;
}

function summarizeForThinking(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "No matching evidence yet.";

  const compact = cleaned
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ");

  const snippets = compact
    .split("→")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => (item.length > 110 ? `${item.slice(0, 110)}...` : item));

  if (snippets.length === 0) {
    return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact;
  }

  return snippets.join(" | ");
}

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
  const lastPlanningLine = useRef("");
  const lastToolLine = useRef("");
  const lastSynthesisLine = useRef("");

  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, cursorThinking]);

  const handleSend = useCallback(async (text: string) => {
    const query = trimQuery(text);

    const planningLines = [
      `Checking policy corpus for: "${query}"`,
      `Scanning guidance notes linked to "${query}"`,
      `Mapping your question to relevant RBI clauses`,
      `Finding exact rule text before answering`,
    ];

    const toolRunLines = [
      (toolName: string) => `Running ${toolName} to fetch direct evidence...`,
      (toolName: string) => `Evaluating ${toolName} results for grounded context...`,
      (toolName: string) => `Pulling citation snippets from ${toolName}...`,
      (toolName: string) => `Cross-checking ${toolName} output with your question...`,
    ];

    const synthesisLines: Array<(count: number) => string> = [
      (count: number) => `Synthesizing ${count} tool result${count > 1 ? "s" : ""} into one clear response...`,
      (count: number) => `Drafting answer from ${count} evidence block${count > 1 ? "s" : ""}...`,
      (_count: number) => "Finalizing structured response with cited points...",
      (_count: number) => "Preparing concise answer and compliance notes...",
    ];

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
      const nextPlanning = pickRandomDifferent(planningLines, lastPlanningLine.current);
      lastPlanningLine.current = nextPlanning;
      setCursorThinking(nextPlanning);
      await sleep(280 + Math.round(Math.random() * 320));

      const toolResults = await executeAllTools(text);
      const currentToolSteps = toolResults.map((t): ToolStepData => ({
        id: crypto.randomUUID(),
        toolName: t.toolName,
        status: t.status,
        description: summarizeForThinking(t.output),
        detail: t.output,
        durationMs: t.durationMs,
      }));

      setActiveTools([]);
      for (const step of currentToolSteps) {
        const toolLineOptions = toolRunLines.map((lineFactory) => lineFactory(step.toolName));
        const line = pickRandomDifferent(toolLineOptions, lastToolLine.current);
        lastToolLine.current = line;
        setCursorThinking(line);
        setActiveTools((prev) => [...prev, step]);
        await sleep(180 + Math.round(Math.random() * 260));

        const seenLine = `Observed: ${step.description}`;
        setCursorThinking(seenLine);
        await sleep(180 + Math.round(Math.random() * 240));
      }

      const synthesisOptions = synthesisLines.map((lineFactory) => lineFactory(toolResults.length));
      const nextSynthesis = pickRandomDifferent(synthesisOptions, lastSynthesisLine.current);
      lastSynthesisLine.current = nextSynthesis;
      setCursorThinking(nextSynthesis);
      await sleep(220 + Math.round(Math.random() * 260));

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

      setCursorThinking("");

      let fullContent = "";
      for await (const chunk of chatWithOllamaStream(currentHistory)) {
        fullContent = chunk;
        setStreamingContent(fullContent);
      }

      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        toolSteps: currentToolSteps,
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
      <header className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[14px] font-semibold text-foreground">Cognizant Agent</h1>
            <p className="text-[11px] text-foreground/50">Tool-aware compliance copilot</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-2.5 py-1">
          <Command className="h-3 w-3 text-foreground/45" />
          <span className="text-[11px] text-foreground/50">Cursor-style workflow</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center rounded-3xl border border-border/50 bg-card/70 backdrop-blur-sm px-8">
              <p className="text-[17px] text-foreground/80 mb-2">Ask anything about lending regulations</p>
              <p className="text-[12px] text-foreground/45">Try: "What is the FLDG cap?" or "Cooling-off breach checks"</p>
            </div>
          ) : (
            groups.map((group, i) => (
              <div key={group.id}>
                {i > 0 && <div className="h-px bg-border/20 my-2" />}
                <ChatGroupBlock group={group} isStreaming={isStreaming && i === groups.length - 1} />
              </div>
            ))
          )}

          {isThinking && (
            <>
              <div className="h-px bg-border/20 my-2" />
              <div className="flex items-start gap-3 py-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
                <div className="flex-1">
                  {cursorThinking && (
                    <p className="text-[12px] text-foreground/50 mb-2 text-shimmer">
                      {cursorThinking}
                    </p>
                  )}

                  {activeTools.length > 0 && (
                    <div className="mb-3">
                      <ToolAccordion
                        toolSteps={activeTools}
                        defaultOpen
                        title="Tool discovery"
                      />
                    </div>
                  )}

                  {streamingContent && (
                    <div className="text-[14px] text-foreground/75 leading-relaxed whitespace-pre-wrap rounded-xl border border-border/40 bg-card/80 px-4 py-3 shadow-sm">
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

      <footer className="shrink-0 px-6 py-4 border-t border-border/40 bg-card/60 backdrop-blur-xl">
        <ChatInput onSend={handleSend} disabled={isThinking} />
      </footer>
    </div>
  );
}
