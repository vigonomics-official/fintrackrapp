// Smart Transaction Categorization Engine — privacy-first, client-side.
// All learned data and rules live in localStorage. No backend calls.

export type Rule = {
  id: string;
  match: string;        // keyword (case-insensitive substring, also matches UPI handles)
  category: string;
  source: "seed" | "user" | "learned";
  hits: number;
  createdAt: number;
};

export type MerchantMemory = {
  key: string;          // normalized merchant key
  display: string;      // best label seen
  category: string;     // user-confirmed category
  count: number;
  total: number;        // amount spent (absolute)
  lastAt: number;
  confirmed: boolean;   // user explicitly saved
};

const RULES_KEY = "ft.cat.rules.v1";
const MEM_KEY = "ft.cat.memory.v1";
const DISMISS_KEY = "ft.cat.dismissed.v1";

export const SEED_RULES: Omit<Rule, "id" | "hits" | "createdAt">[] = [
  { match: "swiggy", category: "Food", source: "seed" },
  { match: "zomato", category: "Dining", source: "seed" },
  { match: "uber", category: "Transport", source: "seed" },
  { match: "ola", category: "Transport", source: "seed" },
  { match: "rapido", category: "Transport", source: "seed" },
  { match: "amazon", category: "Shopping", source: "seed" },
  { match: "flipkart", category: "Shopping", source: "seed" },
  { match: "myntra", category: "Shopping", source: "seed" },
  { match: "bigbasket", category: "Grocery", source: "seed" },
  { match: "blinkit", category: "Grocery", source: "seed" },
  { match: "zepto", category: "Grocery", source: "seed" },
  { match: "dmart", category: "Grocery", source: "seed" },
  { match: "petrol", category: "Fuel", source: "seed" },
  { match: "iocl", category: "Fuel", source: "seed" },
  { match: "hpcl", category: "Fuel", source: "seed" },
  { match: "bpcl", category: "Fuel", source: "seed" },
  { match: "netflix", category: "Subscription", source: "seed" },
  { match: "spotify", category: "Subscription", source: "seed" },
  { match: "hotstar", category: "Subscription", source: "seed" },
  { match: "prime", category: "Subscription", source: "seed" },
  { match: "airtel", category: "Recharge", source: "seed" },
  { match: "jio", category: "Recharge", source: "seed" },
  { match: "vi ", category: "Recharge", source: "seed" },
  { match: "bescom", category: "Bills", source: "seed" },
  { match: "electricity", category: "Bills", source: "seed" },
  { match: "irctc", category: "Travel", source: "seed" },
  { match: "makemytrip", category: "Travel", source: "seed" },
  { match: "goibibo", category: "Travel", source: "seed" },
  { match: "apollo", category: "Health", source: "seed" },
  { match: "pharmeasy", category: "Health", source: "seed" },
  { match: "1mg", category: "Health", source: "seed" },
];

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeWrite(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

export function getRules(): Rule[] {
  const stored = safeRead<Rule[]>(RULES_KEY, []);
  if (stored.length === 0) {
    const seeded = SEED_RULES.map((r, i) => ({
      ...r, id: `seed-${i}`, hits: 0, createdAt: Date.now(),
    }));
    safeWrite(RULES_KEY, seeded);
    return seeded;
  }
  return stored;
}
export function saveRules(rules: Rule[]) { safeWrite(RULES_KEY, rules); }

export function getMemory(): MerchantMemory[] { return safeRead<MerchantMemory[]>(MEM_KEY, []); }
export function saveMemory(m: MerchantMemory[]) { safeWrite(MEM_KEY, m); }

export function getDismissed(): string[] { return safeRead<string[]>(DISMISS_KEY, []); }
export function saveDismissed(d: string[]) { safeWrite(DISMISS_KEY, d); }

export function normalizeMerchant(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/@[a-z0-9.]+/gi, (m) => m) // keep upi handle but lowercase
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9@. ]/g, "")
    .trim();
}

export type Prediction = {
  category: string | null;
  confidence: number;     // 0..100
  via: "memory" | "rule" | "fallback";
  ruleId?: string;
};

export function predictCategory(merchant: string, rules: Rule[], memory: MerchantMemory[]): Prediction {
  const key = normalizeMerchant(merchant);
  if (!key) return { category: null, confidence: 0, via: "fallback" };

  // 1) Personalized merchant memory wins (strongest signal)
  const mem = memory.find((m) => key.includes(m.key) || m.key.includes(key));
  if (mem) {
    const conf = Math.min(99, 60 + Math.min(35, mem.count * 5) + (mem.confirmed ? 4 : 0));
    return { category: mem.category, confidence: conf, via: "memory" };
  }

  // 2) Rule engine — longest match wins
  let best: { rule: Rule; len: number } | null = null;
  for (const r of rules) {
    const m = r.match.toLowerCase().trim();
    if (!m) continue;
    if (key.includes(m)) {
      if (!best || m.length > best.len) best = { rule: r, len: m.length };
    }
  }
  if (best) {
    const conf = Math.min(94, 70 + best.len * 2 + Math.min(15, best.rule.hits));
    return { category: best.rule.category, confidence: conf, via: "rule", ruleId: best.rule.id };
  }

  return { category: null, confidence: 0, via: "fallback" };
}

export function rememberMerchant(merchant: string, category: string, amount = 0, confirmed = false) {
  const key = normalizeMerchant(merchant);
  if (!key) return;
  const list = getMemory();
  const idx = list.findIndex((m) => m.key === key);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      category,
      display: list[idx].display || merchant,
      count: list[idx].count + 1,
      total: list[idx].total + Math.abs(amount),
      lastAt: Date.now(),
      confirmed: confirmed || list[idx].confirmed,
    };
  } else {
    list.push({
      key, display: merchant.trim(), category,
      count: 1, total: Math.abs(amount), lastAt: Date.now(), confirmed,
    });
  }
  saveMemory(list);
}

export function forgetMerchant(key: string) {
  saveMemory(getMemory().filter((m) => m.key !== key));
}

// Build merchant profiles from real transactions (notes field commonly holds merchant info).
export function buildProfilesFromTransactions(
  txs: Array<{ id: string; notes: string | null; amount: number; transaction_date: string; category_id: string | null }>,
  categoryNameById: Record<string, string>,
): MerchantMemory[] {
  const map = new Map<string, MerchantMemory>();
  for (const t of txs) {
    const label = (t.notes ?? "").trim();
    const key = normalizeMerchant(label);
    if (!key || key.length < 2) continue;
    const cat = (t.category_id && categoryNameById[t.category_id]) || "Uncategorized";
    const ts = new Date(t.transaction_date).getTime();
    const cur = map.get(key);
    if (cur) {
      cur.count += 1;
      cur.total += Math.abs(Number(t.amount));
      cur.lastAt = Math.max(cur.lastAt, ts);
      // Prefer most common category — naive: keep first non-uncategorized
      if (cur.category === "Uncategorized" && cat !== "Uncategorized") cur.category = cat;
    } else {
      map.set(key, {
        key, display: label, category: cat,
        count: 1, total: Math.abs(Number(t.amount)),
        lastAt: ts, confirmed: false,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
