import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ShieldAlert, AlertTriangle, UserCheck, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { APP_NAME, DEVELOPER, LAST_UPDATED, SITE_URL } from "@/lib/app-info";

const TITLE = `Terms & Conditions — ${APP_NAME}`;
const DESC = `The user agreement for ${APP_NAME}: acceptable use, financial disclaimer, account responsibilities and how terms change.`;

export const Route = createFileRoute("/_authenticated/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/terms` },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
  }),
});

const SECTIONS = [
  {
    icon: FileText,
    title: "User Agreement",
    body: [
      `By creating an account or using ${APP_NAME}, you agree to these terms. If you do not agree, please stop using the app and delete your account.`,
      "You must be at least 18 years old, or the age of majority where you live, to use the app.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "Acceptable Use",
    body: [
      "Use the app only for lawful personal finance tracking. Do not attempt to reverse engineer, scrape, overload, or gain unauthorised access to the service or to other users' data.",
      "Do not upload content you do not have the right to store, and do not use the app to facilitate fraud or money laundering.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Disclaimer",
    body: [
      `${APP_NAME} provides informational insights and AI-generated suggestions. It is not a bank, lender, or licensed financial adviser, and its output is not financial, tax, or legal advice.`,
      "Predictions such as survival score, safe daily spend and goal forecasts are estimates based on the data you provide. Always verify with your own records before making decisions.",
    ],
  },
  {
    icon: UserCheck,
    title: "Account Responsibilities",
    body: [
      "You are responsible for keeping your login credentials secure and for all activity under your account.",
      "You are responsible for the accuracy of the salary, bills and transaction data you enter or import — the quality of insights depends on it.",
    ],
  },
  {
    icon: RefreshCw,
    title: "Updates to Terms",
    body: [
      "We may update these terms as the app evolves. Material changes will be highlighted in the app before they take effect.",
      "Continuing to use the app after an update means you accept the revised terms.",
    ],
  },
];

function TermsPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Terms & Conditions" subtitle={`Last updated ${LAST_UPDATED}`} />

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 md:px-10">
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
          or read the <Link to="/privacy" className="font-medium text-primary">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
