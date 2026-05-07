
-- Loan type enum
DO $$ BEGIN
  CREATE TYPE public.loan_type AS ENUM (
    'home','personal','vehicle','education','gold','credit_card','informal','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.loan_payment_status AS ENUM ('paid','pending','missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  loan_name text NOT NULL,
  loan_type public.loan_type NOT NULL DEFAULT 'personal',
  total_amount numeric NOT NULL,
  interest_rate numeric NOT NULL DEFAULT 0,
  emi_amount numeric NOT NULL,
  tenure_months integer NOT NULL,
  remaining_balance numeric NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  due_day integer NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY loans_all_own ON public.loans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER loans_touch_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_loans_user ON public.loans(user_id);

CREATE TABLE public.loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_amount numeric NOT NULL,
  remaining_balance numeric NOT NULL,
  payment_status public.loan_payment_status NOT NULL DEFAULT 'paid',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY loan_payments_all_own ON public.loan_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_loan_payments_loan ON public.loan_payments(loan_id);
CREATE INDEX idx_loan_payments_user ON public.loan_payments(user_id);
