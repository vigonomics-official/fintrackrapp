
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  email text,
  avatar_url text,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- CATEGORIES
create type public.category_type as enum ('income','expense');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  type public.category_type not null,
  icon text not null default 'Tag',
  color text not null default '#0d7a5f',
  parent_id uuid references public.categories(id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "cat_all_own" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.categories(user_id);

-- TRANSACTIONS
create type public.transaction_type as enum ('income','expense','transfer');
create type public.payment_method as enum ('cash','bank','upi','credit_card','debit_card','wallet');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type public.transaction_type not null,
  amount numeric(14,2) not null check (amount >= 0),
  category_id uuid references public.categories(id) on delete set null,
  subcategory text,
  payment_method public.payment_method not null default 'cash',
  notes text,
  tags text[] not null default '{}',
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create policy "tx_all_own" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.transactions(user_id, transaction_date desc);

-- BUDGETS
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  monthly_limit numeric(14,2) not null check (monthly_limit >= 0),
  month date not null,
  created_at timestamptz not null default now(),
  unique(user_id, category_id, month)
);
alter table public.budgets enable row level security;
create policy "bud_all_own" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- Handle new user: create profile + seed default categories
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
    (new.id, 'Food & Dining', 'expense', 'UtensilsCrossed', '#ef4444', true),
    (new.id, 'Transport', 'expense', 'Car', '#f97316', true),
    (new.id, 'Shopping', 'expense', 'ShoppingBag', '#ec4899', true),
    (new.id, 'Bills & Utilities', 'expense', 'Receipt', '#8b5cf6', true),
    (new.id, 'Healthcare', 'expense', 'Heart', '#06b6d4', true),
    (new.id, 'Entertainment', 'expense', 'Film', '#f59e0b', true),
    (new.id, 'Education', 'expense', 'GraduationCap', '#3b82f6', true),
    (new.id, 'Travel', 'expense', 'Plane', '#14b8a6', true),
    (new.id, 'Subscriptions', 'expense', 'CreditCard', '#a855f7', true);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
