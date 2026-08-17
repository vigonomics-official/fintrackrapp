// Conservative item -> category resolution for "Can I Buy This?".
//
// HARD RULE (FIX 2): never invent a category. A category is returned ONLY when
// a high-confidence keyword matches AND the user actually has a matching
// expense category in FinTrackr. Anything ambiguous resolves to null.

export type ResolvedPurchaseCategory = {
  categoryId: string;
  categoryName: string;
  /** canonical label the keyword matched */
  canonical: string;
  matchedKeyword: string;
};

type CategoryLike = { id: string; name: string; type?: string };

/** canonical label -> unambiguous keywords (whole-word matched). */
const KEYWORDS: Record<string, string[]> = {
  Grocery: [
    "grocery", "groceries", "vegetables", "vegetable", "rice bag", "atta", "milk", "supermarket",
    "bigbasket", "blinkit", "zepto", "dmart", "kirana", "provisions",
  ],
  Transport: [
    "bus ticket", "bus pass", "bus fare", "metro ticket", "metro card", "metro pass", "auto fare",
    "cab", "taxi", "uber", "ola", "rapido", "train ticket", "railway ticket", "irctc",
  ],
  Fuel: ["petrol", "diesel", "fuel", "cng"],
  Food: ["swiggy", "zomato", "restaurant", "lunch", "dinner", "breakfast", "takeaway", "food delivery"],
  Dining: ["dine out", "dining", "cafe"],
  Health: ["medicine", "medicines", "pharmacy", "doctor", "hospital", "tablets", "apollo", "pharmeasy", "1mg"],
  Shopping: ["shirt", "tshirt", "t-shirt", "jeans", "shoes", "dress", "clothes", "clothing", "myntra"],
  Subscription: ["netflix", "spotify", "hotstar", "prime subscription", "subscription"],
  Recharge: ["recharge", "mobile recharge", "data pack", "airtel", "jio"],
  Bills: ["electricity bill", "water bill", "gas bill", "broadband", "wifi bill", "internet bill"],
  Travel: ["flight ticket", "flight", "hotel booking", "makemytrip", "goibibo"],
  Education: ["tuition fee", "course fee", "school fee", "college fee", "textbook"],
  Rent: ["house rent", "room rent"],
};

/** Accepted user category names for each canonical label (lowercase). */
const ALIASES: Record<string, string[]> = {
  Grocery: ["grocery", "groceries", "food & groceries", "supermarket"],
  Transport: ["transport", "transportation", "travel & transport", "commute"],
  Fuel: ["fuel", "petrol", "transport"],
  Food: ["food", "food & dining", "dining", "restaurants", "eating out"],
  Dining: ["dining", "food & dining", "restaurants", "food"],
  Health: ["health", "healthcare", "medical", "health & medical"],
  Shopping: ["shopping", "clothing", "apparel"],
  Subscription: ["subscription", "subscriptions", "entertainment"],
  Recharge: ["recharge", "mobile", "phone", "bills & utilities", "utilities"],
  Bills: ["bills", "utilities", "bills & utilities"],
  Travel: ["travel", "travel & transport", "holiday"],
  Education: ["education", "learning"],
  Rent: ["rent", "housing"],
};

function hasKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

/**
 * Returns the user's own category for an item name, or null when the item is
 * ambiguous / no matching FinTrackr category exists.
 */
export function detectPurchaseCategory(
  itemName: string,
  categories: CategoryLike[],
): ResolvedPurchaseCategory | null {
  const text = String(itemName ?? "").toLowerCase().trim();
  if (text.length < 2) return null;

  const expense = categories.filter((c) => !c.type || c.type === "expense");
  if (expense.length === 0) return null;

  // Direct name match first (user's own vocabulary wins).
  for (const c of expense) {
    const name = c.name.toLowerCase().trim();
    if (name.length >= 4 && hasKeyword(text, name)) {
      return { categoryId: c.id, categoryName: c.name, canonical: c.name, matchedKeyword: name };
    }
  }

  // Keyword lexicon -> canonical label -> user's category by alias.
  const hits: { canonical: string; keyword: string }[] = [];
  for (const [canonical, keywords] of Object.entries(KEYWORDS)) {
    for (const kw of keywords) {
      if (hasKeyword(text, kw)) {
        hits.push({ canonical, keyword: kw });
        break;
      }
    }
  }
  if (hits.length === 0) return null;

  // Ambiguous: multiple distinct canonical labels that are not aliases of each other.
  const canonicals = [...new Set(hits.map((h) => h.canonical))];
  if (canonicals.length > 1) {
    const shared = canonicals.every((c) =>
      canonicals.some((o) => o !== c && (ALIASES[c] ?? []).some((a) => (ALIASES[o] ?? []).includes(a))),
    );
    if (!shared) return null;
  }

  // Prefer the longest matched keyword for stability.
  const best = hits.sort((a, b) => b.keyword.length - a.keyword.length)[0]!;
  const aliases = ALIASES[best.canonical] ?? [best.canonical.toLowerCase()];
  const match =
    expense.find((c) => c.name.toLowerCase().trim() === best.canonical.toLowerCase()) ??
    expense.find((c) => aliases.includes(c.name.toLowerCase().trim()));
  if (!match) return null;

  return {
    categoryId: match.id,
    categoryName: match.name,
    canonical: best.canonical,
    matchedKeyword: best.keyword,
  };
}
