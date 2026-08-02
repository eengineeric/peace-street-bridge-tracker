-- Peace Street Bridge Tracker v2.6
-- Raleigh Police historical-records integration.
-- Run after the existing v2.5.x migrations.

create extension if not exists pgcrypto;

create table if not exists public.rpd_data_imports (
  id uuid primary key default gen_random_uuid(),
  source_name text not null default 'Raleigh Police Department',
  source_file text,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  linked_count integer not null default 0,
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.rpd_crash_records (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.rpd_data_imports(id) on delete set null,
  report_number text,
  occurred_at timestamptz,
  incident_date date not null,
  time_precision text not null default 'day',
  location text,
  vehicle_type text,
  narrative text,
  contributing_circumstances text,
  linked_incident_id uuid references public.bridge_incidents(id) on delete set null,
  match_method text,
  source_name text not null default 'Raleigh Police Department',
  source_file text,
  raw_row jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists rpd_crash_records_report_number_uidx
  on public.rpd_crash_records(report_number)
  where report_number is not null and btrim(report_number) <> '';

create index if not exists rpd_crash_records_incident_date_idx
  on public.rpd_crash_records(incident_date desc);

create index if not exists rpd_crash_records_linked_incident_idx
  on public.rpd_crash_records(linked_incident_id);

alter table public.rpd_data_imports enable row level security;
alter table public.rpd_crash_records enable row level security;

-- Current official recent-period anchor. This is a lower bound, not an
-- invented set of individual dates.
insert into public.bridge_official_stats (
  source_name, source_url, window_start, window_end, crash_count, notes
)
select
  'Raleigh Police Department via WRAL',
  'https://www.wral.com/news/local/peace-street-peeler-what-will-it-take-to-make-a-raleigh-bridge-safer-july-24-2026/',
  date '2021-07-24',
  date '2026-07-24',
  13,
  'RPD reported 13 crashes involving the Peace Street bridge during the previous five years. Stored as an official lower bound until the underlying RPD records are imported.'
where not exists (
  select 1 from public.bridge_official_stats
  where source_name = 'Raleigh Police Department via WRAL'
    and window_start = date '2021-07-24'
    and window_end = date '2026-07-24'
);

create or replace function public.register_rpd_crash_record(
  p_import_id uuid,
  p_report_number text,
  p_occurred_at timestamptz,
  p_incident_date date,
  p_time_precision text,
  p_location text,
  p_vehicle_type text,
  p_narrative text,
  p_contributing_circumstances text,
  p_source_file text,
  p_raw_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.rpd_crash_records%rowtype;
  v_incident public.bridge_incidents%rowtype;
  v_same_day_count integer;
  v_new_incident_id uuid;
  v_record_id uuid;
  v_source_url text;
  v_match_method text;
begin
  if p_report_number is not null and btrim(p_report_number) <> '' then
    select * into v_existing
    from public.rpd_crash_records
    where report_number = p_report_number
    limit 1;

    if found then
      return jsonb_build_object(
        'record_id', v_existing.id,
        'incident_id', v_existing.linked_incident_id,
        'duplicate', true,
        'created_incident', false,
        'match_method', coalesce(v_existing.match_method, 'report-number')
      );
    end if;
  end if;

  -- Exact/approximate times: reconcile to an already documented event when
  -- it falls within 90 minutes.
  if p_occurred_at is not null and p_time_precision in ('exact','approximate') then
    select * into v_incident
    from public.bridge_incidents
    where abs(extract(epoch from (incident_at - p_occurred_at))) <= 5400
    order by abs(extract(epoch from (incident_at - p_occurred_at)))
    limit 1;

    if found then
      v_new_incident_id := v_incident.id;
      v_match_method := 'within-90-minutes';
    end if;
  end if;

  -- Day-only police records: if exactly one incident is already documented
  -- that day, link to it. If zero or multiple exist, preserve the police
  -- report as its own event instead of silently collapsing same-day strikes.
  if v_new_incident_id is null then
    select count(*) into v_same_day_count
    from public.bridge_incidents
    where incident_date = p_incident_date;

    if v_same_day_count = 1 and p_time_precision = 'day' then
      select * into v_incident
      from public.bridge_incidents
      where incident_date = p_incident_date
      limit 1;
      v_new_incident_id := v_incident.id;
      v_match_method := 'only-known-incident-that-day';
    end if;
  end if;

  if v_new_incident_id is null then
    insert into public.bridge_incidents (
      incident_at,
      incident_date,
      title,
      confidence,
      location,
      truck_type,
      damage_summary,
      date_precision,
      evidence_level,
      historical_notes,
      match_notes
    )
    values (
      coalesce(p_occurred_at, (p_incident_date::timestamp + interval '12 hours') at time zone 'America/New_York'),
      p_incident_date,
      case
        when p_report_number is not null and btrim(p_report_number) <> ''
          then 'RPD crash report ' || p_report_number || ' — Peace Street bridge strike'
        else 'RPD-documented Peace Street bridge strike'
      end,
      0.99,
      coalesce(p_location, 'Peace Street railroad bridge, Raleigh, NC'),
      p_vehicle_type,
      p_narrative,
      case when p_time_precision = 'day' then 'day' else 'exact' end,
      'primary',
      'Imported from an official Raleigh Police Department crash-record dataset.',
      'RPD import; report number ' || coalesce(p_report_number, 'not supplied')
    )
    returning id into v_new_incident_id;

    v_match_method := 'created-from-rpd-record';

    v_source_url := 'https://raleighnc.gov/police/services/how-obtain-police-report?rpd_report='
      || coalesce(nullif(regexp_replace(coalesce(p_report_number,''), '[^A-Za-z0-9_-]', '', 'g'), ''), v_new_incident_id::text);

    insert into public.bridge_reports (
      incident_id,
      title,
      source_url,
      source_name,
      source_kind,
      published_at,
      incident_date,
      detected_incident_at,
      status,
      confidence,
      extraction_method,
      excerpt,
      location,
      truck_type,
      notes
    )
    values (
      v_new_incident_id,
      case
        when p_report_number is not null and btrim(p_report_number) <> ''
          then 'Raleigh Police crash report ' || p_report_number
        else 'Raleigh Police crash record'
      end,
      v_source_url,
      'Raleigh Police Department',
      'police',
      now(),
      p_incident_date,
      p_occurred_at,
      'auto_confirmed',
      0.99,
      'official-rpd-record',
      left(coalesce(p_narrative, p_contributing_circumstances, 'Official RPD crash record.'), 800),
      p_location,
      p_vehicle_type,
      'Official police record imported through the tracker admin tool.'
    )
    on conflict (source_url) do nothing;
  end if;

  insert into public.rpd_crash_records (
    import_id,
    report_number,
    occurred_at,
    incident_date,
    time_precision,
    location,
    vehicle_type,
    narrative,
    contributing_circumstances,
    linked_incident_id,
    match_method,
    source_file,
    raw_row
  )
  values (
    p_import_id,
    nullif(btrim(coalesce(p_report_number,'')), ''),
    p_occurred_at,
    p_incident_date,
    coalesce(nullif(p_time_precision,''), 'day'),
    p_location,
    p_vehicle_type,
    p_narrative,
    p_contributing_circumstances,
    v_new_incident_id,
    v_match_method,
    p_source_file,
    p_raw_row
  )
  returning id into v_record_id;

  return jsonb_build_object(
    'record_id', v_record_id,
    'incident_id', v_new_incident_id,
    'duplicate', false,
    'created_incident', v_match_method = 'created-from-rpd-record',
    'match_method', v_match_method
  );
end;
$$;

revoke all on function public.register_rpd_crash_record(
  uuid,text,timestamptz,date,text,text,text,text,text,text,jsonb
) from public;

grant execute on function public.register_rpd_crash_record(
  uuid,text,timestamptz,date,text,text,text,text,text,text,jsonb
) to service_role;
