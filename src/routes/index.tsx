import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState } from "react";
import { ChatMessage, type ChatMessageData } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { mockMessages } from "@/components/chat/mockData";

export const Route = createFileRoute("/")({
  component: ChatPage,
});

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>(mockMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text: string) => {
    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Mock assistant reply after a short delay
    setTimeout(() => {
      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "This is a mock response. Once AI is plugged in, real tool usage and responses will appear here.",
        toolSteps: [
          {
            id: crypto.randomUUID(),
            toolName: "thinking",
            status: "completed",
            description: "The model processed your query and prepared a response.",
            detail: '{\n  "tokens_used": 142,\n  "model": "gpt-4o",\n  "latency_ms": 820\n}',
            durationMs: 820,
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border/40 px-6 py-4">
        <h1 className="text-sm font-semibold text-foreground tracking-tight">Agent Chat</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Tool usage and reasoning trace</p>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-6 py-8 space-y-8">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="shrink-0 border-t border-border/40 px-6 py-4">
        <ChatInput onSend={handleSend} />
      </footer>
    </div>
  );
}
