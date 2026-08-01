-- Fresh-install schema for the automatic tracker.
create extension if not exists pgcrypto;

create table if not exists public.bridge_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_at timestamptz not null,
  title text not null,
  confidence double precision not null default 0.9 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bridge_reports (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.bridge_incidents(id) on delete set null,
  title text not null,
  source_url text not null unique,
  source_name text not null default 'Unknown source',
  published_at timestamptz not null,
  incident_date date not null,
  detected_incident_at timestamptz,
  status text not null default 'skipped' check (status in ('candidate', 'confirmed', 'rejected', 'auto_confirmed', 'duplicate', 'skipped')),
  confidence double precision,
  extraction_method text,
  excerpt text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bridge_incidents_incident_at_idx on public.bridge_incidents(incident_at desc);
create index if not exists bridge_reports_status_idx on public.bridge_reports(status);
create index if not exists bridge_reports_incident_id_idx on public.bridge_reports(incident_id);
create index if not exists bridge_reports_detected_incident_at_idx on public.bridge_reports(detected_incident_at desc);

alter table public.bridge_incidents enable row level security;
alter table public.bridge_reports enable row level security;

create or replace function public.register_bridge_report(
  p_title text, p_source_url text, p_source_name text, p_published_at timestamptz,
  p_detected_incident_at timestamptz, p_confidence double precision,
  p_extraction_method text, p_excerpt text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_existing_report public.bridge_reports%rowtype;
  v_incident public.bridge_incidents%rowtype;
  v_report public.bridge_reports%rowtype;
  v_created boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('peace-street-bridge-incident-registration'));
  select * into v_existing_report from public.bridge_reports where source_url = p_source_url limit 1;
  if found then
    return jsonb_build_object('report_id', v_existing_report.id, 'incident_id', v_existing_report.incident_id, 'created_incident', false, 'duplicate_source', true);
  end if;
  select * into v_incident from public.bridge_incidents
  where incident_at between p_detected_incident_at - interval '30 minutes' and p_detected_incident_at + interval '30 minutes'
  order by abs(extract(epoch from (incident_at - p_detected_incident_at))) limit 1;
  if not found then
    insert into public.bridge_incidents (incident_at, title, confidence) values (p_detected_incident_at, p_title, p_confidence) returning * into v_incident;
    v_created := true;
  else
    update public.bridge_incidents set confidence = greatest(confidence, p_confidence), updated_at = now() where id = v_incident.id;
  end if;
  insert into public.bridge_reports (incident_id,title,source_url,source_name,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt)
  values (v_incident.id,p_title,p_source_url,coalesce(nullif(p_source_name,''),'Unknown source'),p_published_at,(p_detected_incident_at at time zone 'America/New_York')::date,p_detected_incident_at,case when v_created then 'auto_confirmed' else 'duplicate' end,p_confidence,p_extraction_method,left(p_excerpt,800)) returning * into v_report;
  return jsonb_build_object('report_id',v_report.id,'incident_id',v_incident.id,'created_incident',v_created,'duplicate_source',false);
end;
$$;

revoke all on function public.register_bridge_report(text,text,text,timestamptz,timestamptz,double precision,text,text) from public;
grant execute on function public.register_bridge_report(text,text,text,timestamptz,timestamptz,double precision,text,text) to service_role;
