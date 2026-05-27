import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home, ArrowLeftRight, Target, Users, Menu as MenuIcon, LogOut, Plus,
  TrendingUp, TrendingDown, Flag, ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { CanIBuyThisDialog } from "@/components/finance/CanIBuyThisDialog";
import { TXN_EVENT } from "@/lib/sms-background";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/transactions", label: "Expenses", icon: ArrowLeftRight },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/split-settle", label: "Split", icon: Users },
  { to: "/menu", label: "Profile", icon: MenuIcon },
] as const;

function matchRoute(path: string, route: string) {
  return path === route || path.startsWith(route + "/");
}

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [txOpen, setTxOpen] = useState(false);
  const [homeSheetOpen, setHomeSheetOpen] = useState(false);
  const [cibtOpen, setCibtOpen] = useState(false);

  // Real-time refresh: any SMS-detected transaction invalidates relevant queries
  // so Dashboard, Transactions and Budgets reflect the new entry instantly.
  useEffect(() => {
    const handler = () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
    };
    window.addEventListener(TXN_EVENT, handler);
    return () => window.removeEventListener(TXN_EVENT, handler);
  }, [qc]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Reset FAB-related state on every route change to prevent stale modals leaking between tabs
  useEffect(() => {
    setTxOpen(false);
    setHomeSheetOpen(false);
    setCibtOpen(false);
  }, [path]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isTransactions = matchRoute(path, "/transactions");
  const isDashboard = matchRoute(path, "/dashboard");
  const isMenu = matchRoute(path, "/menu");
  const isSmsIntel = matchRoute(path, "/sms-intelligence");
  const fabHidden = isMenu || isSmsIntel;

  function handleFab() {
    if (isTransactions) {
      setTxOpen(true);
    } else if (isDashboard) {
      setHomeSheetOpen(true);
    } else {
      // Goals, Split, Investments, Loans, etc. – page listens for this event
      window.dispatchEvent(new CustomEvent("fintrackr:fab"));
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <Link to="/dashboard" className="flex items-center gap-2 px-6 py-6 font-display text-xl font-bold">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-gold text-gold-foreground">₣</div>
          FinTrackr
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = matchRoute(path, item.to);
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button onClick={() => signOut().then(() => navigate({ to: "/login" }))}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Floating Action Button — context aware */}
      {!fabHidden && (
        <button
          onClick={handleFab}
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow ring-4 ring-background transition-transform active:scale-95 hover:scale-105 md:bottom-8 md:right-8"
          aria-label="Quick action"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Transactions FAB modal — unchanged */}
      {isTransactions && <TransactionDialog open={txOpen} onOpenChange={setTxOpen} />}

      {/* Home quick actions sheet */}
      <Sheet open={homeSheetOpen} onOpenChange={setHomeSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Quick actions</SheetTitle>
            <SheetDescription>Add new entries to your money flow.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuickActionTile
              icon={TrendingDown} label="Add Expense" tone="bg-destructive/10 text-destructive"
              onClick={() => { setHomeSheetOpen(false); navigate({ to: "/transactions" }); setTimeout(() => setTxOpen(true), 80); }}
            />
            <QuickActionTile
              icon={TrendingUp} label="Add Income" tone="bg-success/10 text-success"
              onClick={() => { setHomeSheetOpen(false); navigate({ to: "/transactions" }); setTimeout(() => setTxOpen(true), 80); }}
            />
            <QuickActionTile
              icon={Flag} label="Create Goal" tone="bg-primary/10 text-primary"
              onClick={() => { setHomeSheetOpen(false); navigate({ to: "/goals" }); setTimeout(() => window.dispatchEvent(new CustomEvent("fintrackr:fab")), 120); }}
            />
            <QuickActionTile
              icon={ShoppingBag} label="Can I Buy This?" tone="bg-gold/15 text-gold-foreground"
              onClick={() => { setHomeSheetOpen(false); setTimeout(() => setCibtOpen(true), 80); }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Can I Buy This? — available from Home FAB */}
      <CanIBuyThisDialog open={cibtOpen} onOpenChange={setCibtOpen} />

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {NAV.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = matchRoute(path, item.to);
            return (
              <Link key={item.to} to={item.to} preload="intent"
                className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function QuickActionTile({
  icon: Icon, label, tone, onClick,
}: { icon: typeof Plus; label: string; tone: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-soft active:scale-[0.98]"
    >
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export { Button }; // silence unused
