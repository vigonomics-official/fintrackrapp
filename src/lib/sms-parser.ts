// Lightweight SMS parser for Indian banking / UPI / GPay / PhonePe / Paytm alerts.
// Designed for client-side parsing — no PII leaves the device.

export type ParsedTxnType = "expense" | "income" | "transfer";
export type ParsedPaymentMethod = "upi" | "credit_card" | "debit_card" | "bank" | "wallet";

export interface ParsedSms {
  amount: number;
  type: ParsedTxnType;
  paymentMethod: ParsedPaymentMethod;
  merchant: string;
  bank?: string;
  upiRef?: string;
  occurredAt: Date;
  raw: string;
  confidence: number; // 0-100
}

// Match Indian-style "1,23,456.78" OR plain "2500" / "2500.00" — longer alt first.
const AMOUNT_RE =
  /(?:rs\.?|inr|₹)\s*((?:[0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?)|(?:[0-9]+(?:\.[0-9]{1,2})?))/i;

const DEBIT_HINTS =
  /\b(debited|debit|spent|paid|sent|withdrawn|purchase|charged|payment of|txn of|transferred to|deducted)\b/i;
const CREDIT_HINTS =
  /\b(credited|credit|received|deposited|refund(?:ed)?|cashback|salary)\b/i;

const UPI_HINTS = /\b(upi|vpa|@ok|@ybl|@axl|@paytm|@apl|@ibl|gpay|google pay|phonepe|paytm|bhim)\b/i;
const CARD_HINTS = /\b(card|credit card|debit card|atm)\b/i;
const CREDIT_CARD_HINTS = /\b(credit card|cc\b)/i;

const UPI_REF_RE = /(?:upi(?:\s*ref(?:\.|erence)?(?:\s*no\.?)?)?[:\s-]*|ref(?:\.|erence)?(?:\s*no\.?)?[:\s-]*|txn(?:\s*id)?[:\s-]*)([0-9]{6,})/i;

const VPA_RE = /\b([a-z0-9._-]{2,}@[a-z][a-z0-9.\-]+)\b/i;

// "to ACME PVT LTD on 30-04-25", "at AMAZON.IN", "at ZOMATO ORDERS"
const MERCHANT_RE =
  /(?:to|at|towards|in favor of|from)\s+([A-Z0-9][A-Z0-9 &._'\-/]{2,40}?)(?=\s+(?:on|via|upi|ref|info|avl|a\/c|acct|trf|dt|date)\b|[.,]|$)/i;

const BANK_PATTERNS: Array<[RegExp, string]> = [
  [/\bhdfc\b/i, "HDFC"], [/\bicici\b/i, "ICICI"], [/\bsbi\b/i, "SBI"],
  [/\baxis\b/i, "Axis"], [/\bkotak\b/i, "Kotak"], [/\byes\s*bank\b/i, "Yes Bank"],
  [/\bidfc\b/i, "IDFC"], [/\bpnb\b/i, "PNB"], [/\bbob\b|\bbank of baroda\b/i, "BoB"],
  [/\bcanara\b/i, "Canara"], [/\bunion bank\b/i, "Union"], [/\bindusind\b/i, "IndusInd"],
  [/\brbl\b/i, "RBL"], [/\bau small\b/i, "AU SFB"], [/\bfederal\b/i, "Federal"],
  [/\bgpay|google pay\b/i, "GPay"], [/\bphonepe\b/i, "PhonePe"], [/\bpaytm\b/i, "Paytm"],
];

// Drop these noise tokens from extracted merchant strings
const MERCHANT_NOISE =
  /\b(upi|ref|refno|txn|txnid|tid|imps|neft|rtgs|payment|via|info|on|dated?|inr|rs\.?|to|from|pvt|ltd|limited|private|services|merchant)\b/gi;

function parseAmount(text: string): number | null {
  const m = text.match(AMOUNT_RE);
  if (!m) return null;
  const n = Number(m[1].replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectBank(text: string): string | undefined {
  for (const [re, name] of BANK_PATTERNS) if (re.test(text)) return name;
  return undefined;
}

function cleanMerchant(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  let s = raw
    .replace(/\s+/g, " ")
    .replace(/[*_/\\|]+/g, " ")
    .replace(MERCHANT_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-.,\s]+|[-.,\s]+$/g, "");
  // Title-case acronyms remain capitalised; otherwise smart-case
  if (/^[A-Z0-9 &]+$/.test(s) && s.length <= 18) return s; // keep brand caps (SWIGGY)
  s = s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return s.length >= 2 ? s : fallback;
}

function detectType(text: string): ParsedTxnType {
  if (CREDIT_HINTS.test(text) && !DEBIT_HINTS.test(text)) return "income";
  return "expense";
}

function detectMethod(text: string): ParsedPaymentMethod {
  if (CREDIT_CARD_HINTS.test(text)) return "credit_card";
  if (CARD_HINTS.test(text)) return "debit_card";
  if (UPI_HINTS.test(text)) return "upi";
  return "bank";
}

function extractMerchant(text: string): string | undefined {
  const m = text.match(MERCHANT_RE);
  if (m?.[1]) return m[1];
  // VPA fallback: swiggy@ybl -> "swiggy"
  const v = text.match(VPA_RE);
  if (v?.[1]) return v[1].split("@")[0];
  return undefined;
}

/** Compact "30 Apr • 7:09 AM" formatter. */
export function formatCompactDateTime(d: Date): string {
  const date = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} • ${time}`;
}

/**
 * Parse a single SMS body. Returns null if no recognisable transaction.
 * `receivedAt` is the SMS arrival time (used as fallback when body lacks date).
 */
export function parseSms(body: string, receivedAt: Date = new Date()): ParsedSms | null {
  if (!body || body.length < 6) return null;
  const text = body.replace(/\s+/g, " ").trim();

  const amount = parseAmount(text);
  if (!amount) return null;
  if (!DEBIT_HINTS.test(text) && !CREDIT_HINTS.test(text)) return null;

  const type = detectType(text);
  const paymentMethod = detectMethod(text);
  const bank = detectBank(text);
  const upiRef = text.match(UPI_REF_RE)?.[1];
  const merchantRaw = extractMerchant(text);
  const merchant = cleanMerchant(merchantRaw, bank ?? "Unknown");

  if (!Number.isFinite(receivedAt.getTime())) receivedAt = new Date();

  let confidence = 60;
  if (merchantRaw) confidence += 15;
  if (upiRef) confidence += 10;
  if (bank) confidence += 5;
  if (paymentMethod === "upi") confidence += 5;
  confidence = Math.min(99, confidence);

  return { amount, type, paymentMethod, merchant, bank, upiRef, occurredAt: receivedAt, raw: text, confidence };
}

/** Stable signature for de-dup (UPI ref preferred). */
export function txnSignature(p: ParsedSms): string {
  if (p.upiRef) return `ref:${p.upiRef}`;
  const day = p.occurredAt.toISOString().slice(0, 10);
  return `${day}|${p.amount.toFixed(2)}|${p.merchant.toLowerCase()}`;
}
