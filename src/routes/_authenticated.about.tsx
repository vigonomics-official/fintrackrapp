import { createFileRoute } from "@tanstack/react-router";
import { Wallet, Mail, Sparkles, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import {
  APP_NAME, APP_TAGLINE, APP_DESCRIPTION, APP_VERSION, BUILD_NUMBER,
  DEVELOPER, CHANGELOG, SITE_URL,
} from "@/lib/app-info";

const TITLE = `About ${APP_NAME} — Version, Developer & What's New`;
const DESC = `Learn about ${APP_NAME}: app version, build, developer details, contact email and the latest release notes.`;

export const Route = createFileRoute("/_authenticated/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/about` },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/about` }],
  }),
});

function AboutPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="About App" subtitle={`${APP_NAME} ${APP_VERSION}`} />

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 md:px-10">
        <Card className="shadow-soft">
          <CardContent className="flex items-center gap-4 p-4 sm:p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
              <Wallet className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold">{APP_NAME}</h2>
              <p className="text-xs text-muted-foreground">{APP_TAGLINE}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Version {APP_VERSION} · Build {BUILD_NUMBER}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-2 p-4 sm:p-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">About</h3>
            <p className="text-sm leading-relaxed text-foreground/90">{APP_DESCRIPTION}</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4 sm:p-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Developer</h3>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground/80">
                <Building2 className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{DEVELOPER.name}</p>
                <p className="truncate text-xs text-muted-foreground">{DEVELOPER.location}</p>
              </div>
            </div>
            <a
              href={`mailto:${DEVELOPER.supportEmail}`}
              className="flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-muted/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground/80">
                <Mail className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-primary">{DEVELOPER.supportEmail}</p>
                <p className="truncate text-xs text-muted-foreground">Contact email</p>
              </div>
            </a>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> What&apos;s New
            </h3>
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="space-y-1.5">
                <p className="text-sm font-medium">
                  {entry.version}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{entry.date}</span>
                </p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {entry.highlights.map((h) => <li key={h}>{h}</li>)}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
