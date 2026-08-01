-- Version 2.4
-- 1) allows multiple genuine strikes on the same Raleigh calendar day
-- 2) deduplicates likely reports of the same event using a 60-minute window + structured fields
-- 3) stores browser push subscriptions
-- 4) records an RPD official-count lower bound without inventing unknown incident dates

-- The v2.2 migration created a one-row-per-day unique index. Remove it.
drop index if exists public.bridge_incidents_incident_date_uidx;

-- Some early schemas may have created a UNIQUE table constraint instead of only the index.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.bridge_incidents'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%incident_date%'
  loop
    execute format('alter table public.bridge_incidents drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.bridge_incidents add column if not exists notification_sent_at timestamptz;
alter table public.bridge_incidents add column if not exists match_notes text;
create index if not exists bridge_incidents_date_idx on public.bridge_incidents(incident_date);
create index if not exists bridge_incidents_time_idx on public.bridge_incidents(incident_at);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bridge_official_stats (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text not null unique,
  window_start date not null,
  window_end date not null,
  crash_count integer not null check (crash_count >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- WRAL reported on July 24, 2026 that Raleigh Police Department said there
-- were 13 crashes with the Peace Street railroad bridge within the prior five years.
-- This is stored as an official lower bound; we do NOT fabricate dates for crashes
-- whose individual records are not publicly identified.
insert into public.bridge_official_stats (
  source_name, source_url, window_start, window_end, crash_count, notes
) values (
  'Raleigh Police Department via WRAL',
  'https://www.wral.com/news/local/peace-street-peeler-what-will-it-take-to-make-a-raleigh-bridge-safer-july-24-2026/',
  date '2021-07-24', date '2026-07-24', 13,
  'RPD told WRAL there were 13 crashes with the bridge within the past five years. Use as a lower bound when individual dates are unavailable.'
) on conflict (source_url) do update set
  window_start = excluded.window_start,
  window_end = excluded.window_end,
  crash_count = excluded.crash_count,
  notes = excluded.notes,
  updated_at = now();

-- Replace the registration RPC with multi-strike-per-day matching.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'register_bridge_report'
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
language plpgsql security definer set search_path = public
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

  -- Primary rule: reports within 60 minutes are almost certainly the same strike.
  select * into v_incident
  from public.bridge_incidents
  where incident_date = v_incident_date
    and abs(extract(epoch from (incident_at - p_detected_incident_at))) <= 3600
  order by abs(extract(epoch from (incident_at - p_detected_incident_at))) asc
  limit 1;

  if found then
    v_match_reason := 'within-60-minutes';
  else
    -- Secondary rule for imprecise timestamps: same day + same specific truck type
    -- + same travel direction, provided reports are within four hours. This is
    -- intentionally conservative so a second genuine same-day strike can survive.
    select * into v_incident
    from public.bridge_incidents
    where incident_date = v_incident_date
      and p_truck_type is not null
      and truck_type is not null
      and lower(truck_type) = lower(p_truck_type)
      and p_travel_direction is not null
      and travel_direction is not null
      and lower(travel_direction) = lower(p_travel_direction)
      and abs(extract(epoch from (incident_at - p_detected_incident_at))) <= 14400
    order by abs(extract(epoch from (incident_at - p_detected_incident_at))) asc
    limit 1;
    if found then v_match_reason := 'same-truck-direction-within-4-hours'; end if;
  end if;

  if not found then
    insert into public.bridge_incidents (
      incident_at, incident_date, title, confidence, location, travel_direction,
      truck_type, damage_summary, injury_summary, match_notes
    ) values (
      p_detected_incident_at, v_incident_date, p_title, p_confidence, p_location,
      p_travel_direction, p_truck_type, p_damage_summary, p_injury_summary,
      'Created as distinct event; no sufficiently similar same-day incident found.'
    ) returning * into v_incident;
    v_created := true;
    v_match_reason := 'new-distinct-event';
  else
    update public.bridge_incidents set
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
  ) values (
    v_incident.id, p_title, p_source_url, coalesce(nullif(p_source_name, ''), 'Unknown source'),
    coalesce(nullif(p_source_kind, ''), 'news'), p_published_at, v_incident_date,
    p_detected_incident_at, case when v_created then 'auto_confirmed' else 'duplicate' end,
    p_confidence, p_extraction_method, left(p_excerpt, 800), p_location,
    p_travel_direction, p_truck_type, p_damage_summary, p_injury_summary,
    'Event matching: ' || v_match_reason
  ) returning * into v_report;

  return jsonb_build_object(
    'report_id', v_report.id,
    'incident_id', v_incident.id,
    'created_incident', v_created,
    'duplicate_source', false,
    'match_reason', v_match_reason
  );
end;
$$;

revoke all on function public.register_bridge_report(text,text,text,timestamptz,timestamptz,double precision,text,text,text,text,text,text,text,text) from public;
grant execute on function public.register_bridge_report(text,text,text,timestamptz,timestamptz,double precision,text,text,text,text,text,text,text,text) to service_role;

-- Additional exact-date historical incidents found in WRAL's archive during the v2.4 audit.
-- These add documented events without inventing unknown dates.
do $$
declare v_incident_id uuid;
begin
  -- April 12, 2013, shortly before 10 a.m.; westbound truck, no injuries.
  if not exists (select 1 from public.bridge_reports where source_url = 'https://www.wral.com/story/truck-hits-peace-street-bridge-in-raleigh/12334541/') then
    insert into public.bridge_incidents (incident_at, incident_date, title, confidence, location, travel_direction, truck_type, damage_summary, injury_summary, match_notes)
    values ('2013-04-12 09:55:00-04', date '2013-04-12', 'Truck hits Peace Street bridge in Raleigh', 0.99,
      'Peace Street railroad bridge, Raleigh, NC', 'westbound', 'truck', 'Trailer crumpled, broke in half, and became lodged beneath the bridge.', 'No injuries reported.', 'Historical source: WRAL; crash occurred shortly before 10 a.m.')
    returning id into v_incident_id;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,travel_direction,truck_type,damage_summary,injury_summary)
    values (v_incident_id,'Truck hits Peace Street bridge in Raleigh','https://www.wral.com/story/truck-hits-peace-street-bridge-in-raleigh/12334541/','WRAL','news','2013-04-12 11:07:00-04',date '2013-04-12','2013-04-12 09:55:00-04','auto_confirmed',0.99,'historical-source-backfill-v24','WRAL reports the crash happened shortly before 10 a.m.','Peace Street railroad bridge, Raleigh, NC','westbound','truck','Trailer crumpled, broke in half, and became lodged beneath the bridge.','No injuries reported.');
  end if;

  -- July 25, 2018 morning tractor-trailer strike.
  if not exists (select 1 from public.bridge_reports where source_url = 'https://www.wral.com/story/tractor-trailer-gets-stuck-under-peace-street-bridge-in-raleigh/17116190/') then
    insert into public.bridge_incidents (incident_at, incident_date, title, confidence, location, truck_type, damage_summary, match_notes)
    values ('2018-07-25 08:00:00-04', date '2018-07-25', 'Tractor-trailer gets stuck under Peace Street bridge in Raleigh', 0.96,
      'Peace Street railroad bridge, Raleigh, NC', 'tractor-trailer', 'Trailer roof peeled back during impact.', 'Historical source: WRAL; source says Wednesday morning, exact time unavailable.')
    returning id into v_incident_id;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,truck_type,damage_summary)
    values (v_incident_id,'Tractor-trailer gets stuck under Peace Street bridge in Raleigh','https://www.wral.com/story/tractor-trailer-gets-stuck-under-peace-street-bridge-in-raleigh/17116190/','WRAL','news','2018-07-25 08:00:00-04',date '2018-07-25','2018-07-25 08:00:00-04','auto_confirmed',0.96,'historical-source-backfill-v24','WRAL reports a Wednesday morning strike; exact time unavailable.','Peace Street railroad bridge, Raleigh, NC','tractor-trailer','Trailer roof peeled back during impact.');
  end if;

  -- June 7, 2019 around 2:30 a.m. hit-and-run box-truck strike.
  if not exists (select 1 from public.bridge_reports where source_url = 'https://www.wral.com/story/driver-sought-after-box-truck-crashes-into-raleigh-s-peace-street-bridge/18437351/') then
    insert into public.bridge_incidents (incident_at, incident_date, title, confidence, location, truck_type, damage_summary, match_notes)
    values ('2019-06-07 02:30:00-04', date '2019-06-07', 'Box truck crashes into Raleigh Peace Street Bridge', 0.99,
      'Peace Street railroad bridge, Raleigh, NC', 'box truck', 'Vehicle sustained sizable damage and was later abandoned.', 'Historical source: WRAL; incident occurred around 2:30 a.m.')
    returning id into v_incident_id;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,truck_type,damage_summary)
    values (v_incident_id,'Driver sought after box truck crashes into Raleigh''s Peace Street Bridge','https://www.wral.com/story/driver-sought-after-box-truck-crashes-into-raleigh-s-peace-street-bridge/18437351/','WRAL','news','2019-06-07 07:42:00-04',date '2019-06-07','2019-06-07 02:30:00-04','auto_confirmed',0.99,'historical-source-backfill-v24','WRAL reports the incident occurred around 2:30 a.m.','Peace Street railroad bridge, Raleigh, NC','box truck','Vehicle sustained sizable damage and was later abandoned.');
  end if;
end $$;

-- July 30, 2026 had at least two distinct strikes. The prior v2.3 seed represented
-- the day as one combined row because same-day deduplication was then intentional.
-- Add the second documented event using the contemporaneous r/raleigh thread,
-- whose comments explicitly report another strike at about 1 p.m.
do $$
declare v_incident_id uuid;
begin
  if not exists (select 1 from public.bridge_reports where source_url = 'https://www.reddit.com/r/raleigh/comments/1vawe5j/can_opener_of_raleigh_strike_again/#second-strike-1pm') then
    insert into public.bridge_incidents (incident_at, incident_date, title, confidence, location, truck_type, match_notes)
    values ('2026-07-30 13:00:00-04', date '2026-07-30', 'Second Peace Street bridge strike of July 30, 2026', 0.93,
      'Peace Street railroad bridge, Raleigh, NC', 'truck', 'Contemporaneous r/raleigh thread states another strike happened at about 1 p.m., the second of the day.')
    returning id into v_incident_id;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,truck_type)
    values (v_incident_id,'Second Peace Street bridge strike of July 30, 2026','https://www.reddit.com/r/raleigh/comments/1vawe5j/can_opener_of_raleigh_strike_again/#second-strike-1pm','r/raleigh','reddit','2026-07-30 13:00:00-04',date '2026-07-30','2026-07-30 13:00:00-04','auto_confirmed',0.93,'historical-reddit-explicit-time','Contemporaneous comments report another strike at about 1 p.m., explicitly described as the second strike of the day.','Peace Street railroad bridge, Raleigh, NC','truck');
  end if;
end $$;
