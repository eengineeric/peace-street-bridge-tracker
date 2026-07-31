create extension if not exists pgcrypto;

create table if not exists public.bridge_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null unique,
  source_name text not null default 'Unknown source',
  published_at timestamptz not null,
  incident_date date not null,
  status text not null default 'candidate' check (status in ('candidate', 'confirmed', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bridge_reports_status_idx on public.bridge_reports(status);
create index if not exists bridge_reports_incident_date_idx on public.bridge_reports(incident_date desc);

alter table public.bridge_reports enable row level security;

-- No public policies are created. All database access occurs through server-side
-- routes using the Supabase service-role/secret key.
