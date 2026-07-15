import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  Trash2,
  X,
  Mic,
  Languages,
  History,
  Plus,
  ChevronDown,
  ChevronUp,
  Info,
  BookmarkPlus,
  Sparkles,
  BadgeCheck,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import { MockCoachProvider, buildContext, type CoachProvider } from "@/lib/coach-provider";
import type { CoachResponse } from "@/lib/coach-prompts";
import {
  clearHistory,
  groupMessages,
  loadHistory,
  saveAdvice,
  saveHistory,
  type ChatMessage,
} from "@/lib/coach-history";
import {
  buildProactiveInsight,
  buildSmartSuggestions,
  computeSnapshot,
  personalizedGreeting,
  QUICK_ACTIONS,
} from "@/lib/coach-suggestions";
import { getLanguage, setLanguage, t, type CoachLanguage } from "@/lib/coach-language";

type Props = {
  analysisInput: CoachAnalysisInput | null;
  provider?: CoachProvider;
  onGoToAnalyze?: () => void;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CoachChatSheet({ analysisInput, provider = MockCoachProvider, onGoToAnalyze }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingPhraseIdx, setLoadingPhraseIdx] = useState(0);
  const [lang, setLangState] = useState<CoachLanguage>("en");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => setLangState(getLanguage()), []);
  useEffect(() => setMessages(loadHistory()), []);
  useEffect(() => saveHistory(messages), [messages]);

  // Global open+ask hook for "Explain This Number" buttons across the app.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      setOpen(true);
      if (detail?.prompt) {
        // Defer to let sheet mount + provider/ctx settle.
        setTimeout(() => sendRef.current?.(detail.prompt!), 200);
      }
    };
    window.addEventListener("fintrackr:coach:ask", handler as EventListener);
    return () => window.removeEventListener("fintrackr:coach:ask", handler as EventListener);
  }, []);

  const ctx = useMemo(() => buildContext(analysisInput, lang), [analysisInput, lang]);
  const snapshot = useMemo(() => computeSnapshot(ctx.input, ctx.analysis), [ctx.input, ctx.analysis]);
  const greeting = useMemo(() => personalizedGreeting(lang, snapshot), [lang, snapshot]);
  const smartSuggestions = useMemo(
    () => buildSmartSuggestions(ctx.input, ctx.analysis),
    [ctx.input, ctx.analysis],
  );
  const proactive = useMemo(
    () => buildProactiveInsight(ctx.input, ctx.analysis),
    [ctx.input, ctx.analysis],
  );

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, sending]);

  const LOADING_PHRASES = useMemo(
    () => [t(lang, "thinking"), t(lang, "analyzing"), t(lang, "preparing")],
    [lang],
  );
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(() => setLoadingPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length), 900);
    return () => clearInterval(timer);
  }, [sending, LOADING_PHRASES.length]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || sending) return;
      const userMsg: ChatMessage = { id: uid(), role: "user", content: clean, createdAt: Date.now() };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setSending(true);
      setLoadingPhraseIdx(0);
      try {
        const reply = await provider.send(clean, ctx);
        const aiMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: reply.shortAnswer,
          response: reply,
          createdAt: Date.now(),
        };
        setMessages((m) => [...m, aiMsg]);
      } catch {
        setMessages((m) => [
          ...m,
          { id: uid(), role: "assistant", content: t(lang, "errorReply"), createdAt: Date.now() },
        ]);
      } finally {
        setSending(false);
      }
    },
    [provider, ctx, sending, lang],
  );

  const handleClear = () => {
    clearHistory();
    setMessages([]);
    setShowHistory(false);
  };

  const toggleLang = () => {
    const next: CoachLanguage = lang === "en" ? "ta" : "en";
    setLanguage(next);
    setLangState(next);
  };

  const groups = useMemo(() => groupMessages(messages), [messages]);
  const hasAnalysis = !!ctx.analysis;
  const showEmpty = !hasAnalysis && messages.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t(lang, "askAiCoach")}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[92vh] flex-col gap-0 rounded-t-2xl p-0 sm:max-w-lg sm:mx-auto"
        >
          {/* Header */}
          <SheetHeader className="flex-row items-start justify-between gap-2 border-b px-4 py-3 space-y-0">
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-1.5 text-base leading-tight">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{greeting.title}</span>
              </SheetTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{greeting.subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLang}
                className="h-8 px-2 text-xs"
                aria-label={t(lang, "language")}
                title={t(lang, "language")}
              >
                <Languages className="mr-1 h-3.5 w-3.5" />
                {lang.toUpperCase()}
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowHistory((v) => !v)}
                  aria-label={t(lang, "history")}
                >
                  <History className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
                aria-label={t(lang, "close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Snapshot */}
          {hasAnalysis && !showHistory && (
            <div className="border-b bg-muted/30 px-4 py-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t(lang, "snapshotTitle")}
              </p>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                <Stat label={t(lang, "survivalScore")} value={`${snapshot.survivalScore}`} />
                <Stat
                  label={t(lang, "safeDailySpend")}
                  value={snapshot.safeDailySpend !== null ? `₹${snapshot.safeDailySpend}` : "—"}
                />
                <Stat
                  label={t(lang, "currentBalance")}
                  value={
                    snapshot.currentBalance !== null
                      ? `₹${Math.round(snapshot.currentBalance / 1000)}k`
                      : "—"
                  }
                />
                <Stat label={t(lang, "daysUntilSalary")} value={`${snapshot.daysUntilSalary ?? "—"}`} />
                <Stat label={t(lang, "confidenceScore")} value={`${snapshot.confidenceScore ?? "—"}`} />
              </div>
            </div>
          )}

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {showHistory ? (
              <HistoryView
                groups={groups}
                onSelect={(m) => {
                  setShowHistory(false);
                  if (m.role === "user") send(m.content);
                }}
                lang={lang}
              />
            ) : showEmpty ? (
              <EmptyState
                lang={lang}
                onAnalyze={() => {
                  setOpen(false);
                  if (onGoToAnalyze) onGoToAnalyze();
                  else navigate({ to: "/insights/ai-coach" });
                }}
              />
            ) : (
              <div className="space-y-3">
                {messages.length === 0 && (
                  <>
                    {proactive && (
                      <div className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                            {t(lang, "proactiveTip")}
                          </p>
                          <p className="mt-0.5 leading-relaxed">{proactive}</p>
                        </div>
                      </div>
                    )}
                    <SuggestionsBlock
                      title={t(lang, "suggestedForYou")}
                      items={smartSuggestions}
                      onPick={send}
                    />
                  </>
                )}

                {messages.map((m) => (
                  <MessageRow
                    key={m.id}
                    message={m}
                    lang={lang}
                    onFollowUp={(label) => send(label)}
                    onSave={(msg) => {
                      saveAdvice(msg);
                      toast.success(t(lang, "saved"));
                    }}
                    onNavPlanner={() => {
                      setOpen(false);
                      navigate({ to: "/planner" });
                    }}
                    onNavBudget={() => {
                      setOpen(false);
                      navigate({ to: "/budgets" });
                    }}
                  />
                ))}

                {sending && (
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <span className="inline-flex gap-1">
                      <Dot />
                      <Dot delay="0.15s" />
                      <Dot delay="0.3s" />
                    </span>
                    <span>{LOADING_PHRASES[loadingPhraseIdx]}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          {!showHistory && (
            <div className="border-t bg-background px-3 pb-3 pt-2">
              {/* Quick actions */}
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_ACTIONS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => send(chip)}
                    disabled={sending}
                    className="shrink-0 rounded-full border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={handleClear}
                    aria-label={t(lang, "newChat")}
                    title={t(lang, "newChat")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => toast(t(lang, "voiceSoon"))}
                  aria-label="Voice input"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="flex flex-1 items-center gap-2"
                >
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t(lang, "askPlaceholder")}
                    disabled={sending}
                    className="h-10 flex-1"
                    enterKeyHint="send"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || sending}
                    aria-label={t(lang, "send")}
                    className="h-10 w-10 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
              {messages.length > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    {t(lang, "clear")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-1.5 py-1.5">
      <p className="truncate text-[10px] leading-tight text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold leading-tight">{value}</p>
    </div>
  );
}

function SuggestionsBlock({
  title,
  items,
  onPick,
}: {
  title: string;
  items: string[];
  onPick: (q: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="text-left text-sm text-primary hover:underline"
            >
              • {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ lang, onAnalyze }: { lang: CoachLanguage; onAnalyze: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="font-display text-sm font-semibold">{t(lang, "emptyTitle")}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        {t(lang, "emptyBody")}
      </p>
      <Button size="sm" onClick={onAnalyze}>
        {t(lang, "analyzeSalary")}
      </Button>
    </div>
  );
}

function HistoryView({
  groups,
  onSelect,
  lang,
}: {
  groups: ReturnType<typeof groupMessages>;
  onSelect: (m: ChatMessage) => void;
  lang: CoachLanguage;
}) {
  if (groups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t(lang, "history")} —</p>
    );
  }
  const labelMap: Record<string, string> = {
    Today: t(lang, "today"),
    Yesterday: t(lang, "yesterday"),
    "This Week": t(lang, "thisWeek"),
    Earlier: t(lang, "earlier"),
  };
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labelMap[g.label]}
          </p>
          <ul className="space-y-1">
            {g.messages
              .filter((m) => m.role === "user")
              .map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(m)}
                    className="w-full truncate rounded-lg border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {m.content}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MessageRow({
  message,
  lang,
  onFollowUp,
  onSave,
  onNavPlanner,
  onNavBudget,
}: {
  message: ChatMessage;
  lang: CoachLanguage;
  onFollowUp: (q: string) => void;
  onSave: (m: ChatMessage) => void;
  onNavPlanner: () => void;
  onNavBudget: () => void;
}) {
  const isUser = message.role === "user";
  const [expanded, setExpanded] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const r: CoachResponse | undefined = message.response;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground",
        )}
      >
        {renderInline(message.content)}

        {!isUser && r && (
          <div className="mt-2 space-y-2">
            {expanded && (
              <div className="space-y-1.5 rounded-lg bg-background/60 p-2 text-xs">
                <div>
                  <span className="font-semibold">{t(lang, "why")}: </span>
                  {r.why}
                </div>
                <div>
                  <span className="font-semibold">{t(lang, "action")}: </span>
                  {r.action}
                </div>
                {r.monthlyImpact && (
                  <div>
                    <span className="font-semibold">{t(lang, "impact")}: </span>
                    {r.monthlyImpact}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <BadgeCheck className="h-3 w-3 text-primary" />
                  <span className="font-semibold">{t(lang, "confidence")}: </span>
                  <span className="capitalize">{t(lang, r.confidence)}</span>
                </div>
                {r.dataUsed.length > 0 && (
                  <div>
                    <span className="font-semibold">{t(lang, "basedOn")}: </span>
                    {r.dataUsed.map((d) => `✓ ${d}`).join("  ")}
                  </div>
                )}
              </div>
            )}
            {showCalc && r.calculation && (
              <div className="rounded-lg bg-background/60 p-2 font-mono text-[11px]">
                {r.calculation}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              <FollowBtn onClick={() => setExpanded((v) => !v)}>
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t(lang, "explainMore")}
              </FollowBtn>
              {r.calculation && (
                <FollowBtn onClick={() => setShowCalc((v) => !v)}>{t(lang, "showCalc")}</FollowBtn>
              )}
              <FollowBtn onClick={onNavPlanner}>{t(lang, "applyPlanner")}</FollowBtn>
              <FollowBtn onClick={onNavBudget}>{t(lang, "createBudget")}</FollowBtn>
              <FollowBtn onClick={() => onSave(message)}>
                <BookmarkPlus className="h-3 w-3" />
                {t(lang, "saveAdvice")}
              </FollowBtn>
            </div>
            {r.confidence === "low" && (
              <button
                type="button"
                onClick={() => onFollowUp("Explain more")}
                className="text-[11px] text-muted-foreground underline"
              >
                {t(lang, "explainMore")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FollowBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}

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
