import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState, useMemo } from "react";
import { ChatGroupBlock, type ChatMessageData, type ChatGroup } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { mockMessages } from "@/components/chat/mockData";
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

  const handleSend = (text: string) => {
    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    setTimeout(() => {
      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "This is a mock response. Once AI is connected, real tool usage and reasoning will appear here with full traceability.",
        toolSteps: [
          {
            id: crypto.randomUUID(),
            toolName: "process_query",
            status: "completed",
            description: "Analyzed the input query and determined the appropriate response strategy.",
            detail: '{\n  "tokens_used": 142,\n  "model": "gpt-4o",\n  "latency_ms": 820\n}',
            durationMs: 820,
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setIsThinking(false);
      setMessages((prev) => [...prev, assistantMsg]);
    }, 1500);
  };

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
