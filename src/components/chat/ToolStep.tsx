import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Check, Loader2, X, ChevronRight } from "lucide-react";

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
    return <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />;
  }
  if (status === "failed") {
    return <X className="h-3 w-3 text-red-400" />;
  }
  return <Check className="h-3 w-3 text-emerald-500/70" />;
}

export function ToolStep({ step }: { step: ToolStepData }) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value={step.id} className="border-none">
        <AccordionTrigger className="py-2 px-2.5 rounded-lg hover:bg-foreground/[0.03] hover:no-underline gap-2 text-xs group [&[data-state=open]>svg]:rotate-0 [&[data-state=open]>.chevron-icon]:rotate-90">
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <StatusIcon status={step.status} />
            <code className="font-mono text-[11px] font-medium text-foreground/65 truncate">
              {step.toolName}
            </code>
            {step.durationMs !== undefined && (
              <span className="text-[10px] text-muted-foreground/50 tabular-nums ml-auto mr-1">
                {step.durationMs}ms
              </span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-2.5 pt-0 pb-2">
          <div className="ml-5 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {step.description}
            </p>
            <pre className="text-[10.5px] leading-[1.6] bg-foreground/[0.03] border border-border/30 rounded-lg px-3 py-2.5 whitespace-pre-wrap text-foreground/55 font-mono overflow-x-auto">
              {step.detail}
            </pre>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
