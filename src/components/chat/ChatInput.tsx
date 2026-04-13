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
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
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
    <form onSubmit={handleSubmit} className="w-full max-w-[680px] mx-auto">
      <div className="flex items-end gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3 transition-all duration-200 focus-within:border-foreground/15 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.03)]">
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
          className="flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none min-h-[24px] max-h-[120px] leading-relaxed"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="shrink-0 h-7 w-7 rounded-lg bg-foreground text-background flex items-center justify-center transition-all duration-150 disabled:opacity-15 hover:opacity-80 active:scale-95"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground/35 mt-2.5">
        Mock responses only — AI not connected
      </p>
    </form>
  );
}
