-- Peace Street Bridge Tracker v2.5
-- Lifetime-history + incident-gallery upgrade.
-- Run AFTER v2.4. Safe to rerun.

alter table public.bridge_incidents add column if not exists date_precision text not null default 'exact';
alter table public.bridge_incidents add column if not exists evidence_level text not null default 'primary';
alter table public.bridge_incidents add column if not exists historical_notes text;
alter table public.bridge_incidents add column if not exists image_url text;
alter table public.bridge_reports add column if not exists image_url text;

create table if not exists public.bridge_history_milestones (
  id uuid primary key default gen_random_uuid(),
  milestone_date date not null,
  title text not null,
  details text not null,
  source_name text,
  source_url text unique,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.bridge_history_milestones enable row level security;

insert into public.bridge_history_milestones (milestone_date,title,details,source_name,source_url)
values (
  date '1954-01-01',
  'Current Peace Street railroad bridge built',
  'WRAL reporting identifies the current Peace Street railroad bridge as a 1954 structure. The public tracker begins lifetime historical coverage at this construction year.',
  'WRAL',
  'https://www.wral.com/news/local/truck-stuck-peace-bridge-july-2026/'
) on conflict (source_url) do update set details=excluded.details, title=excluded.title;

insert into public.bridge_history_milestones (milestone_date,title,details,source_name,source_url)
values (
  date '2020-02-26',
  'ABC11 notes crashes documented back to the 1960s',
  'ABC11 reported that its earlier investigation found crashes at the Peace Street bridge going back as far as the 1960s. Individual dates for all of those older crashes are not publicly indexed, so v2.5 does not invent them.',
  'ABC11',
  'https://abc11.com/peace-street-bridge-truck-crash-hits/5968871'
) on conflict (source_url) do update set details=excluded.details, title=excluded.title;

-- Improve metadata on the previously seeded 1956 historical photo.
update public.bridge_incidents i set
  date_precision = 'day',
  evidence_level = 'community',
  historical_notes = coalesce(i.historical_notes, 'Historical image/community source. Retained as an individually documented early strike; public searchable archives are incomplete for the first decades after the bridge was built.')
where exists (
  select 1 from public.bridge_reports r
  where r.incident_id=i.id and r.source_url like '%reddit.com/r/raleigh/%'
    and i.incident_date between date '1956-01-01' and date '1956-12-31'
);

-- Helper block for adding public-source incidents that may have been missed by earlier migrations.
do $$
declare v uuid;
begin
  -- 2014-05-15: 53-foot Penske, eastbound, morning commute.
  if not exists (select 1 from public.bridge_reports where source_url='https://www.wral.com/archive/13647036/') then
    insert into public.bridge_incidents (incident_at,incident_date,title,confidence,location,travel_direction,truck_type,damage_summary,injury_summary,date_precision,evidence_level,historical_notes)
    values ('2014-05-15 08:00:00-04',date '2014-05-15','53-foot Penske tractor-trailer strikes Peace Street bridge',0.99,'Peace Street railroad bridge, Raleigh, NC','eastbound','tractor-trailer','Trailer crumpled and broke in half.','No injuries reported.','day','primary','WRAL reports the eastbound truck hit during the morning commute; exact crash minute was not specified.') returning id into v;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,travel_direction,truck_type,damage_summary,injury_summary)
    values (v,'Tractor-trailer hits Peace Street bridge in Raleigh','https://www.wral.com/archive/13647036/','WRAL','news','2014-05-15 13:51:36+00',date '2014-05-15','2014-05-15 08:00:00-04','auto_confirmed',0.99,'v25-historical-audit','53-foot Penske rental truck struck during the morning commute.','Peace Street railroad bridge, Raleigh, NC','eastbound','tractor-trailer','Trailer crumpled and broke in half.','No injuries reported.');
  end if;

  -- 2014-07-15 afternoon event.
  if not exists (select 1 from public.bridge_reports where source_url='https://www.wral.com/story/truck-gets-stuck-under-peace-street-bridge-in-raleigh/13813145/') then
    insert into public.bridge_incidents (incident_at,incident_date,title,confidence,location,truck_type,damage_summary,date_precision,evidence_level,historical_notes)
    values ('2014-07-15 14:00:00-04',date '2014-07-15','Tractor-trailer jams beneath Peace Street railroad bridge',0.99,'Peace Street railroad bridge, Raleigh, NC','tractor-trailer','Trailer became jammed beneath the bridge.','day','primary','WRAL describes a Tuesday afternoon strike; exact time unavailable.') returning id into v;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,truck_type,damage_summary)
    values (v,'Truck gets stuck under Peace Street bridge in Raleigh','https://www.wral.com/story/truck-gets-stuck-under-peace-street-bridge-in-raleigh/13813145/','WRAL','news','2014-07-15 17:53:44-04',date '2014-07-15','2014-07-15 14:00:00-04','auto_confirmed',0.99,'v25-historical-audit','WRAL reports a tractor-trailer jammed beneath the bridge Tuesday afternoon.','Peace Street railroad bridge, Raleigh, NC','tractor-trailer','Trailer became jammed beneath the bridge.');
  end if;

  -- 2017-02-02 afternoon.
  if not exists (select 1 from public.bridge_reports where source_url='https://www.wral.com/archive/16496006/') then
    insert into public.bridge_incidents (incident_at,incident_date,title,confidence,location,truck_type,damage_summary,date_precision,evidence_level,historical_notes)
    values ('2017-02-02 15:00:00-05',date '2017-02-02','Tractor-trailer fails to clear Peace Street bridge',0.99,'Peace Street railroad bridge, Raleigh, NC','tractor-trailer','Trailer sustained significant damage.','day','primary','WRAL reports the strike occurred Thursday afternoon; exact time unavailable.') returning id into v;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,truck_type,damage_summary)
    values (v,'Tractor trailer fails to clear Peace Street bridge in Raleigh','https://www.wral.com/archive/16496006/','WRAL','news','2017-02-02 19:49:19+00',date '2017-02-02','2017-02-02 15:00:00-05','auto_confirmed',0.99,'v25-historical-audit','WRAL reports an 18-wheeler became stuck Thursday afternoon.','Peace Street railroad bridge, Raleigh, NC','tractor-trailer','Trailer sustained significant damage.');
  end if;

  -- November 2017 is independently referenced by WRAL's 2018 retrospective, but the exact day is not in the indexed article.
  if not exists (select 1 from public.bridge_reports where source_url='https://www.wral.com/archive/18061652/#november-2017') then
    insert into public.bridge_incidents (incident_at,incident_date,title,confidence,location,truck_type,damage_summary,date_precision,evidence_level,historical_notes)
    values ('2017-11-15 12:00:00-05',date '2017-11-15','Truck clips Peace Street bridge in November 2017',0.90,'Peace Street railroad bridge, Raleigh, NC','truck','Trailer roof peeled back during impact.','month','secondary','WRAL retrospective confirms a November 2017 strike but does not provide the exact day in the indexed text. The stored mid-month timestamp is only a sorting placeholder.') returning id into v;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,truck_type,damage_summary,notes)
    values (v,'November 2017 Peace Street bridge strike','https://www.wral.com/archive/18061652/#november-2017','WRAL retrospective','news','2018-12-13 12:43:24+00',date '2017-11-15','2017-11-15 12:00:00-05','auto_confirmed',0.90,'v25-retrospective-month-only','WRAL says a truck clipped the bridge in November 2017 and the trailer roof peeled back.','Peace Street railroad bridge, Raleigh, NC','truck','Trailer roof peeled back during impact.','Exact November date unavailable in searchable article; midpoint used only for sorting.');
  end if;

  -- 2020-02-26 around 8 a.m. (ensure canonical ABC11 source exists).
  if not exists (select 1 from public.bridge_reports where source_url='https://abc11.com/peace-street-bridge-truck-crash-hits/5968871') then
    select id into v from public.bridge_incidents where incident_date=date '2020-02-26' order by incident_at limit 1;
    if v is null then
      insert into public.bridge_incidents (incident_at,incident_date,title,confidence,location,truck_type,damage_summary,date_precision,evidence_level)
      values ('2020-02-26 08:00:00-05',date '2020-02-26','Tractor-trailer crashes into Peace Street bridge',0.99,'Peace Street railroad bridge, Raleigh, NC','tractor-trailer','Truck crashed and became stuck beneath bridge.','exact','primary') returning id into v;
    end if;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,truck_type,damage_summary)
    values (v,'Tractor-trailer crashes into Peace Street bridge in Raleigh','https://abc11.com/peace-street-bridge-truck-crash-hits/5968871','ABC11','news','2020-02-26 12:00:00+00',date '2020-02-26','2020-02-26 08:00:00-05','duplicate',0.99,'v25-historical-audit','ABC11 reports the crash happened around 8 a.m.','Peace Street railroad bridge, Raleigh, NC','tractor-trailer','Truck crashed and became stuck beneath bridge.');
  end if;

  -- 2020-10-09 around 5 p.m., community-photo report.
  if not exists (select 1 from public.bridge_reports where source_url='https://www.reddit.com/r/raleigh/comments/j87fuk') then
    insert into public.bridge_incidents (incident_at,incident_date,title,confidence,location,truck_type,damage_summary,date_precision,evidence_level,historical_notes)
    values ('2020-10-09 17:00:00-04',date '2020-10-09','Moving truck strike documented at Peace Street bridge',0.91,'Peace Street railroad bridge, Raleigh, NC','moving truck','Vehicle roof/cargo box damaged.','exact','community','Contemporaneous r/raleigh photo thread; comments confirm it happened that day around 5 p.m.') returning id into v;
    insert into public.bridge_reports (incident_id,title,source_url,source_name,source_kind,published_at,incident_date,detected_incident_at,status,confidence,extraction_method,excerpt,location,truck_type,damage_summary)
    values (v,'Ye Olde 12''4" Peace Street Bridge is alive and well','https://www.reddit.com/r/raleigh/comments/j87fuk','r/raleigh','reddit','2020-10-09 17:00:00-04',date '2020-10-09','2020-10-09 17:00:00-04','auto_confirmed',0.91,'v25-community-explicit-time','Contemporaneous commenters identify the incident as happening that day around 5 p.m.','Peace Street railroad bridge, Raleigh, NC','moving truck','Vehicle roof/cargo box damaged.');
  end if;
end $$;

-- Mark old imported sources with sensible evidence/date precision defaults.
update public.bridge_incidents set evidence_level='primary'
where evidence_level='primary' and confidence >= 0.97;

-- Indexes for lifetime archive queries.
create index if not exists bridge_incidents_historical_date_idx on public.bridge_incidents(incident_at asc);
create index if not exists bridge_reports_incident_image_idx on public.bridge_reports(incident_id) where image_url is not null;
