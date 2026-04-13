import { useState, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[720px] mx-auto">
      <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors focus-within:border-border">
        <textarea
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
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none min-h-[24px] max-h-[120px] leading-relaxed"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="shrink-0 h-8 w-8 rounded-xl bg-foreground text-background flex items-center justify-center transition-opacity disabled:opacity-20"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
