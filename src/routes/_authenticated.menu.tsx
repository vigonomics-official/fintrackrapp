import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Wallet, Landmark, CalendarDays, Target, Bot, Bell,
  Upload, Download,
  Palette, Globe,
  Info, MessageSquare,
  MessageSquareText, Sparkles,
  ChevronRight, ChevronDown, LogOut, Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SalarySettingsSection } from "@/components/finance/SalarySettingsSection";
import { FinancialSnapshotCard } from "@/components/finance/FinancialSnapshotCard";
import { NotificationSettingsSection } from "@/components/finance/NotificationSettingsSection";
import { SmsIntelligenceStatusCard } from "@/components/finance/SmsIntelligenceStatusCard";
import { DataPrivacySection } from "@/components/finance/DataPrivacySection";

export const Route = createFileRoute("/_authenticated/menu")({
  component: MenuPage,
  head: () => ({
    meta: [
      { title: "Menu — FinTrackr" },
      { name: "description", content: "Jump to any FinTrackr feature from one place." },
      { property: "og:title", content: "Menu — FinTrackr" },
      { property: "og:description", content: "Jump to any FinTrackr feature from one place." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/menu" },
      { name: "twitter:title", content: "Menu — FinTrackr" },
      { name: "twitter:description", content: "Jump to any FinTrackr feature from one place." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/menu" }],
  }),
});

type Item = { label: string; icon: typeof Wallet; to?: string; badge?: string; description?: string; keywords?: string[]; anchor?: string };
type Group = { title: string; tone?: "smart" | "default"; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Smart Features",
    tone: "smart",
    items: [
      { label: "SMS Intelligence Status", icon: MessageSquareText, anchor: "section-sms-intelligence", description: "Permission, last sync & accuracy", keywords: ["sms", "upi", "auto detect", "messages", "permission", "sync", "accuracy"] },
      { label: "Smart Categorization", icon: Sparkles, to: "/smart-categorization", description: "Self-learning rules & merchants", keywords: ["rules", "merchant", "categories"] },
      
    ],
  },
  {
    title: "Financial Tools",
    items: [
      { label: "Loans & EMI", icon: Landmark, to: "/loans", keywords: ["loan", "emi", "debt", "bills"] },
      { label: "Planner", icon: CalendarDays, to: "/planner", keywords: ["planner", "bills", "future", "net worth"] },
      { label: "Goals", icon: Target, to: "/goals", keywords: ["goal", "savings target", "emergency fund"] },
      { label: "AI Coach", icon: Bot, to: "/insights/ai-coach", keywords: ["ai", "coach", "advice", "survival"] },
      { label: "Notifications", icon: Bell, to: "/notifications", keywords: ["reminder", "alerts", "notification"] },
      { label: "Notification Settings", icon: Bell, anchor: "section-notifications", description: "Choose which alerts you receive", keywords: ["notification settings", "salary reminder", "bill reminder", "danger alerts", "monthly summary", "permission", "unread"] },
    ],
  },
  {
    title: "Data",
    items: [
      { label: "Import CSV", icon: Upload, to: "/import", keywords: ["csv", "import", "upload", "statement"] },
      { label: "Export Data", icon: Download, to: "/transactions", keywords: ["export", "download", "backup"] },
      { label: "Data & Privacy", icon: Info, anchor: "section-data-privacy", description: "Backup, storage, delete data", keywords: ["backup", "storage", "delete data", "reset", "privacy policy", "terms", "version", "sync"] },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Salary Survival Settings", icon: Wallet, anchor: "section-salary-settings", keywords: ["salary", "pay day", "income", "employment"] },
      { label: "Survival Preferences", icon: Sparkles, anchor: "section-survival-preferences", keywords: ["emergency fund", "safe daily", "weekly budget", "score weight", "privacy"] },
      { label: "Appearance", icon: Palette, to: "/settings", keywords: ["theme", "dark mode", "appearance"] },
      { label: "Currency & Localization", icon: Globe, to: "/settings", keywords: ["currency", "inr", "language", "locale"] },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "About App", icon: Info, to: "/settings", keywords: ["about", "version", "support", "privacy"] },
      { label: "Privacy & Data", icon: Info, to: "/settings", keywords: ["privacy", "data", "security", "local"] },
      { label: "Feedback", icon: MessageSquare, to: "/settings", keywords: ["feedback", "help", "support", "contact"] },
    ],
  },
];

function scrollToSection(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function MenuPage() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: q
          ? g.items.filter((i) =>
              [i.label, i.description ?? "", ...(i.keywords ?? [])]
                .join(" ")
                .toLowerCase()
                .includes(q),
            )
          : g.items,
      })).filter((g) => g.items.length > 0),
    [q],
  );

  // Smart search: jump straight to an on-page section when it is the only hit.
  useEffect(() => {
    if (!q) return;
    const hits = filtered.flatMap((g) => g.items);
    if (hits.length === 1 && hits[0].anchor) {
      const id = hits[0].anchor;
      const t = window.setTimeout(() => scrollToSection(id), 120);
      return () => window.clearTimeout(t);
    }
  }, [q, filtered]);

  const toggleGroup = useCallback((title: string) => {
    setCollapsed((c) => ({ ...c, [title]: !c[title] }));
  }, []);

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Menu" subtitle="Smart tools, settings and more." />

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 md:px-10">
        {/* Profile chip */}
        <Card className="flex items-center gap-3 p-3 shadow-soft sm:p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground font-semibold">
            {(user?.email?.[0] ?? "U").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.email ?? "Your account"}</p>
            <p className="truncate text-xs text-muted-foreground">Privacy-first · India</p>
          </div>
          <Link to="/settings" className="shrink-0 text-xs font-medium text-primary">Edit</Link>
        </Card>

        {/* Financial Snapshot — live, derived from real data */}
        <FinancialSnapshotCard />

        {/* Salary Settings — central control for salary-based calculations */}
        <SalarySettingsSection />

        {/* Smart Notifications — per-channel control over the alert engine */}
        <NotificationSettingsSection />

        {/* SMS Intelligence — live permission and import status */}
        <SmsIntelligenceStatusCard />

        {/* Data & Privacy — backup, storage and destructive actions */}
        <DataPrivacySection />

        {GROUPS.map((group) => {
          const isCollapsed = collapsed[group.title];
          return (
            <section key={group.title}>
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="mb-2.5 flex w-full items-center justify-between gap-2 px-1"
              >
                <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
                  {group.title}
                </h2>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
              </button>

              {!isCollapsed && (
                <Card className={cn(
                  "overflow-hidden shadow-soft",
                  group.tone === "smart" && "border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent"
                )}>
                  <ul className="divide-y">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isSmart = group.tone === "smart";
                      const inner = (
                        <div className="flex items-center justify-between gap-2 px-3 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60 sm:gap-3 sm:px-4">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              isSmart ? "bg-primary/15 text-primary" : "bg-muted text-foreground/80"
                            )}>
                              <Icon className="h-[18px] w-[18px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.label}</p>
                              {item.description && (
                                <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {item.badge && (
                              <span className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap",
                                item.badge === "New" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              )}>
                                {item.badge}
                              </span>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                      return (
                        <li key={item.label}>
                          {item.to ? (
                            <Link to={item.to} preload="intent">{inner}</Link>
                          ) : item.anchor ? (
                            <button
                              type="button"
                              className="block w-full text-left"
                              onClick={() => scrollToSection(item.anchor!)}
                            >
                              {inner}
                            </button>
                          ) : (
                            <button type="button" className="block w-full text-left opacity-80" disabled>
                              {inner}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </section>
          );
        })}

        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
