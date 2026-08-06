import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Moon, Sun, MonitorSmartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/finance/PageHeader";
import { cn } from "@/lib/utils";
import { useAppearance } from "@/hooks/use-appearance";
import {
  ACCENTS,
  applyAppearance,
  getAppearance,
  type AppearancePreferences,
  type FontSize,
  type ThemeMode,
} from "@/lib/appearance";

export const Route = createFileRoute("/_authenticated/appearance")({
  component: AppearancePage,
  head: () => ({
    meta: [
      { title: "Appearance — FinTrackr" },
      { name: "description", content: "Choose theme, accent colour, font size and motion preferences for FinTrackr." },
      { property: "og:title", content: "Appearance — FinTrackr" },
      { property: "og:description", content: "Choose theme, accent colour, font size and motion preferences for FinTrackr." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/appearance" },
      { name: "twitter:title", content: "Appearance — FinTrackr" },
      { name: "twitter:description", content: "Choose theme, accent colour, font size and motion preferences for FinTrackr." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/appearance" }],
  }),
});

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System Default", icon: MonitorSmartphone },
];

const FONT_SIZES: { id: FontSize; label: string; sample: string }[] = [
  { id: "small", label: "Small", sample: "text-xs" },
  { id: "medium", label: "Medium (Default)", sample: "text-sm" },
  { id: "large", label: "Large", sample: "text-base" },
];

function AppearancePage() {
  const { prefs, save } = useAppearance();
  const [draft, setDraft] = useState<AppearancePreferences>(prefs);

  useEffect(() => setDraft(prefs), [prefs]);

  // Live preview: apply the draft to the document, revert on unmount if unsaved.
  useEffect(() => {
    applyAppearance(draft);
    return () => applyAppearance(getAppearance());
  }, [draft]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs);

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Appearance" subtitle="Theme, accent, text size and motion." />

      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:px-6 sm:py-6 md:px-10">
        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => {
                const Icon = t.icon;
                const active = draft.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, theme: t.id }))}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                      active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/40"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Accent Color</Label>
              <p className="mt-1 text-xs text-muted-foreground">Used for buttons, highlights and gradients.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => {
                const active = draft.accent === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-label={a.label}
                    onClick={() => setDraft((d) => ({ ...d, accent: a.id }))}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-all",
                      active && "ring-2 ring-primary"
                    )}
                    style={{ backgroundColor: a.swatch }}
                  >
                    {active && <Check className="h-4 w-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Font Size</Label>
            <div className="grid grid-cols-3 gap-2">
              {FONT_SIZES.map((f) => {
                const active = draft.fontSize === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, fontSize: f.id }))}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/40"
                    )}
                  >
                    <span className={cn("block font-semibold", f.sample)}>Aa</span>
                    <span className="mt-1 block text-[11px] leading-tight">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Reduce Animations</p>
              <p className="text-xs text-muted-foreground">Minimise transitions and motion effects.</p>
            </div>
            <Switch
              checked={draft.reduceAnimations}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, reduceAnimations: v }))}
            />
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live Preview</Label>
            <div className="rounded-xl border bg-card p-4">
              <p className="font-display text-lg font-bold">Salary Survival</p>
              <p className="mt-0.5 text-xs text-muted-foreground">This is how your app text will look.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" className="bg-gradient-primary">Primary</Button>
                <Button size="sm" variant="outline">Secondary</Button>
                <span className="rounded-full bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary">Highlight</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 pb-2">
          <Button
            className="flex-1 bg-gradient-primary"
            disabled={!dirty}
            onClick={() => { save(draft); toast.success("Appearance saved"); }}
          >
            Save changes
          </Button>
          <Button variant="outline" disabled={!dirty} onClick={() => setDraft(prefs)}>Reset</Button>
        </div>
      </div>
    </div>
  );
}
