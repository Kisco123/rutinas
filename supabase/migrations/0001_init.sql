-- Extensión necesaria para gen_random_uuid()
create extension if not exists pgcrypto;

-- =====================================================
-- profiles
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  timezone text not null default 'Europe/Madrid',
  locale text not null default 'es',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger: crear fila en profiles al registrarse un usuario nuevo
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- events
-- =====================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  category text not null default 'otro'
    check (category in ('medico', 'familia', 'trabajo', 'personal', 'otro')),
  source text not null default 'manual'
    check (source in ('manual', 'ai_text', 'ai_email')),
  created_at timestamptz not null default now()
);

create index events_user_starts on public.events (user_id, starts_at);

alter table public.events enable row level security;

create policy "events_select_own" on public.events for select using (auth.uid() = user_id);
create policy "events_insert_own" on public.events for insert with check (auth.uid() = user_id);
create policy "events_update_own" on public.events for update using (auth.uid() = user_id);
create policy "events_delete_own" on public.events for delete using (auth.uid() = user_id);

-- =====================================================
-- bills
-- =====================================================
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(12, 2),
  currency text not null default 'EUR',
  due_date date not null,
  paid boolean not null default false,
  recurrence text not null default 'none'
    check (recurrence in ('none', 'monthly', 'yearly')),
  provider text,
  notes text,
  source text not null default 'manual'
    check (source in ('manual', 'ai_text', 'ai_email')),
  created_at timestamptz not null default now()
);

create index bills_user_due on public.bills (user_id, due_date);

alter table public.bills enable row level security;

create policy "bills_select_own" on public.bills for select using (auth.uid() = user_id);
create policy "bills_insert_own" on public.bills for insert with check (auth.uid() = user_id);
create policy "bills_update_own" on public.bills for update using (auth.uid() = user_id);
create policy "bills_delete_own" on public.bills for delete using (auth.uid() = user_id);

-- =====================================================
-- oauth_tokens (acceso solo desde service_role)
-- =====================================================
create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz,
  scope text,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.oauth_tokens enable row level security;
-- Sin políticas: ningún cliente puede leer ni escribir. Solo service_role (bypass RLS).

-- =====================================================
-- email_classifications
-- =====================================================
create table public.email_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  from_name text,
  from_email text,
  subject text,
  snippet text,
  received_at timestamptz,
  category text not null
    check (category in ('urgente', 'importante', 'informativo', 'ruido')),
  one_line_summary text,
  suggested_action text not null default 'ninguna'
    check (suggested_action in ('crear_evento', 'crear_factura', 'ninguna')),
  classified_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index email_class_user_received on public.email_classifications (user_id, received_at desc);

alter table public.email_classifications enable row level security;

create policy "email_class_select_own" on public.email_classifications for select using (auth.uid() = user_id);
create policy "email_class_insert_own" on public.email_classifications for insert with check (auth.uid() = user_id);
create policy "email_class_update_own" on public.email_classifications for update using (auth.uid() = user_id);
create policy "email_class_delete_own" on public.email_classifications for delete using (auth.uid() = user_id);

-- =====================================================
-- daily_summaries
-- =====================================================
create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null,
  generated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_summaries enable row level security;

create policy "daily_select_own" on public.daily_summaries for select using (auth.uid() = user_id);
create policy "daily_insert_own" on public.daily_summaries for insert with check (auth.uid() = user_id);
create policy "daily_update_own" on public.daily_summaries for update using (auth.uid() = user_id);
