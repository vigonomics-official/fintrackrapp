import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/finance/PageHeader";
import { NotificationSettingsSection } from "@/components/finance/NotificationSettingsSection";

export const Route = createFileRoute("/_authenticated/notification-settings")({
  component: NotificationSettingsPage,
  head: () => ({
    meta: [
      { title: "Notification Settings — FinTrackr" },
      {
        name: "description",
        content: "Choose which salary, bill, goal and risk alerts FinTrackr sends you.",
      },
      { property: "og:title", content: "Notification Settings — FinTrackr" },
      {
        property: "og:description",
        content: "Choose which salary, bill, goal and risk alerts FinTrackr sends you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Notification Settings — FinTrackr" },
      {
        name: "twitter:description",
        content: "Choose which salary, bill, goal and risk alerts FinTrackr sends you.",
      },
    ],
  }),
});

function NotificationSettingsPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Notification Settings" subtitle="Control every alert FinTrackr sends." />
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 md:px-10">
        <NotificationSettingsSection />
      </div>
    </div>
  );
}
