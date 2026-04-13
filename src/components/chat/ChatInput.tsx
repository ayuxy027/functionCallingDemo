import { useState, type FormEvent, useRef, useEffect } from "react";
import { ArrowUp, Send } from "lucide-react";

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
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex items-end gap-2 rounded-xl border border-border/30 bg-foreground/[0.02] px-4 py-3 transition-all duration-200 focus-within:border-foreground/20 focus-within:bg-foreground/[0.04]">
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
          placeholder="Ask about regulations, FLDG caps, cooling off period..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-[14px] text-foreground placeholder:text-foreground/30 outline-none min-h-[24px] max-h-[120px] leading-relaxed"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="shrink-0 h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center transition-all duration-150 disabled:opacity-20 hover:opacity-80 active:scale-95"
        >
          <Send className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </form>
  );
}