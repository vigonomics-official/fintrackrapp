import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageShell, PageContainer } from "@/components/finance/PageContainer";
import { AnalyzeForm } from "@/components/finance/AnalyzeForm";

export const Route = createFileRoute("/_authenticated/insights/ai-coach")({
  component: AiCoachRoute,
  head: () => ({ meta: [{ title: "AI Salary Survival Coach — FinTrackr" }] }),
});

function AiCoachRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Child routes (e.g. /results) render their own shell via <Outlet />.
  if (pathname !== "/insights/ai-coach") return <Outlet />;
  return <AiCoachPage />;
}

function AiCoachPage() {
  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-3 border-b bg-card/40 px-4 py-4 backdrop-blur md:px-10 md:py-6">
        <Link
          to="/insights"
          aria-label="Back to Insights"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 truncate font-display text-lg font-bold tracking-tight md:text-2xl">
            <Sparkles className="h-4 w-4 shrink-0 text-primary md:h-5 md:w-5" />
            <span className="truncate">AI Salary Survival Coach</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
            Your personal salary survival assistant powered by AI.
          </p>
        </div>
      </div>

      <PageContainer>
        <Tabs defaultValue="analyze" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analyze">Analyze</TabsTrigger>
            <TabsTrigger value="advice">Advice</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="mt-4">
            <Placeholder title="Analyze" body="AI Salary Survival Analysis coming soon." />
          </TabsContent>
          <TabsContent value="advice" className="mt-4">
            <Placeholder title="Advice" body="Personalized AI advice will appear here." />
          </TabsContent>
          <TabsContent value="plan" className="mt-4">
            <Placeholder title="Plan" body="AI Monthly Plan will appear here." />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PageShell>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center shadow-soft">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
    </Card>
  );
}
