import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./login";
import { validatePassword, PASSWORD_HINT, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — FinTrackr" },
      { name: "description", content: "Choose a new password for your FinTrackr account and get back to tracking your money." },
      { property: "og:title", content: "Set a new password — FinTrackr" },
      { property: "og:description", content: "Choose a new password for your FinTrackr account and get back to tracking your money." },
      { property: "og:url", content: "/reset-password" },
    ],
    links: [{ rel: "canonical", href: "/reset-password" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const policyError = password ? validatePassword(password) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validatePassword(password);
    if (invalid) return toast.error(invalid);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error("Could not update password. Please try again.");
    toast.success("Password updated.");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose something memorable">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {policyError
            ? <p className="mt-1 text-xs text-destructive">{policyError}</p>
            : <p className="mt-1 text-xs text-muted-foreground">{PASSWORD_HINT}</p>}
        </div>
        <Button disabled={loading || !!validatePassword(password)} className="w-full bg-gradient-primary shadow-elegant">
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}

