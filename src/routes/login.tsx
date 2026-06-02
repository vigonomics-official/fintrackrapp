import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("Invalid email or password.");
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  });

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) return toast.error("Google sign-in failed");
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-5 py-8"
      style={{ background: "#FAFAF7" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
              ₹
            </div>
            FinTrackr
          </Link>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Your Salary Survival System
          </p>
          <h1 className="mt-5 font-display text-2xl font-bold">Welcome back</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <div>
            <Label>Email</Label>
            <Input type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
            </div>
            <Input type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-elegant">
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <Divider />
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">Create one</Link>
        </p>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          No bank login needed • Built for India • Privacy First
        </p>
      </motion.div>
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-hero text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_30%,white,transparent_40%),radial-gradient(circle_at_70%_70%,oklch(0.78_0.12_85),transparent_40%)]" />
        <Link to="/" className="relative flex items-center gap-2 font-display text-xl font-bold">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-gold text-gold-foreground">₣</div>
          FinTrackr
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight">"FinTrackr changed how I see my money."</h2>
          <p className="mt-3 text-primary-foreground/80">— Alex, designer</p>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center px-6 py-12"
      >
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
    </div>
  );
}
