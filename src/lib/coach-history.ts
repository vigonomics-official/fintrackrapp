// Chat history: persistent, grouped by day. Each message may carry the
// structured CoachResponse so re-opened conversations retain the same
// UI treatment (follow-up actions, calculations, etc).

import type { CoachResponse } from "@/lib/coach-prompts";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;           // short surface text (assistant = shortAnswer)
  response?: CoachResponse;  // full structured reply for assistant turns
  createdAt: number;
};

export const CHAT_HISTORY_KEY = "fintrackr:ai-coach:chat-history";
export const CHAT_SAVED_KEY = "fintrackr:ai-coach:saved-advice";
export const MAX_MESSAGES = 200;

export type HistoryGroup = {
  label: "Today" | "Yesterday" | "This Week" | "Earlier";
  messages: ChatMessage[];
};

export function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

export function saveHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch {
    /* ignore */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(CHAT_HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

export function groupMessages(messages: ChatMessage[]): HistoryGroup[] {
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekStart = today - 7 * 24 * 60 * 60 * 1000;
  const groups: Record<HistoryGroup["label"], ChatMessage[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Earlier: [],
  };
  for (const m of messages) {
    if (m.createdAt >= today) groups.Today.push(m);
    else if (m.createdAt >= yesterday) groups.Yesterday.push(m);
    else if (m.createdAt >= weekStart) groups["This Week"].push(m);
    else groups.Earlier.push(m);
  }
  return (Object.keys(groups) as HistoryGroup["label"][])
    .map((label) => ({ label, messages: groups[label] }))
    .filter((g) => g.messages.length > 0);
}

// ---------- Saved advice ----------

export function saveAdvice(msg: ChatMessage): void {
  try {
    const raw = localStorage.getItem(CHAT_SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    arr.push(msg);
    localStorage.setItem(CHAT_SAVED_KEY, JSON.stringify(arr.slice(-50)));
  } catch {
    /* ignore */
  }
}
