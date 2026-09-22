-- Fix default/built-in category icon mapping.
-- Icons are rendered via lucide-react by name (see TransactionDialog / Categories page).
-- Only icon values change — no categories are created, deleted, or renamed.

-- Existing rows: correct wrong or duplicated icons.
update public.categories
  set icon = 'Briefcase'
  where type = 'income' and name = 'Salary' and icon <> 'Briefcase';

update public.categories
  set icon = 'Utensils'
  where type = 'expense' and name in ('Food', 'Food & Dining') and icon <> 'Utensils';

update public.categories
  set icon = 'HeartPulse'
  where type = 'expense' and name = 'Healthcare' and icon <> 'HeartPulse';

update public.categories
  set icon = 'Fuel'
  where type = 'expense' and name = 'Fuel' and icon <> 'Fuel';

update public.categories
  set icon = 'ShoppingBasket'
  where type = 'expense' and name = 'Grocery' and icon <> 'ShoppingBasket';

update public.categories
  set icon = 'House'
  where type = 'expense' and lower(name) = 'room rent' and icon <> 'House';

-- Keep the new-user seed consistent with the corrected mapping.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.categories (user_id, name, type, icon, color, is_default) values
    (new.id, 'Salary', 'income', 'Briefcase', '#0d7a5f', true),
    (new.id, 'Freelance', 'income', 'Laptop', '#10b981', true),
    (new.id, 'Investments', 'income', 'TrendingUp', '#059669', true),
    (new.id, 'Rental Income', 'income', 'Home', '#34d399', true),
    (new.id, 'Food & Dining', 'expense', 'Utensils', '#ef4444', true),
    (new.id, 'Transport', 'expense', 'Car', '#f97316', true),
    (new.id, 'Shopping', 'expense', 'ShoppingBag', '#ec4899', true),
    (new.id, 'Bills & Utilities', 'expense', 'Receipt', '#8b5cf6', true),
    (new.id, 'Healthcare', 'expense', 'HeartPulse', '#06b6d4', true),
    (new.id, 'Entertainment', 'expense', 'Film', '#f59e0b', true),
    (new.id, 'Education', 'expense', 'GraduationCap', '#3b82f6', true),
    (new.id, 'Travel', 'expense', 'Plane', '#14b8a6', true),
    (new.id, 'Subscriptions', 'expense', 'CreditCard', '#a855f7', true);
  return new;
end $$;
