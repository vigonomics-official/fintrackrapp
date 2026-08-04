import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
  Landmark, CalendarDays, Target, Bot, Bell,
  Palette, Globe,
  Info, MessageSquare,
  Sparkles,
  ChevronRight, ChevronDown, LogOut,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SalarySettingsSection } from "@/components/finance/SalarySettingsSection";
import { FinancialSnapshotCard } from "@/components/finance/FinancialSnapshotCard";
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

type Item = { label: string; icon: typeof Landmark; to?: string; badge?: string; description?: string; anchor?: string };
type Group = { title: string; tone?: "smart" | "default"; items: Item[] };

const TOOL_GROUPS: Group[] = [
  {
    title: "Financial Tools",
    items: [
      { label: "Smart Categorization", icon: Sparkles, to: "/smart-categorization", description: "Self-learning rules & merchants" },
      { label: "Loans & EMI", icon: Landmark, to: "/loans" },
      { label: "Planner", icon: CalendarDays, to: "/planner" },
      { label: "Goals", icon: Target, to: "/goals" },
      { label: "AI Salary Survival Coach", icon: Bot, to: "/insights/ai-coach" },
    ],
  },
];

const SETTINGS_GROUPS: Group[] = [
  {
    title: "Settings",
    items: [
      { label: "Appearance", icon: Palette, to: "/settings" },
      { label: "Currency & Localization", icon: Globe, to: "/settings" },
      { label: "Notification Settings", icon: Bell, to: "/notification-settings", description: "Choose which alerts you receive" },
      { label: "Salary Survival Settings", icon: Landmark, to: "/salary-settings", description: "Salary, emergency fund & score weights" },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "About App", icon: Info, to: "/settings" },
      { label: "Feedback", icon: MessageSquare, to: "/settings" },
      { label: "Privacy Policy", icon: Info, to: "/settings" },
      { label: "Terms & Conditions", icon: Info, to: "/settings" },
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});


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

        {/* SMS Intelligence — live permission and import status */}
        <SmsIntelligenceStatusCard />

        {/* Financial Tools */}
        <MenuGroups groups={TOOL_GROUPS} collapsed={collapsed} onToggle={toggleGroup} />

        {/* Data — backup, storage and destructive actions */}
        <DataPrivacySection />

        {/* Settings & Support */}
        <MenuGroups groups={SETTINGS_GROUPS} collapsed={collapsed} onToggle={toggleGroup} />


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
