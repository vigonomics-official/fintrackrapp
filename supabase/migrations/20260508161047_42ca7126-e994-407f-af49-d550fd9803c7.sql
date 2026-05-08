
create table public.import_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null default 'generic',
  file_name text not null,
  file_type text not null,
  total_rows integer not null default 0,
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  total_amount numeric not null default 0,
  status text not null default 'success',
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.import_history enable row level security;
create policy "import_history_all_own" on public.import_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.import_errors (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.import_history(id) on delete cascade,
  user_id uuid not null,
  row_number integer not null,
  reason text not null,
  raw_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.import_errors enable row level security;
create policy "import_errors_all_own" on public.import_errors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_import_history_user on public.import_history(user_id, created_at desc);
create index idx_import_errors_import on public.import_errors(import_id);
