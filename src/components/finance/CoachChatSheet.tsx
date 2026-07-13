import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Trash2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import {
  buildContext,
  clearHistory,
  EXAMPLE_QUESTIONS,
  loadHistory,
  MockChatProvider,
  saveHistory,
  SUGGESTED_CHIPS,
  WELCOME_MESSAGE,
  type ChatMessage,
  type ChatProvider,
} from "@/lib/coach-chat";

type Props = {
  analysisInput: CoachAnalysisInput | null;
  provider?: ChatProvider;
};

const LOADING_PHRASES = ["Thinking...", "Analyzing your finances...", "Preparing advice..."];

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CoachChatSheet({ analysisInput, provider = MockChatProvider }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctx = useMemo(() => buildContext(analysisInput), [analysisInput]);

  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    // scroll to bottom on new messages
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, sending]);

  useEffect(() => {
    if (!sending) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % LOADING_PHRASES.length;
      setLoadingPhrase(LOADING_PHRASES[i]);
    }, 900);
    return () => clearInterval(t);
  }, [sending]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: clean, createdAt: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    setLoadingPhrase(LOADING_PHRASES[0]);
    try {
      const reply = await provider.send(clean, ctx, [...messages, userMsg]);
      const aiMsg: ChatMessage = { id: uid(), role: "assistant", content: reply, createdAt: Date.now() };
      setMessages((m) => [...m, aiMsg]);
    } catch {
      const aiMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "Sorry, I couldn't process that just now. Please try again.",
        createdAt: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    clearHistory();
    setMessages([]);
  };

  const showWelcome = messages.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask AI"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[85vh] flex-col gap-0 rounded-t-2xl p-0 sm:max-w-lg sm:mx-auto"
        >
          <SheetHeader className="flex-row items-center justify-between gap-2 border-b px-4 py-3 space-y-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Ask AI Coach
            </SheetTitle>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-8 px-2 text-xs text-muted-foreground"
                  aria-label="Clear chat"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {showWelcome ? (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5 text-sm leading-relaxed">
                  {WELCOME_MESSAGE}
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3 py-2.5">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Try asking
                  </p>
                  <ul className="space-y-1">
                    {EXAMPLE_QUESTIONS.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => send(q)}
                          className="text-left text-sm text-primary hover:underline"
                        >
                          • {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                {!analysisInput && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Tip: run an Analysis first for personalized answers.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {sending && (
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <span className="inline-flex gap-1">
                      <Dot />
                      <Dot delay="0.15s" />
                      <Dot delay="0.3s" />
                    </span>
                    <span>{loadingPhrase}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t bg-background px-3 pb-3 pt-2">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUGGESTED_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => send(c)}
                  disabled={sending}
                  className="shrink-0 rounded-full border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your money..."
                disabled={sending}
                className="h-10 flex-1"
                enterKeyHint="send"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || sending}
                aria-label="Send"
                className="h-10 w-10 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground",
        )}
      >
        {renderInline(message.content)}
      </div>
    </div>
  );
}

// Minimal **bold** renderer to keep dep-free.
function renderInline(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((seg, i) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold">
            {seg.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{seg}</span>;
    });
    return (
      <span key={idx}>
        {parts}
        {idx < lines.length - 1 && <br />}
      </span>
    );
  });
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  );
}
