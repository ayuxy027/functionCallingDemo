import { cn } from "@/lib/utils";
import { User, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface ToolStepData {
  id: string;
  toolName: string;
  status: "completed" | "failed";
  description: string;
  detail: string;
  durationMs?: number;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolSteps?: ToolStepData[];
  timestamp: string;
}

export interface ChatGroup {
  id: string;
  userMessage: ChatMessageData;
  assistantMessage?: ChatMessageData;
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
        role === "user"
          ? "bg-foreground/[0.08]"
          : "bg-foreground/[0.05]"
      )}
    >
      {role === "user" ? (
        <User className="h-4 w-4 text-foreground/50" />
      ) : (
        <Sparkles className="h-4 w-4 text-foreground/40" />
      )}
    </div>
  );
}

export function ToolAccordion({
  toolSteps,
  defaultOpen = false,
  title,
}: {
  toolSteps?: ToolStepData[];
  defaultOpen?: boolean;
  title?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!toolSteps || toolSteps.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-card/80">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-3 w-3 text-foreground/50" />
          ) : (
            <ChevronRight className="h-3 w-3 text-foreground/50" />
          )}
          <span className="text-[11px] font-medium text-foreground/70">
            {title ?? `Used ${toolSteps.length} tool${toolSteps.length > 1 ? "s" : ""}`}
          </span>
          <span className="text-[10px] text-foreground/40 font-mono truncate max-w-[220px] text-left">
            {toolSteps.map((t) => t.toolName).join(", ")}
          </span>
        </div>
        <span className="text-[10px] text-foreground/30">
          {toolSteps.reduce((sum, t) => sum + (t.durationMs || 0), 0)}ms
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border/40">
          {toolSteps.map((tool, i) => (
            <div
              key={i}
              className="px-3 py-2.5 text-[11px] border-b border-border/20 last:border-b-0"
            >
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-mono text-foreground/60">[{tool.toolName}]</span>
                <span className={cn("text-[10px] uppercase tracking-wide", tool.status === "completed" ? "text-emerald-700" : "text-red-700")}>
                  {tool.status}
                </span>
              </div>
              <div className="text-foreground/70 leading-relaxed">
                {tool.description}
              </div>
              {tool.detail && (
                <pre className="mt-2 rounded-md border border-border/50 bg-background/80 p-2 text-[10px] text-foreground/60 whitespace-pre-wrap">
                  {tool.detail}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
      </div>
      <span className="text-[10px] text-foreground/30">thinking</span>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export function ChatGroupBlock({ group, isStreaming = false }: { group: ChatGroup; isStreaming?: boolean }) {
  return (
    <div className="animate-fade-in">
      {/* User message */}
      <div className="flex items-start gap-3 py-4">
        <Avatar role="user" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-foreground leading-relaxed whitespace-pre-wrap">
            {group.userMessage.content}
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-foreground/30 tabular-nums">
          {group.userMessage.timestamp}
        </span>
      </div>

      {/* Assistant message */}
      {group.assistantMessage && (
        <div className="flex items-start gap-3 pb-4">
          <Avatar role="assistant" />
          <div className="flex-1 min-w-0 space-y-2">
            {/* Tool accordion */}
            <ToolAccordion toolSteps={group.assistantMessage.toolSteps} />

            {/* Response with markdown */}
            <div className="text-[14px] text-foreground/80 leading-relaxed">
              <MarkdownContent content={group.assistantMessage.content} />
              {isStreaming && <StreamingIndicator />}
            </div>
          </div>
          <span className="shrink-0 text-[10px] text-foreground/30 tabular-nums">
            {group.assistantMessage.timestamp}
          </span>
        </div>
      )}
    </div>
  );
}
