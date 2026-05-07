import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Wallet, Tag, Target, Landmark, LineChart,
  Globe, Palette, Bell, ShieldCheck,
  Upload, Download, DatabaseBackup,
  HelpCircle, MessageSquare, Info,
  ChevronRight, LogOut,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/menu")({ component: MenuPage });

type Item = { label: string; icon: typeof Wallet; to?: string; badge?: string };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Financial Management",
    items: [
      { label: "Budgets", icon: Wallet, to: "/budgets" },
      { label: "Categories", icon: Tag, to: "/categories" },
      { label: "Goals", icon: Target, badge: "Soon" },
      { label: "Loan Management", icon: Landmark, to: "/loans" },
      { label: "Investment Settings", icon: LineChart, to: "/investments" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { label: "Currency & Localization", icon: Globe, to: "/settings" },
      { label: "Appearance", icon: Palette, to: "/settings" },
      { label: "Notifications", icon: Bell, badge: "Soon" },
      { label: "Security & Privacy", icon: ShieldCheck, badge: "Soon" },
    ],
  },
  {
    title: "Data",
    items: [
      { label: "Import CSV", icon: Upload, to: "/transactions" },
      { label: "Export Data", icon: Download, to: "/transactions" },
      { label: "Backup & Restore", icon: DatabaseBackup, badge: "Soon" },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Help Center", icon: HelpCircle, badge: "Soon" },
      { label: "Feedback", icon: MessageSquare, badge: "Soon" },
      { label: "About App", icon: Info, badge: "v1.0" },
    ],
  },
];

function MenuPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader title="Menu" subtitle="Manage settings, preferences and more." />
      <div className="space-y-8 px-6 py-6 md:px-10">
        {GROUPS.map((group, gi) => (
          <motion.section
            key={group.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.05 }}
          >
            <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.title}
            </h2>
            <Card className="overflow-hidden shadow-soft">
              <ul className="divide-y">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const inner = (
                    <div className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
                        <Link to={item.to}>{inner}</Link>
                      ) : (
                        <button type="button" className="block w-full text-left" disabled>
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </motion.section>
        ))}

        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
