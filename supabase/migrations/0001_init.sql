-- 0001_init.sql
-- HerShield initial schema + Row Level Security (RLS)
-- Source of truth: docs/PHASE_0_DESIGN.md §3 and §4.
-- Apply in the Supabase SQL editor (or `supabase db push`).
--
-- Security model:
--   * Client (anon key + user JWT) may only touch its OWN rows (RLS policies below).
--   * test_utterances / experiment_results have NO client write policies;
--     only the service-role key (server-side / experiments harness) can write them.
--   * notification_log rows are always status='SIMULATED'. There is no real dispatch path.

-- 1. PROFILES: one row per auth user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-create profile on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- keep updated_at fresh on profile updates
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- 2. CONTACTS
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  relation text,
  created_at timestamptz not null default now()
);

-- 3. EMERGENCY EVENTS
create table public.emergency_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('manual_sos', 'voice_detected')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  intent_level text,
  threat_level text,
  safety_mode text,
  journey_status text,
  transcript text,
  transcript_summary text,
  trigger_source text,
  location_lat double precision,
  location_lng double precision,
  location_accuracy double precision,
  asr_confidence double precision,
  decision_reason text,        -- explainability: e.g. "intent HIGH + threat HIGH + safety ACTIVE = 5 -> MEDIUM"
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index emergency_events_user_created_idx on public.emergency_events(user_id, created_at desc);

-- 4. NOTIFICATION LOG (SIMULATION AUDIT TRAIL)
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.emergency_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  channel text not null default 'simulated_email',
  status text not null default 'SIMULATED' check (status in ('SIMULATED')),
  payload jsonb,
  created_at timestamptz not null default now()
);

-- 5. TEST UTTERANCES (locked evaluation data; seeded by experiments harness only)
create table public.test_utterances (
  id uuid primary key default gen_random_uuid(),
  utterance text not null,
  label text not null check (label in ('EMERGENCY', 'NOT_EMERGENCY', 'AMBIGUOUS')),
  category text not null,        -- e.g. 'false_trigger', 'clean', 'emergency_phrasing'
  split text not null check (split in ('train', 'val', 'test')),
  source text,
  created_at timestamptz not null default now()
);

-- 6. EXPERIMENT RESULTS (written only by the harness with service role)
create table public.experiment_results (
  id uuid primary key default gen_random_uuid(),
  model_name text not null check (model_name in ('A_keyword', 'B_intent', 'C_context', 'D_all')),
  split text not null default 'test',
  run_date timestamptz not null default now(),
  metrics jsonb not null,        -- {accuracy, precision, recall, f1, fpr, fnr, latency_ms}
  details jsonb,                 -- per-item predictions, thresholds, config (audit trail)
  notes text
);

-- ============ ROW LEVEL SECURITY ============

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.emergency_events enable row level security;
alter table public.notification_log enable row level security;
alter table public.test_utterances enable row level security;
alter table public.experiment_results enable row level security;

-- PROFILES: user manages own row; trigger handles insert on signup
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

-- CONTACTS: owner-only CRUD
create policy contacts_all_own on public.contacts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- EVENTS: owner can insert/select/update (resolve); no client delete
create policy events_insert_own on public.emergency_events
  for insert with check (user_id = auth.uid());
create policy events_select_own on public.emergency_events
  for select using (user_id = auth.uid());
create policy events_update_own on public.emergency_events
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- NOTIFICATION LOG: owner can read; app creates SIMULATED rows for own events
create policy notif_select_own on public.notification_log
  for select using (user_id = auth.uid());
create policy notif_insert_own on public.notification_log
  for insert with check (user_id = auth.uid());

-- TEST UTTERANCES: readable by any authenticated user (team/dev); no client writes
create policy test_utterances_read_auth on public.test_utterances
  for select using (auth.role() = 'authenticated');

-- EXPERIMENT RESULTS: readable by any authenticated user; no client writes
create policy experiment_results_read_auth on public.experiment_results
  for select using (auth.role() = 'authenticated');