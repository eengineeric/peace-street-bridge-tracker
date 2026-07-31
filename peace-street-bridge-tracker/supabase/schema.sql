create extension if not exists pgcrypto;

create table if not exists public.bridge_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null unique,
  source_name text,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  status text not null default 'candidate' check (status in ('candidate', 'confirmed', 'rejected')),
  notes text
);

create index if not exists bridge_reports_status_idx on public.bridge_reports(status);
create index if not exists bridge_reports_published_at_idx on public.bridge_reports(published_at desc);

alter table public.bridge_reports enable row level security;
-- No public database policies are required: the app reads/writes only from server routes using the service-role key.
