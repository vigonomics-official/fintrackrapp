import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/use-finance";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCIES } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setCurrency(profile.currency ?? "INR");
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name, currency }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Profile and preferences." />
      <div className="grid max-w-2xl gap-6 px-6 py-6 md:px-10">
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={saving} className="bg-gradient-primary">{saving ? "Saving…" : "Save changes"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-display font-semibold">Sign out</p>
              <p className="text-sm text-muted-foreground">End your current session.</p>
            </div>
            <Button variant="outline" onClick={() => signOut().then(() => navigate({ to: "/login" }))}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
