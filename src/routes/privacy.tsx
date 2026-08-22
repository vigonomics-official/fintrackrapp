import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, MessageSquareLock, HardDrive, ShieldCheck, Trash2, Sparkles, Clock, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { APP_NAME, DEVELOPER, LAST_UPDATED, SITE_URL } from "@/lib/app-info";

const TITLE = `Privacy Policy — ${APP_NAME}`;
const DESC = `How ${APP_NAME} collects, stores and protects your financial data, including SMS permissions, local storage and account deletion.`;

export const Route = createFileRoute("/privacy")({
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
    title: "What We Collect",
    body: [
      `${APP_NAME} collects only what you enter or import: your email address and profile details (name, city, age group, currency), salary and pay-cycle settings, transactions, categories, budgets, goals, loans and EMI records, and imported CSV rows.`,
      "We do not connect to your bank, we do not ask for banking credentials, and there is no automatic bank synchronisation. Your financial data is not sold and is not shared with advertisers.",
    ],
  },
  {
    icon: MessageSquareLock,
    title: "SMS Intelligence (Optional)",
    body: [
      "SMS Intelligence is optional and only works on supported Android builds where you explicitly grant SMS permission. Permission is never requested automatically, on the web it is unavailable, and nothing is read unless you turn it on.",
      "Messages are parsed on your device to detect the amount, merchant, bank and payment method, then discarded — the raw message text is not saved to your account, not stored in our database and not sent to any AI service. Only the resulting transaction details FinTrackr needs (amount, merchant, bank, reference, payment method, date and category) are stored.",

    ],
  },
  {
    icon: HardDrive,
    title: "Where Your Data Lives",
    body: [
      "Account data — profile, transactions, categories, budgets, goals, loans and import history — is stored in our managed cloud database and is protected by row-level security so only your authenticated session can read it.",
      "Preferences, cached calculations, coach history, dismissed tips and draft settings are stored locally in your browser or device so the app stays fast. Local data is separate from your synced account data.",
    ],
  },
  {
    icon: Sparkles,
    title: "AI Processing",
    body: [
      `AI features (Salary Survival Coach, Can I Buy This?, and the AI Financial Report) send a limited, summarised financial snapshot to Google Gemini through our server so it can write an explanation. Your email, name, raw transaction notes and account identifiers are not included in that snapshot.`,
      `All financial numbers — survival score, safe daily spend, affordability, budgets and forecasts — are calculated by ${APP_NAME}'s own logic. AI only explains those numbers; it does not compute or change them.`,
    ],
  },
  {
    icon: ShieldCheck,
    title: "Security & Authentication",
    body: [
      "Sign-in is handled by our managed authentication provider using email and password or Google sign-in. Passwords are hashed and never visible to us.",
      "All traffic is encrypted in transit, and AI API keys stay on the server and are never shipped to the browser. Use a strong, unique password and sign out on shared devices.",
    ],
  },
  {
    icon: Clock,
    title: "Data Retention",
    body: [
      "Your account data stays stored for as long as your account exists, because the app needs your history to calculate trends and forecasts. We do not set an automatic expiry on your records.",
      "Local device data stays until you clear it from Menu → Data → Delete All Data, or clear your browser storage. Deleting a transaction, budget, goal or loan in the app removes that record from your account.",
    ],
  },
  {
    icon: Trash2,
    title: "Delete Data vs Delete Account",
    body: [
      "Delete All Data (Menu → Data) clears locally stored preferences, caches, coach history and drafts on this device only. It does not delete your synced account or the records stored in your account.",
      `Permanent account deletion is handled manually by our team. Email ${DEVELOPER.supportEmail} from your registered address and we will delete your account and its stored records. There is no automatic in-app account-deletion button today.`,
    ],
  },
  {
    icon: UserCheck,
    title: "Your Rights",
    body: [
      "You can view and export your data in the app, correct anything inaccurate by editing the record, and delete individual transactions, budgets, goals or loans yourself.",
      `For access, correction, account closure or any privacy question, email ${DEVELOPER.supportEmail} from your registered address.`,
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
