import { cn } from "@/lib/utils";
import { ToolUsageCard, type ToolStepData } from "./ToolStep";
import { User, Sparkles } from "lucide-react";

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
        "shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300",
        role === "user"
          ? "bg-foreground/[0.06]"
          : "bg-foreground/[0.04]"
      )}
    >
      {role === "user" ? (
        <User className="h-4 w-4 text-foreground/40" strokeWidth={1.8} />
      ) : (
        <Sparkles className="h-4 w-4 text-foreground/35" strokeWidth={1.8} />
      )}
    </div>
  );
}

export function ChatGroupBlock({ group, index }: { group: ChatGroup; index: number }) {
  const baseDelay = index * 120;

  return (
    <div className="space-y-0">
      {/* User query */}
      <div
        className="flex items-start gap-4 pt-8 pb-6 animate-message-in"
        style={{ animationDelay: `${baseDelay}ms` }}
      >
        <Avatar role="user" />
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-[14px] font-medium text-foreground leading-[1.65] tracking-[-0.01em]">
            {group.userMessage.content}
          </p>
        </div>
      </div>

      {/* Assistant response */}
      {group.assistantMessage && (
        <div className="flex items-start gap-4 pb-6">
          <Avatar role="assistant" />
          <div className="min-w-0 flex-1 pt-1 space-y-4">
            {/* Tool steps */}
            {group.assistantMessage.toolSteps && group.assistantMessage.toolSteps.length > 0 && (
              <div style={{ animationDelay: `${baseDelay + 200}ms` }}>
                <ToolUsageCard steps={group.assistantMessage.toolSteps} />
              </div>
            )}

            {/* Response text */}
            <div
              className="animate-response-in"
              style={{ animationDelay: `${baseDelay + 400}ms` }}
            >
              <p className="text-[14px] text-foreground/80 leading-[1.75] tracking-[-0.005em]">
                {group.assistantMessage.content}
              </p>
              <p className="text-[10px] text-muted-foreground/30 mt-3 tabular-nums font-mono">
                {group.assistantMessage.timestamp}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
