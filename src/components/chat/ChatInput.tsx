import { useState, type FormEvent, useRef, useEffect } from "react";
import { Send } from "lucide-react";

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
      <div className="flex items-end gap-2 rounded-2xl border border-border/50 bg-card/80 px-3.5 py-2 shadow-sm transition-all duration-200">
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
          className="flex-1 resize-none bg-transparent text-[14px] text-foreground placeholder:text-foreground/35 outline-none min-h-[22px] max-h-[120px] leading-6"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="shrink-0 h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center transition-all duration-150 disabled:opacity-25 hover:brightness-95 active:scale-95"
        >
          <Send className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </form>
  );
}
