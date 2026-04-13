import { cn } from "@/lib/utils";
import { Sparkles, Search, Check, Loader2, X, FileText, Brain } from "lucide-react";

export interface ReasoningStepData {
  id: string;
  type: "thinking" | "tool_use" | "tool_result" | "responding";
  content: string;
  toolName?: string;
  status?: "pending" | "running" | "completed" | "failed";
}

interface ReasoningStreamProps {
  steps: ReasoningStepData[];
}

const typeConfig = {
  thinking: {
    icon: Brain,
    label: "Reasoning",
    bg: "bg-foreground/[0.03]",
    border: "border-border/30",
  },
  tool_use: {
    icon: Search,
    label: "Tool Call",
    bg: "bg-foreground/[0.05]",
    border: "border-border/40",
  },
  tool_result: {
    icon: FileText,
    label: "Result",
    bg: "bg-foreground/[0.04]",
    border: "border-border/35",
  },
  responding: {
    icon: Sparkles,
    label: "Response",
    bg: "bg-foreground/[0.03]",
    border: "border-border/30",
  },
};

export function ReasoningStream({ steps }: ReasoningStreamProps) {
  if (steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden animate-fade-in">
      <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-border/30">
        <div className="flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-foreground/20" />
          <span className="h-1 w-1 rounded-full bg-foreground/20" />
          <span className="h-1 w-1 rounded-full bg-foreground/20" />
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">
          Chain of Thought
        </span>
        <span className="text-[10px] text-muted-foreground/50 ml-auto">
          {steps.length} steps
        </span>
      </div>
      <div className="divide-y divide-border/20">
        {steps.map((step, idx) => {
          const config = typeConfig[step.type];
          const Icon = config.icon;
          const isRunning = step.status === "running";

          return (
            <div
              key={step.id}
              className={cn(
                "px-3.5 py-3",
                config.bg,
                idx === steps.length - 1 && isRunning && "animate-pulse"
              )}
            >
              <div className="flex items-start gap-2.5">
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-0.5" />
                ) : step.status === "completed" ? (
                  <Check className="h-3.5 w-3.5 text-foreground mt-0.5" />
                ) : step.status === "failed" ? (
                  <X className="h-3.5 w-3.5 text-foreground mt-0.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-medium text-foreground/80">
                      {config.label}
                    </span>
                    {step.toolName && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        [{step.toolName}]
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {step.content}
                    {isRunning && (
                      <span className="inline-flex gap-0.5 ml-0.5">
                        <span className="h-1 w-1 rounded-full bg-foreground/40 animate-bounce" />
                        <span className="h-1 w-1 rounded-full bg-foreground/40 animate-bounce [animation-delay:0.15s]" />
                        <span className="h-1 w-1 rounded-full bg-foreground/40 animate-bounce [animation-delay:0.3s]" />
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}