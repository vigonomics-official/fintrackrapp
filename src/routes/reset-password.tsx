import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./login";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          <Input id="reset-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button disabled={loading} className="w-full bg-gradient-primary shadow-elegant">
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
