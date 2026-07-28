import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Circle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const COACH_VIEWED_KEY = "fintrackr:checklist:viewed-coach";
const CHECKLIST_UPDATED_EVENT = "fintrackr:checklist-updated";

export function markCoachViewed() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(COACH_VIEWED_KEY) === "1") return;
    localStorage.setItem(COACH_VIEWED_KEY, "1");
    window.dispatchEvent(new Event(CHECKLIST_UPDATED_EVENT));
  } catch { /* ignore */ }
}

function readCoachViewed(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(COACH_VIEWED_KEY) === "1"; } catch { return false; }
}

export type ChecklistState = {
  hasSalary: boolean;
  hasGoal: boolean;
  hasExpense: boolean;
  hasEmergencyFund: boolean;
};

type Props = ChecklistState;

export function GettingStartedChecklist({ hasSalary, hasGoal, hasExpense, hasEmergencyFund }: Props) {
  const [viewedCoach, setViewedCoach] = useState<boolean>(readCoachViewed);

  useEffect(() => {
    const sync = () => setViewedCoach(readCoachViewed());
    window.addEventListener(CHECKLIST_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHECKLIST_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const items = [
    { key: "salary", label: "Salary Added", done: hasSalary, to: "/settings" as const },
    { key: "goal", label: "Goal Created", done: hasGoal, to: "/goals" as const },
    { key: "expense", label: "Add First Expense", done: hasExpense, to: "/transactions" as const },
    { key: "coach", label: "View AI Coach", done: viewedCoach, to: "/insights/ai-coach" as const },
    { key: "emergency", label: "Build Emergency Fund", done: hasEmergencyFund, to: "/goals" as const },
  ];

  const completed = items.filter((i) => i.done).length;
  if (completed === items.length) return null;

  const pct = Math.round((completed / items.length) * 100);

  return (
    <Card className="border-dashed shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Getting started
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {completed} of {items.length} complete · finish these to unlock your full survival dashboard.
        </p>
        <Progress value={pct} className="mt-2 h-1.5" />
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.map((item) => {
          const inner = (
            <>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  item.done
                    ? "border-success bg-success text-success-foreground"
                    : "border-muted-foreground/40 text-muted-foreground"
                }`}
              >
                {item.done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
              </span>
              <span
                className={`flex-1 text-sm ${
                  item.done ? "text-muted-foreground line-through" : "font-medium text-foreground"
                }`}
              >
                {item.label}
              </span>
              {!item.done && <span className="text-xs text-primary">Start →</span>}
            </>
          );
          return item.done ? (
            <div key={item.key} className="flex items-center gap-3 rounded-lg px-2 py-2">
              {inner}
            </div>
          ) : (
            <Link
              key={item.key}
              to={item.to}
              onClick={item.key === "coach" ? () => markCoachViewed() : undefined}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted/60"
            >
              {inner}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
