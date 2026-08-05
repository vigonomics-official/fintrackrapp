// Single source of truth for app identity, support contacts and changelog.
import { APP_VERSION } from "./local-storage-stats";

export const APP_NAME = "FinTrackr";
export const APP_TAGLINE = "Salary survival, made simple.";
export const APP_DESCRIPTION =
  "FinTrackr is a privacy-first salary survival tracker for India. It reads your spending, predicts how long your salary lasts, and coaches you with AI so you never run out before payday.";

export { APP_VERSION };

/** Deterministic build number derived from the semantic version. */
export const BUILD_NUMBER = APP_VERSION.split(".")
  .map((part) => part.padStart(2, "0"))
  .join("");

export const DEVELOPER = {
  name: "FinTrackr Labs",
  location: "India",
  supportEmail: "support@fintrackrapp.com",
  feedbackEmail: "feedback@fintrackrapp.com",
} as const;

export const SITE_URL = "https://fintrackrapp.lovable.app";

export const CHANGELOG: { version: string; date: string; highlights: string[] }[] = [
  {
    version: "1.4.0",
    date: "August 2026",
    highlights: [
      "Dedicated Support pages for About, Feedback, Privacy and Terms",
      "Salary Survival Settings now auto-sync across every screen",
      "Cleaner Menu with a 3-metric Financial Snapshot",
    ],
  },
  {
    version: "1.3.0",
    date: "July 2026",
    highlights: [
      "AI Coach chat with multilingual replies and calculation traces",
      "Smart Risk Engine for Danger Alerts",
      "Monthly Report Card with grades, badges and exports",
    ],
  },
  {
    version: "1.2.0",
    date: "June 2026",
    highlights: [
      "Spending Behavior insights and Weekly Survival Report",
      "Smart Notifications & Reminders",
      "Getting Started checklist for new accounts",
    ],
  },
];

export const LAST_UPDATED = "August 2026";
