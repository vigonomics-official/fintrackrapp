import { ShieldCheck } from "lucide-react";

export function CoachPrivacyNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground/80">Your data stays private</p>
        <p>Your financial information stays on your device.</p>
        <p>No banking credentials are shared.</p>
        <p>AI only analyzes your financial summary.</p>
      </div>
    </div>
  );
}
