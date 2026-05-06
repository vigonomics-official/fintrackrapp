export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "wallet", label: "Wallet" },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]["value"];
