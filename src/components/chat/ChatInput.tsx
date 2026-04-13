import { useState, type FormEvent, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [value]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[680px] mx-auto animate-slide-up-fade">
      <div className="flex items-end gap-3 rounded-2xl border border-border/40 bg-surface-elevated px-5 py-3.5 transition-all duration-300 focus-within:border-foreground/10 focus-within:shadow-[0_0_0_4px_oklch(0.5_0.01_260_/_0.04)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Ask something…"
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/35 outline-none min-h-[24px] max-h-[140px] leading-relaxed tracking-[-0.01em]"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="shrink-0 h-8 w-8 rounded-xl bg-foreground text-background flex items-center justify-center transition-all duration-200 disabled:opacity-10 hover:opacity-75 active:scale-90"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground/25 mt-3 tracking-wide">
        Mock responses — AI not connected
      </p>
    </form>
  );
}
