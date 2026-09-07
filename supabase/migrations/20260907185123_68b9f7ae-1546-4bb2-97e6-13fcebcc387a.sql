CREATE TABLE public.purchase_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  estimated_price numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Other',
  priority text NOT NULL DEFAULT 'Medium',
  target_date date,
  notes text,
  status text NOT NULL DEFAULT 'planned',
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_list TO authenticated;
GRANT ALL ON public.purchase_list TO service_role;

ALTER TABLE public.purchase_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchase_list_all_own ON public.purchase_list
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER purchase_list_touch_updated_at
  BEFORE UPDATE ON public.purchase_list
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();