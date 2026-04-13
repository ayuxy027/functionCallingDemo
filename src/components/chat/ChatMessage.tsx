import { cn } from "@/lib/utils";
import { ToolStep, type ToolStepData } from "./ToolStep";
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
          <div className="min-w-0 flex-1 space-y-3 pt-0.5">
            {/* Tool steps */}
            {group.assistantMessage.toolSteps && group.assistantMessage.toolSteps.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                <div className="px-3.5 py-2.5 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {group.assistantMessage.toolSteps.map((_, i) => (
                      <span
                        key={i}
                        className="h-1 w-1 rounded-full bg-foreground/20"
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Used {group.assistantMessage.toolSteps.length} tool{group.assistantMessage.toolSteps.length > 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto tabular-nums">
                    {group.assistantMessage.toolSteps.reduce((sum, s) => sum + (s.durationMs || 0), 0)}ms total
                  </span>
                </div>
                <div className="border-t border-border/30 px-1.5 py-1">
                  {group.assistantMessage.toolSteps.map((step) => (
                    <ToolStep key={step.id} step={step} />
                  ))}
                </div>
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
