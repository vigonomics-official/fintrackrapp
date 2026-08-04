import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/finance/PageHeader";
import { SalarySettingsSection } from "@/components/finance/SalarySettingsSection";
import { EmergencyFundProgressCard } from "@/components/finance/EmergencyFundProgressCard";

export const Route = createFileRoute("/_authenticated/salary-settings")({
  component: SalarySettingsPage,
  head: () => ({
    meta: [
      { title: "Salary Survival Settings — FinTrackr" },
      {
        name: "description",
        content:
          "Set your salary, payday, emergency fund target and survival score weights in FinTrackr.",
      },
      { property: "og:title", content: "Salary Survival Settings — FinTrackr" },
      {
        property: "og:description",
        content:
          "Set your salary, payday, emergency fund target and survival score weights in FinTrackr.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Salary Survival Settings — FinTrackr" },
      {
        name: "twitter:description",
        content:
          "Set your salary, payday, emergency fund target and survival score weights in FinTrackr.",
      },
    ],
  }),
});

function SalarySettingsPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Salary Survival Settings" subtitle="Salary, emergency fund & score weights." />
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 md:px-10">
        <EmergencyFundProgressCard />
        <SalarySettingsSection />
      </div>
    </div>
  );
}
