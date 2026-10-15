import { supabase } from "@/integrations/supabase/client";

export type LoanPaymentKind = "emi" | "extra" | "payoff";

/** EMI period key (YYYY-MM) — one regular EMI per loan per period. */
export function emiPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function newRequestId() {
  return crypto.randomUUID();
}

/** A payment counts toward history/obligations only when it is not a reversal and not reversed. */
export function isActivePayment(p: { kind?: string | null; reversed_at?: string | null }) {
  return p.kind !== "reversal" && !p.reversed_at;
}

/**
 * Records a payment and updates the loan balance in one database transaction.
 * Re-sending the same requestId returns the already-saved payment (safe retry).
 */
export async function recordLoanPayment(args: {
  loanId: string; amount: number; kind: LoanPaymentKind; requestId: string; period?: string;
}) {
  return supabase.rpc("record_loan_payment" as any, {
    _loan_id: args.loanId,
    _amount: args.amount,
    _kind: args.kind,
    _period: args.period ?? emiPeriod(),
    _request_id: args.requestId,
  });
}

/** Reverses a payment: marks it reversed, logs a reversal entry, restores the balance — atomically. */
export async function reverseLoanPayment(paymentId: string, requestId: string) {
  return supabase.rpc("reverse_loan_payment" as any, {
    _payment_id: paymentId,
    _request_id: requestId,
  });
}
