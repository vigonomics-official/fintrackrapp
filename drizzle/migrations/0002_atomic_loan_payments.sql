ALTER TABLE public.loan_payments
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS emi_period text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'emi',
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverses_payment_id uuid REFERENCES public.loan_payments(id);

CREATE UNIQUE INDEX IF NOT EXISTS loan_payments_request_id_key
  ON public.loan_payments(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS loan_payments_one_emi_per_period
  ON public.loan_payments(loan_id, emi_period)
  WHERE kind = 'emi' AND emi_period IS NOT NULL AND reversed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS loan_payments_one_reversal
  ON public.loan_payments(reverses_payment_id) WHERE reverses_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_loan_payment(
  _loan_id uuid, _amount numeric, _kind text, _period text, _request_id uuid)
RETURNS public.loan_payments
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _loan public.loans;
  _existing public.loan_payments;
  _amt numeric;
  _row public.loan_payments;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'Missing request id'; END IF;
  IF _kind NOT IN ('emi','extra','payoff') THEN RAISE EXCEPTION 'Invalid payment kind'; END IF;
  IF _period IS NULL OR _period !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'Invalid EMI period'; END IF;

  SELECT * INTO _existing FROM public.loan_payments WHERE request_id = _request_id AND user_id = _uid;
  IF FOUND THEN RETURN _existing; END IF;

  SELECT * INTO _loan FROM public.loans WHERE id = _loan_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF _loan.remaining_balance <= 0 THEN RAISE EXCEPTION 'This loan is already paid off'; END IF;

  IF _kind = 'emi' AND EXISTS (
    SELECT 1 FROM public.loan_payments
    WHERE loan_id = _loan_id AND kind = 'emi' AND emi_period = _period AND reversed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The EMI for this period is already recorded';
  END IF;

  _amt := CASE WHEN _kind = 'payoff' THEN _loan.remaining_balance ELSE LEAST(_amount, _loan.remaining_balance) END;
  IF _amt IS NULL OR _amt <= 0 THEN RAISE EXCEPTION 'Enter a payment amount'; END IF;

  INSERT INTO public.loan_payments (loan_id, user_id, payment_date, payment_amount, remaining_balance,
    payment_status, request_id, emi_period, kind)
  VALUES (_loan_id, _uid, CURRENT_DATE, _amt, _loan.remaining_balance - _amt,
    'paid', _request_id, _period, _kind)
  RETURNING * INTO _row;

  UPDATE public.loans SET remaining_balance = _loan.remaining_balance - _amt WHERE id = _loan_id;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_loan_payment(_payment_id uuid, _request_id uuid)
RETURNS public.loan_payments
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.loan_payments;
  _loan public.loans;
  _existing public.loan_payments;
  _row public.loan_payments;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'Missing request id'; END IF;

  SELECT * INTO _existing FROM public.loan_payments WHERE request_id = _request_id AND user_id = _uid;
  IF FOUND THEN RETURN _existing; END IF;

  SELECT * INTO _p FROM public.loan_payments WHERE id = _payment_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF _p.kind = 'reversal' THEN RAISE EXCEPTION 'A reversal cannot be reversed'; END IF;
  IF _p.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'This payment was already reversed'; END IF;

  SELECT * INTO _loan FROM public.loans WHERE id = _p.loan_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;

  UPDATE public.loan_payments SET reversed_at = now() WHERE id = _p.id;

  INSERT INTO public.loan_payments (loan_id, user_id, payment_date, payment_amount, remaining_balance,
    payment_status, request_id, emi_period, kind, reverses_payment_id)
  VALUES (_p.loan_id, _uid, CURRENT_DATE, _p.payment_amount, _loan.remaining_balance + _p.payment_amount,
    'paid', _request_id, _p.emi_period, 'reversal', _p.id)
  RETURNING * INTO _row;

  UPDATE public.loans SET remaining_balance = _loan.remaining_balance + _p.payment_amount WHERE id = _p.loan_id;
  RETURN _row;
END $$;

REVOKE ALL ON FUNCTION public.record_loan_payment(uuid, numeric, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_loan_payment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_loan_payment(uuid, uuid) TO authenticated;