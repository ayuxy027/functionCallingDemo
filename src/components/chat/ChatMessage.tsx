import { cn } from "@/lib/utils";
import { ToolStep, type ToolStepData } from "./ToolStep";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolSteps?: ToolStepData[];
  timestamp: string;
}

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[640px] space-y-3",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Role label */}
        <p className={cn(
          "text-[11px] font-medium tracking-wide uppercase text-muted-foreground px-1",
          isUser && "text-right"
        )}>
          {isUser ? "You" : "Assistant"}
        </p>

        {/* Tool steps (assistant only) */}
        {!isUser && message.toolSteps && message.toolSteps.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-2 space-y-0.5">
            <p className="text-[11px] font-medium text-muted-foreground px-3 pt-1 pb-1.5 tracking-wide uppercase">
              Tool Usage — {message.toolSteps.length} step{message.toolSteps.length > 1 ? "s" : ""}
            </p>
            {message.toolSteps.map((step) => (
              <ToolStep key={step.id} step={step} />
            ))}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-foreground text-background rounded-br-md"
              : "bg-card border border-border/60 text-foreground rounded-bl-md"
          )}
        >
          {message.content}
        </div>

        {/* Timestamp */}
        <p className={cn(
          "text-[10px] text-muted-foreground/60 px-1 tabular-nums",
          isUser && "text-right"
        )}>
          {message.timestamp}
        </p>
      </div>
    </div>
  );
}
