-- Version 2.1: change deduplication to one counted incident per Raleigh calendar day.
-- Run once in Supabase SQL Editor after the Version 2 migration.

alter table public.bridge_incidents
  add column if not exists incident_date date;

update public.bridge_incidents
set incident_date = (incident_at at time zone 'America/New_York')::date
where incident_date is null;

-- Merge any existing multiple incidents from the same Raleigh date.
-- The earliest incident becomes the canonical daily record; all reports are re-linked to it.
with ranked as (
  select
    id,
    incident_date,
    first_value(id) over (
      partition by incident_date
      order by incident_at asc, created_at asc, id asc
    ) as canonical_id
  from public.bridge_incidents
), relink as (
  update public.bridge_reports r
  set incident_id = ranked.canonical_id,
      incident_date = ranked.incident_date,
      status = case when r.status = 'auto_confirmed' and r.incident_id <> ranked.canonical_id
                    then 'duplicate' else r.status end,
      updated_at = now()
  from ranked
  where r.incident_id = ranked.id
    and ranked.id <> ranked.canonical_id
  returning r.id
)
select count(*) from relink;

-- Preserve the best confidence and earliest time on each canonical daily incident.
with daily as (
  select
    incident_date,
    min(incident_at) as earliest_at,
    max(confidence) as best_confidence
  from public.bridge_incidents
  group by incident_date
), canonical as (
  select distinct on (incident_date)
    id, incident_date
  from public.bridge_incidents
  order by incident_date, incident_at asc, created_at asc, id asc
)
update public.bridge_incidents i
set incident_at = d.earliest_at,
    confidence = d.best_confidence,
    updated_at = now()
from daily d
join canonical c on c.incident_date = d.incident_date
where i.id = c.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by incident_date
      order by incident_at asc, created_at asc, id asc
    ) as rn
  from public.bridge_incidents
)
delete from public.bridge_incidents i
using ranked
where i.id = ranked.id
  and ranked.rn > 1;

alter table public.bridge_incidents
  alter column incident_date set not null;

create unique index if not exists bridge_incidents_incident_date_uidx
  on public.bridge_incidents (incident_date);

create or replace function public.register_bridge_report(
  p_title text,
  p_source_url text,
  p_source_name text,
  p_published_at timestamptz,
  p_detected_incident_at timestamptz,
  p_confidence double precision,
  p_extraction_method text,
  p_excerpt text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_report public.bridge_reports%rowtype;
  v_incident public.bridge_incidents%rowtype;
  v_report public.bridge_reports%rowtype;
  v_incident_date date := (p_detected_incident_at at time zone 'America/New_York')::date;
  v_created boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('peace-street-bridge-incident-registration'));

  select * into v_existing_report
  from public.bridge_reports
  where source_url = p_source_url
  limit 1;

  if found then
    return jsonb_build_object(
      'report_id', v_existing_report.id,
      'incident_id', v_existing_report.incident_id,
      'created_incident', false,
      'duplicate_source', true
    );
  end if;

  -- Count no more than one incident on each Raleigh calendar date.
  select * into v_incident
  from public.bridge_incidents
  where incident_date = v_incident_date
  limit 1;

  if not found then
    insert into public.bridge_incidents (incident_at, incident_date, title, confidence)
    values (p_detected_incident_at, v_incident_date, p_title, p_confidence)
    returning * into v_incident;
    v_created := true;
  else
    update public.bridge_incidents
    set incident_at = least(incident_at, p_detected_incident_at),
        confidence = greatest(confidence, p_confidence),
        updated_at = now()
    where id = v_incident.id
    returning * into v_incident;
  end if;

  insert into public.bridge_reports (
    incident_id, title, source_url, source_name, published_at, incident_date,
    detected_incident_at, status, confidence, extraction_method, excerpt
  ) values (
    v_incident.id, p_title, p_source_url, coalesce(nullif(p_source_name, ''), 'Unknown source'),
    p_published_at, v_incident_date, p_detected_incident_at,
    case when v_created then 'auto_confirmed' else 'duplicate' end,
    p_confidence, p_extraction_method, left(p_excerpt, 800)
  ) returning * into v_report;

  return jsonb_build_object(
    'report_id', v_report.id,
    'incident_id', v_incident.id,
    'created_incident', v_created,
    'duplicate_source', false
  );
end;
$$;

revoke all on function public.register_bridge_report(text,text,text,timestamptz,timestamptz,double precision,text,text) from public;
grant execute on function public.register_bridge_report(text,text,text,timestamptz,timestamptz,double precision,text,text) to service_role;
