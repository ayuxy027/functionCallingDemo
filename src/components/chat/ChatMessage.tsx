import { cn } from "@/lib/utils";
import { User, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

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

function ToolAccordion({ toolSteps }: { toolSteps: ToolStepData[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!toolSteps || toolSteps.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/30 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-3 w-3 text-foreground/50" />
          ) : (
            <ChevronRight className="h-3 w-3 text-foreground/50" />
          )}
          <span className="text-[11px] font-medium text-foreground/70">
            Used {toolSteps.length} tool{toolSteps.length > 1 ? "s" : ""}
          </span>
          <span className="text-[10px] text-foreground/40 font-mono">
            {toolSteps.map(t => t.toolName).join(", ")}
          </span>
        </div>
        <span className="text-[10px] text-foreground/30">
          {toolSteps.reduce((sum, t) => sum + (t.durationMs || 0), 0)}ms
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border/20">
          {toolSteps.map((tool, i) => (
            <div
              key={i}
              className="px-3 py-2 text-[11px] border-b border-border/10 last:border-b-0"
            >
              <div className="font-mono text-foreground/50 mb-1">
                [{tool.toolName}]
              </div>
              <div className="text-foreground/70 leading-relaxed">
                {tool.description}
              </div>
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

export function ChatGroupBlock({ group, isStreaming = false }: { group: ChatGroup; isStreaming?: boolean }) {
  return (
    <div className="animate-fade-in">
      {/* User message */}
      <div className="flex items-start gap-3 py-4">
        <Avatar role="user" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-foreground leading-relaxed">
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
            <div className="text-[14px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {group.assistantMessage.content}
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