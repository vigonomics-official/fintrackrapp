const SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", AUD: "A$", CAD: "C$",
};

export function formatCurrency(amount: number, currency = "USD") {
  const symbol = SYMBOLS[currency] ?? currency + " ";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${symbol}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const CURRENCIES = Object.keys(SYMBOLS);
