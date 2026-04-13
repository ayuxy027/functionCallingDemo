import { cn } from "@/lib/utils";
import { User, Sparkles, Search, Check } from "lucide-react";

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
        "shrink-0 h-7 w-7 rounded-full flex items-center justify-center",
        role === "user"
          ? "bg-foreground/[0.07]"
          : "bg-foreground/[0.05]"
      )}
    >
      {role === "user" ? (
        <User className="h-3.5 w-3.5 text-foreground/50" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
      )}
    </div>
  );
}

export function ChatGroupBlock({ group }: { group: ChatGroup }) {
  return (
    <div className="animate-fade-in space-y-0">
      {/* User query */}
      <div className="flex items-start gap-3 py-5">
        <Avatar role="user" />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[13px] font-medium text-foreground leading-relaxed">
            {group.userMessage.content}
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground/50 tabular-nums pt-1">
          {group.userMessage.timestamp}
        </span>
      </div>

      {/* Assistant response */}
      {group.assistantMessage && (
        <div className="flex items-start gap-3 pb-2">
          <Avatar role="assistant" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            {/* Tool usage inline */}
            {group.assistantMessage.toolSteps && group.assistantMessage.toolSteps.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-foreground/50">
                <Search className="h-2.5 w-2.5" />
                <span className="font-medium">Using [{group.assistantMessage.toolSteps[0]?.toolName}]</span>
                <span className="text-foreground/30">•</span>
                <span>{group.assistantMessage.toolSteps[0]?.description}</span>
              </div>
            )}

            {/* Response text */}
            <p className="text-[13px] text-foreground/85 leading-[1.7]">
              {group.assistantMessage.content}
            </p>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground/50 tabular-nums pt-1">
            {group.assistantMessage.timestamp}
          </span>
        </div>
      )}
    </div>
  );
}