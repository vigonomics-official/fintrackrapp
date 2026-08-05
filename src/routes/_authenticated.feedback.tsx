import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bug, Lightbulb, Star, Send, LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/finance/PageHeader";
import { APP_NAME, APP_VERSION, BUILD_NUMBER, DEVELOPER, SITE_URL } from "@/lib/app-info";
import { cn } from "@/lib/utils";

const TITLE = `Feedback — ${APP_NAME}`;
const DESC = `Report a bug, suggest a feature, rate ${APP_NAME} or contact support directly from the app.`;

export const Route = createFileRoute("/_authenticated/feedback")({
  component: FeedbackPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/feedback` },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/feedback` }],
  }),
});

type Kind = "bug" | "feature" | "general";

const KINDS: { value: Kind; label: string; icon: typeof Bug; hint: string }[] = [
  { value: "bug", label: "Report Bug", icon: Bug, hint: "What went wrong, and what did you expect?" },
  { value: "feature", label: "Suggest Feature", icon: Lightbulb, hint: "Describe the feature and why it helps you." },
  { value: "general", label: "Send Feedback", icon: Send, hint: "Tell us what you love or what feels off." },
];

function FeedbackPage() {
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);

  const active = KINDS.find((k) => k.value === kind)!;

  const mailto = (subject: string, body: string) =>
    `mailto:${DEVELOPER.feedbackEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const submit = () => {
    if (!message.trim()) {
      toast.error("Please add a few details first");
      return;
    }
    const body = `${message}\n\n---\n${APP_NAME} ${APP_VERSION} (build ${BUILD_NUMBER})`;
    window.location.href = mailto(`[${active.label}] ${APP_NAME}`, body);
    toast.success("Opening your email app…");
  };

  const submitRating = (value: number) => {
    setRating(value);
    toast.success(value >= 4 ? "Thanks for the love!" : "Thanks — tell us how we can improve.");
  };

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Feedback" subtitle="Bugs, ideas and support — all in one place." />

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 md:px-10">
        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => {
                const Icon = k.icon;
                const selected = kind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                      selected ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    <span className="text-[11px] font-medium leading-tight">{k.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-message">{active.hint}</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Type your message…"
              />
            </div>

            <Button className="w-full gap-2 bg-gradient-primary" onClick={submit}>
              <Send className="h-4 w-4" /> {active.label}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rate the App</h3>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                  onClick={() => submitRating(value)}
                  className="p-1"
                >
                  <Star className={cn("h-6 w-6", value <= rating ? "fill-primary text-primary" : "text-muted-foreground")} />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Your rating stays private and helps us prioritise work.</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4 sm:p-6">
            <a
              href={mailto(`Support request — ${APP_NAME}`, `Version ${APP_VERSION} (build ${BUILD_NUMBER})\n\n`)}
              className="flex items-center gap-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80">
                <LifeBuoy className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Contact Support</p>
                <p className="truncate text-xs text-muted-foreground">{DEVELOPER.supportEmail}</p>
              </div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
