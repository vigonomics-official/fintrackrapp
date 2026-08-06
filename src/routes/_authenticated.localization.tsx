import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/finance/PageHeader";
import { cn } from "@/lib/utils";
import { useLocalization } from "@/hooks/use-localization";
import { formatCurrency } from "@/lib/currency";
import {
  detectTimeZone,
  formatDate,
  LANGUAGES,
  SUPPORTED_CURRENCIES,
  type DateFormat,
  type NumberFormat,
} from "@/lib/localization";

export const Route = createFileRoute("/_authenticated/localization")({
  component: LocalizationPage,
  head: () => ({
    meta: [
      { title: "Currency & Localization — FinTrackr" },
      { name: "description", content: "Set your currency, date and number format, language and time zone in FinTrackr." },
      { property: "og:title", content: "Currency & Localization — FinTrackr" },
      { property: "og:description", content: "Set your currency, date and number format, language and time zone in FinTrackr." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/localization" },
      { name: "twitter:title", content: "Currency & Localization — FinTrackr" },
      { name: "twitter:description", content: "Set your currency, date and number format, language and time zone in FinTrackr." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/localization" }],
  }),
});

const DATE_FORMATS: DateFormat[] = ["DD/MM/YYYY", "MM/DD/YYYY"];

const NUMBER_FORMATS: { id: NumberFormat; label: string; sample: string }[] = [
  { id: "indian", label: "Indian", sample: "1,00,000" },
  { id: "international", label: "International", sample: "100,000" },
];

const TIME_ZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London",
  "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney",
];

function LocalizationPage() {
  const { prefs, update } = useLocalization();
  const detected = detectTimeZone();
  const autoTimeZone = prefs.timeZone == null;

  const saved = (msg: string) => toast.success(msg);

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Currency & Localization" subtitle="Currency, formats, language and time zone." />

      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:px-6 sm:py-6 md:px-10">
        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Currency</Label>
            <Select
              value={prefs.currency}
              onValueChange={(v) => { update({ currency: v }); saved("Currency updated"); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol.trim()} {c.code} — {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Preview: <span className="font-medium text-foreground">{formatCurrency(100000)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Date Format</Label>
            <div className="grid grid-cols-2 gap-2">
              {DATE_FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { update({ dateFormat: f }); saved("Date format updated"); }}
                  className={cn(
                    "rounded-xl border p-3 text-sm transition-colors",
                    prefs.dateFormat === f ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/40"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Today: <span className="font-medium text-foreground">{formatDate(new Date())}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Number Format</Label>
            <div className="grid grid-cols-2 gap-2">
              {NUMBER_FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { update({ numberFormat: f.id }); saved("Number format updated"); }}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    prefs.numberFormat === f.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/40"
                  )}
                >
                  <span className="block text-sm font-medium">{f.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{f.sample}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Language</Label>
            <Select
              value={prefs.language}
              onValueChange={(v) => { update({ language: v as typeof prefs.language }); saved("Language preference saved"); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Used by the AI Coach replies today; full app translation is rolling out.</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Auto-detect time zone</p>
                <p className="truncate text-xs text-muted-foreground">Detected: {detected}</p>
              </div>
              <Switch
                checked={autoTimeZone}
                onCheckedChange={(v) => { update({ timeZone: v ? null : detected }); saved("Time zone updated"); }}
              />
            </div>
            {!autoTimeZone && (
              <Select
                value={prefs.timeZone ?? detected}
                onValueChange={(v) => { update({ timeZone: v }); saved("Time zone updated"); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([detected, ...TIME_ZONES])).map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <p className="pb-2 text-center text-xs text-muted-foreground">Preferences save automatically and apply across the app.</p>
      </div>
    </div>
  );
}
