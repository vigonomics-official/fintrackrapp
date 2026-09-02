import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ShieldAlert, AlertTriangle, UserCheck, RefreshCw, Wallet, Sparkles, Server, Copyright, Scale, LogOut, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { APP_NAME, DEVELOPER, LAST_UPDATED, SITE_URL } from "@/lib/app-info";

const TITLE = `Terms & Conditions — ${APP_NAME}`;
const DESC = `The user agreement for ${APP_NAME}: acceptable use, financial disclaimer, account responsibilities and how terms change.`;

export const Route = createFileRoute("/terms")({
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
    icon: Wallet,
    title: "Financial Data Responsibility",
    body: [
      `You own the financial data you enter. ${APP_NAME} does not connect to your bank, move money, or act as a bank, lender, broker or licensed financial adviser.`,
      "Keep your own records for tax and legal purposes; the app is a tracking and planning tool, not an official statement of account.",
    ],
  },
  {
    icon: Sparkles,
    title: "AI-Generated Information",
    body: [
      "AI features explain and summarise the numbers the app calculates. Explanations can be incomplete or wrong, and are not professional financial, tax, legal or investment advice.",
      "No savings, returns or financial outcomes are guaranteed. Always verify before acting on a suggestion.",
    ],
  },
  {
    icon: Server,
    title: "Service Availability",
    body: [
      "We aim to keep the app available, but access may be interrupted for maintenance, updates, or issues with the services we depend on. We do not guarantee uninterrupted or error-free service.",
      "Features may change or be removed as the product evolves.",
    ],
  },
  {
    icon: Copyright,
    title: "Intellectual Property",
    body: [
      `The ${APP_NAME} name, design, code and content belong to ${DEVELOPER.name}. You may not copy, resell or redistribute them without permission.`,
      "Your own financial data remains yours; using the app grants us no ownership over it.",
    ],
  },
  {
    icon: Scale,
    title: "Limitation of Liability",
    body: [
      "To the extent permitted by law, we are not liable for financial losses, missed payments, or decisions made based on information shown in the app.",
      "You are responsible for your own financial decisions.",
    ],
  },
  {
    icon: LogOut,
    title: "Account Termination",
    body: [
      `You can stop using the app at any time and request permanent account deletion by emailing ${DEVELOPER.supportEmail} from your registered address.`,
      "We may suspend or close accounts that abuse the service, break these terms, or put other users at risk.",
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
  {
    icon: Mail,
    title: "Contact",
    body: [
      `Questions about these terms? Email ${DEVELOPER.supportEmail}. We read every message, though we do not offer a guaranteed response time.`,
    ],
  },
];


function TermsPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader showBack title="Terms & Conditions" subtitle={`Last updated ${LAST_UPDATED}`} />

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
