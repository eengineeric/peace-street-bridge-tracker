-- Peace Street Bridge Truck Strike Tracker v2.8
-- Beta feedback improvements: community strike reports/photo uploads with admin approval.
-- Safe to rerun.

create extension if not exists pgcrypto;

create table if not exists public.community_strike_reports (
  id uuid primary key default gen_random_uuid(),
  reported_incident_at timestamptz not null,
  description text not null,
  reporter_name text,
  reporter_contact text,
  location text not null default 'Peace Street railroad bridge, Raleigh, NC',
  photo_url text,
  photo_path text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  admin_notes text,
  reviewed_at timestamptz,
  approved_incident_id uuid references public.bridge_incidents(id) on delete set null,
  approved_report_id uuid references public.bridge_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_strike_reports_status_idx
on public.community_strike_reports(status, created_at desc);

alter table public.community_strike_reports enable row level security;

-- Uploads go through a server-side service-role API. The bucket is public only
-- so approved incident images can be displayed without exposing database keys.
insert into storage.buckets (id, name, public)
values ('community-strike-photos', 'community-strike-photos', true)
on conflict (id) do update set public = true;
