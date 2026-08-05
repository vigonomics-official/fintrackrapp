import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, MessageSquareLock, HardDrive, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { APP_NAME, DEVELOPER, LAST_UPDATED, SITE_URL } from "@/lib/app-info";

const TITLE = `Privacy Policy — ${APP_NAME}`;
const DESC = `How ${APP_NAME} collects, stores and protects your financial data, including SMS permissions, local storage and account deletion.`;

export const Route = createFileRoute("/_authenticated/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/privacy` },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
});

const SECTIONS = [
  {
    icon: Database,
    title: "Data Collection",
    body: [
      `${APP_NAME} collects only what is needed to run your salary survival tracking: your email address, profile name, currency, salary settings, transactions, budgets, goals and loans you enter or import.`,
      "We never sell your data, never share it with advertisers, and never build advertising profiles from your spending.",
    ],
  },
  {
    icon: MessageSquareLock,
    title: "SMS Permissions",
    body: [
      "SMS Intelligence is optional and off until you grant permission. When enabled, bank and UPI transaction messages are parsed on your device to detect amount, merchant and category.",
      "Raw message text is never uploaded. Only the resulting transaction fields are saved to your account.",
    ],
  },
  {
    icon: HardDrive,
    title: "Local Storage",
    body: [
      "Preferences, cached calculations, coach history and draft settings are stored locally in your browser so the app stays fast and works offline.",
      "You can clear this at any time from Menu → Data → Delete All Data. Clearing local data does not delete your synced account records.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Security",
    body: [
      "All traffic is encrypted in transit. Account records are protected by row-level security so your data is only readable by your authenticated session.",
      "Passwords are hashed and never visible to us. We recommend a strong, unique password and signing out on shared devices.",
    ],
  },
  {
    icon: Trash2,
    title: "Delete Account",
    body: [
      "To remove your data, open Menu → Data → Delete All Data to wipe local storage, then email us to permanently delete your synced account.",
      `Send the request from your registered email to ${DEVELOPER.supportEmail}. Deletion is permanent and completed within 30 days.`,
    ],
  },
];

function PrivacyPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Privacy Policy" subtitle={`Last updated ${LAST_UPDATED}`} />

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 md:px-10">
        <Card className="shadow-soft">
          <CardContent className="p-4 text-sm leading-relaxed text-foreground/90 sm:p-6">
            {APP_NAME} is privacy-first by design. This policy explains exactly what we store, where it lives, and how you stay in control.
          </CardContent>
        </Card>

        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="shadow-soft">
              <CardContent className="space-y-2.5 p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <h2 className="text-sm font-semibold">{section.title}</h2>
                </div>
                {section.body.map((p) => (
                  <p key={p} className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{p}</p>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <p className="px-1 text-xs text-muted-foreground">
          Questions? Email{" "}
          <a href={`mailto:${DEVELOPER.supportEmail}`} className="font-medium text-primary">{DEVELOPER.supportEmail}</a>{" "}
          or read the <Link to="/terms" className="font-medium text-primary">Terms &amp; Conditions</Link>.
        </p>
      </div>
    </div>
  );
}
