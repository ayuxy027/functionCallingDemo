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
      i += 1;
    }
  }
  return groups;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-4 pt-8 pb-6 animate-message-in">
      <div className="shrink-0 h-8 w-8 rounded-full bg-foreground/[0.04] flex items-center justify-center">
        <Sparkles className="h-4 w-4 text-foreground/35 animate-thinking-pulse" strokeWidth={1.8} />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <span className="text-[12px] text-muted-foreground/40 mr-1">Thinking</span>
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15 animate-dot-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15 animate-dot-bounce" style={{ animationDelay: "160ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15 animate-dot-bounce" style={{ animationDelay: "320ms" }} />
      </div>
    </div>
  );
}

let idCounter = 100;
function makeId() {
  return "msg-" + (++idCounter);
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
      id: makeId(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    setTimeout(() => {
      const assistantMsg: ChatMessageData = {
        id: makeId(),
        role: "assistant",
        content: "This is a mock response. Once AI is connected, real tool usage and reasoning traces will appear here with full traceability of each decision the model makes.",
        toolSteps: [
          {
            id: makeId(),
            toolName: "analyze_query",
            status: "completed",
            description: "Parsed and analyzed the input query to determine intent and required capabilities.",
            detail: '{\n  "intent": "general_query",\n  "confidence": 0.94,\n  "requires_tools": true\n}',
            durationMs: 340,
          },
          {
            id: makeId(),
            toolName: "generate_response",
            status: "completed",
            description: "Generated a contextual response based on the analysis and available knowledge.",
            detail: '{\n  "model": "gpt-4o",\n  "tokens_in": 86,\n  "tokens_out": 142,\n  "latency_ms": 680\n}',
            durationMs: 680,
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setIsThinking(false);
      setMessages((prev) => [...prev, assistantMsg]);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="shrink-0 px-8 py-5 flex items-center gap-3.5">
        <div className="h-8 w-8 rounded-xl bg-surface flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] leading-none">
            Agent Chat
          </h1>
          <p className="text-[11px] text-muted-foreground/50 mt-1 tracking-[-0.01em]">
            Tool usage & reasoning trace
          </p>
        </div>
      </header>

      <div className="h-px bg-border/30 mx-6" />

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[700px] mx-auto px-8 pb-6">
          {groups.map((group, i) => (
            <div key={group.id}>
              {i > 0 && <div className="h-px bg-border/20 mx-4" />}
              <ChatGroupBlock group={group} index={i} />
            </div>
          ))}
          {isThinking && (
            <>
              <div className="h-px bg-border/20 mx-4" />
              <ThinkingIndicator />
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <div className="h-px bg-border/30 mx-6" />
      <footer className="shrink-0 px-8 py-5">
        <ChatInput onSend={handleSend} disabled={isThinking} />
      </footer>
    </div>
  );
}
