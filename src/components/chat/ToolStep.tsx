import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Check, Loader2, X, Wrench } from "lucide-react";

export interface ToolStepData {
  id: string;
  toolName: string;
  status: "running" | "completed" | "failed";
  description: string;
  detail: string;
  durationMs?: number;
}

function StatusIcon({ status }: { status: ToolStepData["status"] }) {
  if (status === "running") {
    return (
      <div className="h-5 w-5 rounded-full bg-tool-running/15 flex items-center justify-center">
        <Loader2 className="h-3 w-3 text-tool-running animate-spin" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="h-5 w-5 rounded-full bg-tool-failed/15 flex items-center justify-center">
        <X className="h-3 w-3 text-tool-failed" />
      </div>
    );
  }
  return (
    <div className="h-5 w-5 rounded-full bg-tool-success/12 flex items-center justify-center">
      <Check className="h-3 w-3 text-tool-success" strokeWidth={2.5} />
    </div>
  );
}

export function ToolStepItem({ step, index }: { step: ToolStepData; index: number }) {
  return (
    <div
      className="animate-tool-step-in"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Accordion type="single" collapsible>
        <AccordionItem value={step.id} className="border-none">
          <AccordionTrigger className="py-2.5 px-3 rounded-xl hover:bg-surface/80 hover:no-underline gap-3 text-[12px] transition-colors duration-200">
            <span className="flex items-center gap-3 min-w-0 flex-1">
              <StatusIcon status={step.status} />
              <span className="flex flex-col items-start gap-0.5 min-w-0">
                <code className="font-mono text-[11.5px] font-semibold text-foreground/70 truncate leading-none">
                  {step.toolName}
                </code>
                <span className="text-[10.5px] text-muted-foreground/60 leading-none truncate max-w-[300px]">
                  {step.description.length > 60 ? step.description.slice(0, 60) + "…" : step.description}
                </span>
              </span>
              {step.durationMs !== undefined && (
                <span className="text-[10px] text-muted-foreground/40 tabular-nums ml-auto mr-1 font-mono">
                  {step.durationMs}ms
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3 pt-0.5 pb-3">
            <div className="ml-8 space-y-2.5">
              <p className="text-[12px] text-muted-foreground leading-[1.65]">
                {step.description}
              </p>
              <div className="relative">
                <pre className="text-[11px] leading-[1.7] bg-surface/60 border border-border/40 rounded-xl px-4 py-3 whitespace-pre-wrap text-surface-foreground font-mono overflow-x-auto">
                  {step.detail}
                </pre>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function ToolUsageCard({ steps }: { steps: ToolStepData[] }) {
  const totalMs = steps.reduce((sum, s) => sum + (s.durationMs || 0), 0);

  return (
    <div className="animate-tool-card-in rounded-2xl border border-border/40 bg-surface-elevated overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border/30">
        <div className="h-6 w-6 rounded-lg bg-surface flex items-center justify-center">
          <Wrench className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold text-foreground/75 leading-none">
            {steps.length} tool{steps.length > 1 ? "s" : ""} used
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/40 tabular-nums font-mono">
          {totalMs}ms
        </span>
      </div>

      {/* Steps */}
      <div className="px-1.5 py-1.5 space-y-0">
        {steps.map((step, i) => (
          <ToolStepItem key={step.id} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}
