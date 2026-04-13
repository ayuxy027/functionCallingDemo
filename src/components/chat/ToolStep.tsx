import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export interface ToolStepData {
  id: string;
  toolName: string;
  status: "running" | "completed" | "failed";
  description: string;
  detail: string;
  durationMs?: number;
}

function StatusDot({ status }: { status: ToolStepData["status"] }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        status === "completed" && "bg-emerald-500",
        status === "running" && "bg-amber-400 animate-pulse",
        status === "failed" && "bg-red-400"
      )}
    />
  );
}

export function ToolStep({ step }: { step: ToolStepData }) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value={step.id} className="border-none">
        <AccordionTrigger className="py-2 px-3 rounded-lg hover:bg-muted/60 hover:no-underline gap-3 text-xs">
          <span className="flex items-center gap-2.5 min-w-0">
            <StatusDot status={step.status} />
            <span className="font-medium text-foreground/80 truncate">{step.toolName}</span>
            {step.durationMs !== undefined && (
              <span className="text-muted-foreground font-normal tabular-nums">{step.durationMs}ms</span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pt-1 pb-2">
          <p className="text-muted-foreground text-xs leading-relaxed mb-2">{step.description}</p>
          <pre className="text-[11px] leading-relaxed bg-muted/40 rounded-md px-3 py-2.5 whitespace-pre-wrap text-foreground/70 font-mono overflow-x-auto">
            {step.detail}
          </pre>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
