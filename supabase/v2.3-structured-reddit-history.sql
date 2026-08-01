-- Version 2.3: structured incident fields, Reddit source tracking, and a
-- best-effort historical backfill of incident dates verified in public sources.

alter table public.bridge_incidents add column if not exists location text;
alter table public.bridge_incidents add column if not exists travel_direction text;
alter table public.bridge_incidents add column if not exists truck_type text;
alter table public.bridge_incidents add column if not exists damage_summary text;
alter table public.bridge_incidents add column if not exists injury_summary text;

alter table public.bridge_reports add column if not exists source_kind text not null default 'news';
alter table public.bridge_reports add column if not exists location text;
alter table public.bridge_reports add column if not exists travel_direction text;
alter table public.bridge_reports add column if not exists truck_type text;
alter table public.bridge_reports add column if not exists damage_summary text;
alter table public.bridge_reports add column if not exists injury_summary text;

-- Remove every older overload before installing the expanded RPC.
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
begin
  perform pg_advisory_xact_lock(hashtext('peace-street-bridge-incident-registration'));

  select * into v_existing_report from public.bridge_reports where source_url = p_source_url limit 1;
  if found then
    return jsonb_build_object('report_id', v_existing_report.id, 'incident_id', v_existing_report.incident_id,
      'created_incident', false, 'duplicate_source', true);
  end if;

  select * into v_incident from public.bridge_incidents where incident_date = v_incident_date limit 1;

  if not found then
    insert into public.bridge_incidents (
      incident_at, incident_date, title, confidence, location, travel_direction,
      truck_type, damage_summary, injury_summary
    ) values (
      p_detected_incident_at, v_incident_date, p_title, p_confidence, p_location,
      p_travel_direction, p_truck_type, p_damage_summary, p_injury_summary
    ) returning * into v_incident;
    v_created := true;
  else
    update public.bridge_incidents set
      incident_at = least(incident_at, p_detected_incident_at),
      confidence = greatest(confidence, p_confidence),
      location = coalesce(location, p_location),
      travel_direction = coalesce(travel_direction, p_travel_direction),
      truck_type = coalesce(truck_type, p_truck_type),
      damage_summary = coalesce(damage_summary, p_damage_summary),
      injury_summary = coalesce(injury_summary, p_injury_summary),
      updated_at = now()
    where id = v_incident.id returning * into v_incident;
  end if;

  insert into public.bridge_reports (
    incident_id, title, source_url, source_name, source_kind, published_at,
    incident_date, detected_incident_at, status, confidence, extraction_method,
    excerpt, location, travel_direction, truck_type, damage_summary, injury_summary
  ) values (
    v_incident.id, p_title, p_source_url, coalesce(nullif(p_source_name, ''), 'Unknown source'),
    coalesce(nullif(p_source_kind, ''), 'news'), p_published_at, v_incident_date,
    p_detected_incident_at, case when v_created then 'auto_confirmed' else 'duplicate' end,
    p_confidence, p_extraction_method, left(p_excerpt, 800), p_location,
    p_travel_direction, p_truck_type, p_damage_summary, p_injury_summary
  ) returning * into v_report;

  return jsonb_build_object('report_id', v_report.id, 'incident_id', v_incident.id,
    'created_incident', v_created, 'duplicate_source', false);
end;
$$;

revoke all on function public.register_bridge_report(text,text,text,timestamptz,timestamptz,double precision,text,text,text,text,text,text,text,text) from public;
grant execute on function public.register_bridge_report(text,text,text,timestamptz,timestamptz,double precision,text,text,text,text,text,text,text,text) to service_role;

-- Historical backfill. These are incident-days for which a dated public source
-- was located. Unknown times are represented at noon Eastern and clearly marked.
create temporary table historical_bridge_sources (
  incident_at timestamptz, title text, source_url text, source_name text,
  source_kind text, truck_type text, damage_summary text, injury_summary text
) on commit drop;

insert into historical_bridge_sources values
('1956-10-01 12:00:00-04','Truck strikes the Peace Street Bridge in Raleigh on October 1, 1956','https://www.reddit.com/r/raleigh/comments/jdyaqm/truck_strikes_the_peace_street_bridge_in_raleigh/','r/raleigh','reddit','truck','Historical photograph documents a bridge strike.','Unknown'),
('2014-05-15 08:00:00-04','Truck gets wedged under Raleigh bridge','https://abc11.com/post/truck-gets-wedged-under-bridge/61259/','ABC11','news','tractor-trailer','Roof of the 18-wheeler was peeled back.','No injuries reported in source summary.'),
('2014-07-15 12:00:00-04','Photos: Truck gets stuck under Peace Street bridge','https://abc11.com/post/photos-truck-gets-stuck-under-peace-street-bridge/188802/','ABC11','news','truck','Vehicle became wedged beneath the bridge.','Unknown'),
('2018-12-13 08:00:00-05','Another truck stuck under Raleigh bridge','https://www.wral.com/archive/18061999/','WRAL','news','tractor-trailer','Vehicle became lodged beneath the bridge.','No injuries reported.'),
('2020-02-26 08:00:00-05','Tractor-trailer crashes into Peace Street bridge in Raleigh','https://abc11.com/post/tractor-trailer-crashes-into-peace-street-bridge/5968871/','ABC11','news','tractor-trailer','Vehicle crashed and became stuck beneath the bridge.','Unknown'),
('2020-04-15 08:05:00-04','Tractor-trailer hauling sugar gets stuck under Peace Street Bridge','https://abc11.com/post/truck-gets-stuck-under-raleighs-peace-street-bridge/6105170/','ABC11','news','tractor-trailer','Vehicle became trapped beneath the bridge.','No injuries reported.'),
('2021-09-27 18:00:00-04','Peace Street Bridge claims another truck','https://www.instagram.com/p/CUWOrEULbBu/','Instagram / ITB Insider','social','truck','Social post documents another bridge strike.','Unknown'),
('2022-06-14 08:00:00-04','Peace St Bridge Strikes Again','https://www.reddit.com/r/raleigh/comments/vc2ots/peace_st_bridge_strikes_again/','r/raleigh','reddit','truck','Truck roof/cargo area was damaged.','Unknown'),
('2023-05-02 08:00:00-04','Busch League: Beer truck gets stuck under Peace Street bridge','https://www.wral.com/archive/20839435/','WRAL','news','beer truck','Vehicle became stuck beneath the bridge.','No injuries reported.'),
('2024-11-08 12:00:00-05','Truck destroyed after driver crashes into Peace Street Bridge','https://www.youtube.com/shorts/EFmJEmwqfU4','ABC11 / YouTube','video','truck','Truck was heavily damaged.','No injuries reported.'),
('2025-06-02 09:00:00-04','Truck becomes stuck under Peace Street bridge in Raleigh','https://www.wral.com/news/local/truck-stuck-peace-street-bridge-raleigh-may-2025/','WRAL','news','truck','Minor roof damage reported.','No injuries reported.'),
('2025-11-02 19:00:00-05','Peace Street reopens after truck collision with bridge','https://www.wral.com/news/local/peace-street-bridge-truck-hit-raleigh-nov-2025/','WRAL','news','box truck','Part of the truck roof was removed; no visible bridge damage.','Unknown'),
('2026-07-15 08:45:00-04','Truck removed after getting wedged under Peace Street bridge','https://www.wral.com/news/local/truck-stuck-peace-bridge-july-2026/','WRAL','news','large truck','Vehicle became wedged beneath the bridge.','Unknown'),
('2026-07-21 09:00:00-04','Hat trick: Another Peace Street Bridge truck collision','https://www.wral.com/news/local/peace-street-bridge-crash-truck-july-2026/','WRAL','news','truck','Large section of the trailer roof was ripped off.','Unknown'),
('2026-07-30 11:00:00-04','Two trucks strike Raleigh’s Peace Street Bridge','https://www.wral.com/news/local/two-more-trucks-peace-street-peeler-july-2026/','WRAL','news','box truck and tractor-trailer','Two truck roofs were torn open in separate same-day strikes.','Unknown'),
('2026-07-30 11:00:00-04','Two trucks strike Raleigh’s notorious Peace Street Bridge','https://abc11.com/post/trucks-strike-raleighs-notorious-peace-street-bridge/19604430/','ABC11','news','box truck and tractor-trailer','Two truck roofs were torn open in separate same-day strikes.','Unknown');

do $$
declare h record; v_date date; v_incident_id uuid;
begin
  for h in select * from historical_bridge_sources order by incident_at loop
    v_date := (h.incident_at at time zone 'America/New_York')::date;
    insert into public.bridge_incidents (
      incident_at, incident_date, title, confidence, location, truck_type,
      damage_summary, injury_summary
    ) values (
      h.incident_at, v_date, h.title, 0.98, 'Peace Street railroad bridge, Raleigh, NC',
      h.truck_type, h.damage_summary, h.injury_summary
    ) on conflict (incident_date) do update set
      confidence = greatest(public.bridge_incidents.confidence, excluded.confidence),
      location = coalesce(public.bridge_incidents.location, excluded.location),
      truck_type = coalesce(public.bridge_incidents.truck_type, excluded.truck_type),
      damage_summary = coalesce(public.bridge_incidents.damage_summary, excluded.damage_summary),
      injury_summary = coalesce(public.bridge_incidents.injury_summary, excluded.injury_summary),
      updated_at = now()
    returning id into v_incident_id;

    insert into public.bridge_reports (
      incident_id, title, source_url, source_name, source_kind, published_at,
      incident_date, detected_incident_at, status, confidence, extraction_method,
      excerpt, location, truck_type, damage_summary, injury_summary
    ) values (
      v_incident_id, h.title, h.source_url, h.source_name, h.source_kind, h.incident_at,
      v_date, h.incident_at, 'auto_confirmed', 0.98, 'historical-source-backfill',
      'Historical incident imported from a dated public source.',
      'Peace Street railroad bridge, Raleigh, NC', h.truck_type, h.damage_summary, h.injury_summary
    ) on conflict (source_url) do nothing;
  end loop;
end $$;
