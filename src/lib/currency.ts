import { getLocalization, numberLocale, SUPPORTED_CURRENCIES } from "./localization";

const SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", AUD: "A$", CAD: "C$", AED: "AED ",
};

const LOCALES: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  JPY: "ja-JP",
  AUD: "en-AU",
  CAD: "en-CA",
  AED: "en-AE",
};

export function formatCurrency(amount: number, currency?: string) {
  const prefs = getLocalization();
  const code = currency ?? prefs.currency;
  const symbol = SYMBOLS[code] ?? code + " ";
  // Number grouping follows the user's number-format preference; falls back to
  // the currency's own locale when nothing is configured.
  const locale = prefs.numberFormat
    ? numberLocale(prefs.numberFormat)
    : (LOCALES[code] ?? "en-IN");
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${symbol}${abs.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const CURRENCIES = SUPPORTED_CURRENCIES.map((c) => c.code);
