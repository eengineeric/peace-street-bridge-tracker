-- Peace Street Bridge Tracker v2.7 Beta Readiness
-- Adds beta feedback, scanner health/error logging, admin incident merge/split,
-- backup metadata, and the missing mid-July 2026 strike.
-- Safe to rerun.

create extension if not exists pgcrypto;


-- Defensive schema alignment for installations upgraded through earlier v2.x patches.
alter table public.bridge_incidents add column if not exists match_notes text;
alter table public.bridge_incidents add column if not exists date_precision text;
alter table public.bridge_incidents add column if not exists evidence_level text;
alter table public.bridge_incidents add column if not exists historical_notes text;
alter table public.bridge_incidents add column if not exists image_url text;
alter table public.bridge_reports add column if not exists image_url text;


-- 1) Add the missing mid-July 2026 physical strike.
do $$
declare
  v_incident uuid;
begin
  select id into v_incident
  from public.bridge_incidents
  where incident_date = date '2026-07-16'
    and (
      title ilike '%Peace Street%'
      or coalesce(location,'') ilike '%Peace Street%'
    )
  limit 1;

  if v_incident is null then
    insert into public.bridge_incidents (
      incident_at, incident_date, title, confidence, location,
      truck_type, damage_summary, date_precision, evidence_level,
      historical_notes, match_notes
    )
    values (
      '2026-07-16 12:00:00-04',
      date '2026-07-16',
      'Second mid-July Peace Street bridge strike',
      0.82,
      'Peace Street railroad bridge, Raleigh, NC',
      'truck',
      'A second truck was reported with its roof torn open shortly after the July 15 collision; WRAL subsequently described the July 21 collision as the third bridge strike within roughly one week.',
      'day',
      'secondary',
      'Exact impact time is not publicly verified. Noon is only a sorting placeholder.',
      'v2.7: distinct physical event inserted to reconcile the three-strikes-in-a-week sequence. Keep separate from July 15 and July 21.'
    )
    returning id into v_incident;
  end if;

  if not exists (
    select 1 from public.bridge_reports
    where source_url = 'https://www.reddit.com/r/raleigh/comments/1ux4yhl/the_bridge_strikes_with_a_can_opener/#july-16-followup'
  ) then
    insert into public.bridge_reports (
      incident_id, title, source_url, source_name, source_kind,
      published_at, incident_date, detected_incident_at, status,
      confidence, extraction_method, excerpt, location, truck_type, notes
    )
    values (
      v_incident,
      'Contemporaneous report of another damaged truck after July 15 Peace Street strike',
      'https://www.reddit.com/r/raleigh/comments/1ux4yhl/the_bridge_strikes_with_a_can_opener/#july-16-followup',
      'r/raleigh',
      'reddit',
      '2026-07-16 12:00:00-04',
      date '2026-07-16',
      '2026-07-16 12:00:00-04',
      'auto_confirmed',
      0.82,
      'community-report-plus-WRAL-sequence',
      'A July 16 community report described another truck with its roof torn off; later WRAL reporting described July 21 as the third strike in about a week.',
      'Peace Street railroad bridge, Raleigh, NC',
      'truck',
      'Secondary evidence; exact strike time remains unresolved.'
    );
  end if;
end $$;

-- 2) Beta feedback from testers.
create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'general',
  message text not null,
  page_url text,
  user_agent text,
  contact text,
  status text not null default 'new'
    check (status in ('new','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beta_feedback_status_idx
on public.beta_feedback(status, created_at desc);

alter table public.beta_feedback enable row level security;

-- 3) Scanner health and run history.
create table if not exists public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_kind text not null default 'unknown',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running','success','failed')),
  found integer not null default 0,
  relevant integer not null default 0,
  accepted integer not null default 0,
  new_incidents integer not null default 0,
  duplicates integer not null default 0,
  skipped integer not null default 0,
  notifications_sent integer not null default 0,
  news_items integer not null default 0,
  reddit_items integer not null default 0,
  error_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists scan_runs_started_idx
on public.scan_runs(started_at desc);

create index if not exists scan_runs_success_idx
on public.scan_runs(completed_at desc)
where status = 'success';

alter table public.scan_runs enable row level security;

-- 4) Lightweight server error monitoring.
create table if not exists public.app_error_log (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  message text not null,
  details text,
  request_path text,
  severity text not null default 'error'
    check (severity in ('info','warning','error','critical')),
  created_at timestamptz not null default now()
);

create index if not exists app_error_log_created_idx
on public.app_error_log(created_at desc);

alter table public.app_error_log enable row level security;

-- 5) Track when an admin explicitly downloaded a backup.
create table if not exists public.backup_exports (
  id uuid primary key default gen_random_uuid(),
  exported_at timestamptz not null default now(),
  table_counts jsonb,
  notes text
);

alter table public.backup_exports enable row level security;

-- 6) Merge two incidents. All source reports and RPD records move to target.
create or replace function public.admin_merge_bridge_incidents(
  p_target_incident_id uuid,
  p_source_incident_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.bridge_incidents%rowtype;
  v_source public.bridge_incidents%rowtype;
  v_reports integer := 0;
  v_rpd integer := 0;
begin
  if p_target_incident_id = p_source_incident_id then
    raise exception 'Target and source incident must be different.';
  end if;

  select * into v_target from public.bridge_incidents where id = p_target_incident_id;
  if not found then raise exception 'Target incident not found.'; end if;

  select * into v_source from public.bridge_incidents where id = p_source_incident_id;
  if not found then raise exception 'Source incident not found.'; end if;

  update public.bridge_reports
  set incident_id = p_target_incident_id, updated_at = now()
  where incident_id = p_source_incident_id;
  get diagnostics v_reports = row_count;

  if to_regclass('public.rpd_crash_records') is not null then
    update public.rpd_crash_records
    set linked_incident_id = p_target_incident_id, updated_at = now()
    where linked_incident_id = p_source_incident_id;
    get diagnostics v_rpd = row_count;
  end if;

  update public.bridge_incidents
  set
    confidence = greatest(coalesce(confidence,0), coalesce(v_source.confidence,0)),
    location = coalesce(location, v_source.location),
    travel_direction = coalesce(travel_direction, v_source.travel_direction),
    truck_type = coalesce(truck_type, v_source.truck_type),
    damage_summary = coalesce(damage_summary, v_source.damage_summary),
    injury_summary = coalesce(injury_summary, v_source.injury_summary),
    image_url = coalesce(image_url, v_source.image_url),
    historical_notes = concat_ws(E'\n', nullif(historical_notes,''), nullif(v_source.historical_notes,'')),
    match_notes = concat_ws('; ', nullif(match_notes,''), 'Admin merged incident ' || p_source_incident_id::text),
    updated_at = now()
  where id = p_target_incident_id;

  delete from public.bridge_incidents where id = p_source_incident_id;

  return jsonb_build_object(
    'ok', true,
    'target_incident_id', p_target_incident_id,
    'deleted_incident_id', p_source_incident_id,
    'moved_reports', v_reports,
    'moved_rpd_records', v_rpd
  );
end;
$$;

revoke all on function public.admin_merge_bridge_incidents(uuid,uuid) from public;
grant execute on function public.admin_merge_bridge_incidents(uuid,uuid) to service_role;

-- 7) Split one source report into a new physical incident.
create or replace function public.admin_split_bridge_report(
  p_report_id uuid,
  p_incident_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.bridge_reports%rowtype;
  v_old public.bridge_incidents%rowtype;
  v_new_id uuid;
  v_when timestamptz;
  v_date date;
begin
  select * into v_report from public.bridge_reports where id = p_report_id;
  if not found then raise exception 'Report not found.'; end if;
  if v_report.incident_id is null then raise exception 'Report is not linked to an incident.'; end if;

  select * into v_old from public.bridge_incidents where id = v_report.incident_id;
  if not found then raise exception 'Linked incident not found.'; end if;

  v_when := coalesce(p_incident_at, v_report.detected_incident_at, v_old.incident_at);
  v_date := (v_when at time zone 'America/New_York')::date;

  insert into public.bridge_incidents (
    incident_at, incident_date, title, confidence, location, travel_direction,
    truck_type, damage_summary, injury_summary, date_precision, evidence_level,
    historical_notes, image_url, match_notes
  )
  values (
    v_when,
    v_date,
    v_report.title,
    coalesce(v_report.confidence, v_old.confidence, 0.8),
    coalesce(v_report.location, v_old.location),
    coalesce(v_report.travel_direction, v_old.travel_direction),
    coalesce(v_report.truck_type, v_old.truck_type),
    coalesce(v_report.damage_summary, v_old.damage_summary),
    coalesce(v_report.injury_summary, v_old.injury_summary),
    case when p_incident_at is null then coalesce(v_old.date_precision,'exact') else 'exact' end,
    coalesce(v_old.evidence_level,'secondary'),
    concat_ws(E'\n', v_old.historical_notes, 'Created by admin split from incident ' || v_old.id::text),
    v_report.image_url,
    'Admin split using report ' || p_report_id::text
  )
  returning id into v_new_id;

  update public.bridge_reports
  set incident_id = v_new_id,
      incident_date = v_date,
      detected_incident_at = v_when,
      status = 'auto_confirmed',
      notes = concat_ws('; ', nullif(notes,''), 'Admin split into new incident ' || v_new_id::text),
      updated_at = now()
  where id = p_report_id;

  return jsonb_build_object(
    'ok', true,
    'old_incident_id', v_old.id,
    'new_incident_id', v_new_id,
    'report_id', p_report_id
  );
end;
$$;

revoke all on function public.admin_split_bridge_report(uuid,timestamptz) from public;
grant execute on function public.admin_split_bridge_report(uuid,timestamptz) to service_role;
