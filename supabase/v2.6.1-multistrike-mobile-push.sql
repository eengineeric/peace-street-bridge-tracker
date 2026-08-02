-- Peace Street Bridge Tracker v2.6.1
-- Correct July 30, 2026 to two physical strikes and tighten scanner event matching.
-- Safe to rerun.

-- Remove any obsolete one-incident-per-day uniqueness.
drop index if exists public.bridge_incidents_incident_date_uidx;

-- Normalize the existing combined July 30 record to represent the first strike.
update public.bridge_incidents
set
  title = 'First Peace Street bridge strike of July 30, 2026',
  incident_at = '2026-07-30 11:00:00-04',
  incident_date = date '2026-07-30',
  truck_type = coalesce(nullif(truck_type, ''), 'box truck'),
  damage_summary = 'Truck roof was torn open in the first documented strike of the day.',
  match_notes = concat_ws('; ', nullif(match_notes, ''), 'v2.6.1: normalized combined July 30 card to the first physical strike; a second same-day incident is stored separately.'),
  updated_at = now()
where incident_date = date '2026-07-30'
  and (
    title ilike '%two trucks strike%'
    or title ilike '%two truck%peace street%'
    or damage_summary ilike '%separate same-day strikes%'
  );

-- Ensure the second July 30 strike exists as its own incident.
do $$
declare
  v_second uuid;
begin
  select id into v_second
  from public.bridge_incidents
  where incident_date = date '2026-07-30'
    and incident_at >= '2026-07-30 12:30:00-04'
    and incident_at <= '2026-07-30 14:30:00-04'
  order by abs(extract(epoch from (incident_at - '2026-07-30 13:00:00-04'::timestamptz)))
  limit 1;

  if v_second is null then
    insert into public.bridge_incidents (
      incident_at, incident_date, title, confidence, location,
      truck_type, damage_summary, match_notes
    )
    values (
      '2026-07-30 13:00:00-04',
      date '2026-07-30',
      'Second Peace Street bridge strike of July 30, 2026',
      0.93,
      'Peace Street railroad bridge, Raleigh, NC',
      'tractor-trailer',
      'A second truck struck the bridge later the same day; this is a distinct physical impact from the earlier strike.',
      'v2.6.1 distinct same-day event; contemporaneous reporting described a second strike around 1 p.m.'
    )
    returning id into v_second;
  end if;

  if not exists (
    select 1 from public.bridge_reports
    where source_url = 'https://www.reddit.com/r/raleigh/comments/1vawe5j/can_opener_of_raleigh_strike_again/#second-strike-1pm'
  ) then
    insert into public.bridge_reports (
      incident_id, title, source_url, source_name, source_kind,
      published_at, incident_date, detected_incident_at, status,
      confidence, extraction_method, excerpt, location, truck_type, damage_summary, notes
    )
    values (
      v_second,
      'Second Peace Street bridge strike of July 30, 2026',
      'https://www.reddit.com/r/raleigh/comments/1vawe5j/can_opener_of_raleigh_strike_again/#second-strike-1pm',
      'r/raleigh',
      'reddit',
      '2026-07-30 13:00:00-04',
      date '2026-07-30',
      '2026-07-30 13:00:00-04',
      'auto_confirmed',
      0.93,
      'explicit-second-same-day-event',
      'Contemporaneous reporting described another strike around 1 p.m., explicitly separate from the earlier strike.',
      'Peace Street railroad bridge, Raleigh, NC',
      'tractor-trailer',
      'Second truck impact of the day.',
      'v2.6.1: preserved as a distinct physical event.'
    );
  end if;
end $$;

-- Replace scanner registration RPC with physical-event-first matching.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'register_bridge_report'
  loop
    execute 'drop function if exists ' || r.signature;
  end loop;
end $$;

create function public.register_bridge_report(
  p_title text, p_source_url text, p_source_name text, p_published_at timestamptz,
  p_detected_incident_at timestamptz, p_confidence double precision,
  p_extraction_method text, p_excerpt text, p_source_kind text,
  p_location text, p_travel_direction text, p_truck_type text,
  p_damage_summary text, p_injury_summary text
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
  v_match_reason text := null;
begin
  perform pg_advisory_xact_lock(hashtext('peace-street-bridge-incident-registration'));

  -- Same URL is always the same source record.
  select * into v_existing_report
  from public.bridge_reports
  where source_url = p_source_url
  limit 1;

  if found then
    return jsonb_build_object(
      'report_id', v_existing_report.id,
      'incident_id', v_existing_report.incident_id,
      'created_incident', false,
      'duplicate_source', true,
      'match_reason', 'same-source-url'
    );
  end if;

  -- Very tight window: reports within 10 minutes are treated as the same
  -- physical event even when a source omits truck details.
  select * into v_incident
  from public.bridge_incidents
  where incident_date = v_incident_date
    and abs(extract(epoch from (incident_at - p_detected_incident_at))) <= 600
  order by abs(extract(epoch from (incident_at - p_detected_incident_at)))
  limit 1;

  if found then
    v_match_reason := 'within-10-minutes';
  else
    -- 10-30 minute window: require corroborating physical-event detail.
    -- A matching truck type OR matching direction is enough; without either,
    -- preserve the report as a potentially separate strike.
    select * into v_incident
    from public.bridge_incidents
    where incident_date = v_incident_date
      and abs(extract(epoch from (incident_at - p_detected_incident_at))) <= 1800
      and (
        (
          p_truck_type is not null and truck_type is not null
          and lower(btrim(truck_type)) = lower(btrim(p_truck_type))
        )
        or
        (
          p_travel_direction is not null and travel_direction is not null
          and lower(btrim(travel_direction)) = lower(btrim(p_travel_direction))
        )
      )
    order by abs(extract(epoch from (incident_at - p_detected_incident_at)))
    limit 1;

    if found then
      v_match_reason := 'within-30-minutes-with-matching-event-detail';
    else
      -- Imprecise articles sometimes assign publication time rather than impact
      -- time. Allow a wider match only when BOTH truck type and direction agree.
      select * into v_incident
      from public.bridge_incidents
      where incident_date = v_incident_date
        and abs(extract(epoch from (incident_at - p_detected_incident_at))) <= 7200
        and p_truck_type is not null
        and truck_type is not null
        and lower(btrim(truck_type)) = lower(btrim(p_truck_type))
        and p_travel_direction is not null
        and travel_direction is not null
        and lower(btrim(travel_direction)) = lower(btrim(p_travel_direction))
      order by abs(extract(epoch from (incident_at - p_detected_incident_at)))
      limit 1;

      if found then
        v_match_reason := 'same-truck-and-direction-within-2-hours';
      end if;
    end if;
  end if;

  if not found then
    insert into public.bridge_incidents (
      incident_at, incident_date, title, confidence, location, travel_direction,
      truck_type, damage_summary, injury_summary, match_notes
    )
    values (
      p_detected_incident_at, v_incident_date, p_title, p_confidence, p_location,
      p_travel_direction, p_truck_type, p_damage_summary, p_injury_summary,
      'Created as a distinct physical event by v2.6.1 matching logic.'
    )
    returning * into v_incident;

    v_created := true;
    v_match_reason := 'new-distinct-physical-event';
  else
    update public.bridge_incidents
    set
      confidence = greatest(confidence, p_confidence),
      location = coalesce(location, p_location),
      travel_direction = coalesce(travel_direction, p_travel_direction),
      truck_type = coalesce(truck_type, p_truck_type),
      damage_summary = coalesce(damage_summary, p_damage_summary),
      injury_summary = coalesce(injury_summary, p_injury_summary),
      match_notes = concat_ws('; ', nullif(match_notes, ''), 'Matched source: ' || v_match_reason),
      updated_at = now()
    where id = v_incident.id
    returning * into v_incident;
  end if;

  insert into public.bridge_reports (
    incident_id, title, source_url, source_name, source_kind, published_at,
    incident_date, detected_incident_at, status, confidence, extraction_method,
    excerpt, location, travel_direction, truck_type, damage_summary, injury_summary,
    notes
  )
  values (
    v_incident.id, p_title, p_source_url,
    coalesce(nullif(p_source_name, ''), 'Unknown source'),
    coalesce(nullif(p_source_kind, ''), 'news'),
    p_published_at, v_incident_date, p_detected_incident_at,
    case when v_created then 'auto_confirmed' else 'duplicate' end,
    p_confidence, p_extraction_method, left(p_excerpt, 800), p_location,
    p_travel_direction, p_truck_type, p_damage_summary, p_injury_summary,
    'Event matching: ' || v_match_reason
  )
  returning * into v_report;

  return jsonb_build_object(
    'report_id', v_report.id,
    'incident_id', v_incident.id,
    'created_incident', v_created,
    'duplicate_source', false,
    'match_reason', v_match_reason
  );
end;
$$;

revoke all on function public.register_bridge_report(
  text,text,text,timestamptz,timestamptz,double precision,
  text,text,text,text,text,text,text,text
) from public;

grant execute on function public.register_bridge_report(
  text,text,text,timestamptz,timestamptz,double precision,
  text,text,text,text,text,text,text,text
) to service_role;

-- Keep RPD reconciliation consistent with the scanner: a precise RPD timestamp
-- only auto-links within 30 minutes. Wider ambiguity is preserved as a
-- separate police-backed event.
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

  if p_occurred_at is not null and p_time_precision in ('exact','approximate') then
    select * into v_incident
    from public.bridge_incidents
    where incident_date = p_incident_date
      and abs(extract(epoch from (incident_at - p_occurred_at))) <= 1800
    order by abs(extract(epoch from (incident_at - p_occurred_at)))
    limit 1;

    if found then
      v_new_incident_id := v_incident.id;
      v_match_method := 'within-30-minutes';
    end if;
  end if;

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
      incident_at, incident_date, title, confidence, location,
      truck_type, damage_summary, date_precision, evidence_level,
      historical_notes, match_notes
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
      incident_id, title, source_url, source_name, source_kind, published_at,
      incident_date, detected_incident_at, status, confidence, extraction_method,
      excerpt, location, truck_type, notes
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
    import_id, report_number, occurred_at, incident_date, time_precision,
    location, vehicle_type, narrative, contributing_circumstances,
    linked_incident_id, match_method, source_file, raw_row
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
