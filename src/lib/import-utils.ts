import type { Category, Transaction } from "@/hooks/use-finance";

export type ImportSource = "gpay" | "phonepe" | "paytm" | "bank" | "credit_card" | "generic";

export type StagedRow = {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number;
  type: "income" | "expense";
  category_id: string | null;
  payment_method: string;
  notes: string;
  duplicate?: boolean;
  errors?: string[];
  selected: boolean;
};

export const TARGET_FIELDS = [
  { key: "date", label: "Date" },
  { key: "merchant", label: "Merchant" },
  { key: "amount", label: "Amount" },
  { key: "type", label: "Type" },
  { key: "notes", label: "Notes" },
  { key: "payment_method", label: "Payment Method" },
] as const;
export type TargetField = typeof TARGET_FIELDS[number]["key"];

const FIELD_ALIASES: Record<TargetField, string[]> = {
  date: ["date", "txn_date", "transaction_date", "txn date", "transaction date", "posting date", "value date", "time"],
  merchant: ["merchant", "shop_name", "payee", "description", "narration", "details", "particulars", "to", "from", "name"],
  amount: ["amount", "amount_paid", "amount (inr)", "txn amount", "debit", "credit", "value", "transaction amount"],
  type: ["type", "txn_type", "transaction_type", "dr/cr", "debit/credit"],
  notes: ["notes", "remarks", "comment", "memo", "reference"],
  payment_method: ["payment_method", "method", "mode", "payment mode", "channel"],
};

export function autoMapColumns(headers: string[]): Record<TargetField, string | null> {
  const map: Record<string, string | null> = {};
  for (const field of TARGET_FIELDS) {
    const aliases = FIELD_ALIASES[field.key];
    const hit = headers.find((h) => aliases.some((a) => h.toLowerCase().trim() === a))
      ?? headers.find((h) => aliases.some((a) => h.toLowerCase().includes(a)));
    map[field.key] = hit ?? null;
  }
  return map as Record<TargetField, string | null>;
}

const isSaneDate = (d: Date) => {
  if (isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  return y >= 1990 && y <= 2100;
};

const toIsoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function parseDate(input: unknown): string | null {
  if (input == null) return null;
  if (input instanceof Date) return isSaneDate(input) ? toIsoDay(input) : null;
  // Excel serial date number (days since 1899-12-30)
  if (typeof input === "number" && input > 0 && input < 100000) {
    const d = new Date(Math.round((input - 25569) * 86400 * 1000));
    return isSaneDate(d) ? toIsoDay(d) : null;
  }
  const s = String(input).trim();
  if (!s) return null;
  // Numeric string that looks like an Excel serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 1000 && n < 100000) {
      const d = new Date(Math.round((n - 25569) * 86400 * 1000));
      if (isSaneDate(d)) return toIsoDay(d);
    }
  }
  // ISO YYYY-MM-DD
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = "20" + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (isSaneDate(parsed)) return toIsoDay(parsed);
  return null;
}

/** Strip UPI refs, VPAs, long digit IDs, dangling separators from merchant text. */
export function cleanMerchant(input: unknown): string {
  if (input == null) return "";
  let s = String(input);
  // Drop "Sat Dec 30 1899 ... GMT..." style timestamps
  s = s.replace(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+\w{3}\s+\d{1,2}\s+\d{4}[^,;|]*/gi, "");
  // Drop GMT/UTC trailers
  s = s.replace(/\bGMT[+\-]?\d{0,4}.*$/i, "");
  // Drop "UPI Ref ...", "Ref No ...", "Txn ID ..."
  s = s.replace(/\b(?:upi\s*(?:ref|reference)|ref(?:erence)?\s*(?:no\.?|id)?|txn\s*(?:id|no\.?)|transaction\s*id)\s*[:#-]?\s*[A-Z0-9]+/gi, "");
  // Drop VPAs like name@bank
  s = s.replace(/\b[\w.\-]+@[\w.\-]+\b/g, "");
  // Drop leading prefixes
  s = s.replace(/^\s*(?:paid to|received from|payment to|payment from|upi[\/\-:])\s*/i, "");
  // Drop long digit runs (UPI ref numbers)
  s = s.replace(/\b\d{8,}\b/g, "");
  // Collapse separators & whitespace
  s = s.replace(/[•|·]+/g, " ").replace(/[\s\-_/]{2,}/g, " ").replace(/\s+/g, " ").trim();
  // Trim dangling punctuation
  s = s.replace(/^[\-•·,:;\s]+|[\-•·,:;\s]+$/g, "").trim();
  if (!s) return "";
  // Title-case if it's ALL CAPS
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) {
    s = s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s.slice(0, 60);
}

/** Strip technical metadata from notes so they render cleanly. */
export function cleanNotes(input: unknown): string {
  if (input == null) return "";
  let s = String(input);
  s = s.replace(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+\w{3}\s+\d{1,2}\s+\d{4}[^,;|]*/gi, "");
  s = s.replace(/\bGMT[+\-]?\d{0,4}.*$/i, "");
  s = s.replace(/\b(?:upi\s*(?:ref|reference)|ref(?:erence)?\s*(?:no\.?|id)?|txn\s*(?:id|no\.?)|transaction\s*id)\s*[:#-]?\s*[A-Z0-9]+/gi, "");
  s = s.replace(/\b\d{10,}\b/g, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^[\-•·,:;\s]+|[\-•·,:;\s]+$/g, "").trim();
  return s;
}

export function parseAmount(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Math.abs(input);
  const cleaned = String(input).replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.abs(n);
}

const MERCHANT_RULES: { match: RegExp; category: string; type?: "income" | "expense" }[] = [
  { match: /swiggy|zomato|dominos|pizza|kfc|mcdonald|restaurant|cafe|food|dining/i, category: "Food & Dining" },
  { match: /uber|ola|rapido|metro|petrol|fuel|irctc|indigo|spicejet|airline|cab|taxi/i, category: "Transport" },
  { match: /amazon|flipkart|myntra|ajio|nykaa|shop/i, category: "Shopping" },
  { match: /netflix|prime|hotstar|spotify|youtube|movie|cinema|bookmyshow/i, category: "Entertainment" },
  { match: /electricity|water|gas|broadband|internet|airtel|jio|vi |vodafone|bsnl|recharge|bill/i, category: "Bills & Utilities" },
  { match: /hospital|clinic|pharma|apollo|medplus|chemist|doctor|medi/i, category: "Healthcare" },
  { match: /school|college|udemy|coursera|tuition|course|education/i, category: "Education" },
  { match: /makemytrip|goibibo|booking|airbnb|hotel|travel/i, category: "Travel" },
  { match: /netflix|spotify|subscription|membership/i, category: "Subscriptions" },
  { match: /salary|payroll|stipend/i, category: "Salary", type: "income" },
  { match: /freelanc|upwork|fiverr/i, category: "Freelance", type: "income" },
  { match: /dividend|interest|mutual fund|stock|equity/i, category: "Investments", type: "income" },
  { match: /rent received|tenant/i, category: "Rental Income", type: "income" },
];

export function categorize(merchant: string, categories: Category[]): { category_id: string | null; type?: "income" | "expense" } {
  for (const rule of MERCHANT_RULES) {
    if (rule.match.test(merchant)) {
      const cat = categories.find((c) => c.name.toLowerCase() === rule.category.toLowerCase());
      if (cat) return { category_id: cat.id, type: rule.type };
    }
  }
  return { category_id: null };
}

export function detectDuplicates(staged: StagedRow[], existing: Transaction[]): StagedRow[] {
  const key = (date: string, amount: number, merchant: string) =>
    `${date}|${amount.toFixed(2)}|${merchant.toLowerCase().trim().slice(0, 24)}`;
  const set = new Set(
    existing.map((t) => key(t.transaction_date, t.amount, t.notes ?? "")),
  );
  return staged.map((r) => ({
    ...r,
    duplicate: set.has(key(r.date, r.amount, r.merchant)),
  }));
}

export const SOURCE_HINTS: Record<ImportSource, { method: string; typeHint?: "expense" | "income" }> = {
  gpay: { method: "upi" },
  phonepe: { method: "upi" },
  paytm: { method: "wallet" },
  bank: { method: "bank" },
  credit_card: { method: "credit_card" },
  generic: { method: "bank" },
};
