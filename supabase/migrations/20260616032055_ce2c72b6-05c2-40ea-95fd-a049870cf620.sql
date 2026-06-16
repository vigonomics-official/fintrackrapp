
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS age_group text,
  ADD COLUMN IF NOT EXISTS monthly_salary numeric,
  ADD COLUMN IF NOT EXISTS salary_date integer,
  ADD COLUMN IF NOT EXISTS financial_situation text,
  ADD COLUMN IF NOT EXISTS expense_categories text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS monthly_emi numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_loans integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_goal jsonb;
