-- Peace Street Bridge Tracker v2.6
-- Archival-history backfill focused on pre-2014 incidents.
-- Safe to rerun after v2.5.x.

create extension if not exists pgcrypto;

-- Preserve archival leads that are real evidence of older strikes but do not
-- provide enough date precision to count as a unique documented incident.
create table if not exists public.bridge_archive_leads (
  id uuid primary key default gen_random_uuid(),
  period_label text not null,
  details text not null,
  source_name text not null,
  source_url text not null unique,
  evidence_level text not null default 'secondary',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.bridge_archive_leads enable row level security;

insert into public.bridge_archive_leads
  (period_label, details, source_name, source_url, evidence_level, notes)
values
  (
    '1960s',
    'ABC11 reports that its 2014 I-Team investigation found Peace Street bridge crashes going back as far as the 1960s.',
    'ABC11',
    'https://abc11.com/peace-street-bridge-truck-crash-hits/5968871',
    'secondary',
    'This proves pre-1970 crash history, but the indexed article does not expose individual dates, so these events are not counted separately.'
  ),
  (
    '1960s onward',
    'A long-time nearby business owner quoted in an engineering case study said he had witnessed numerous truck crashes since beginning work in the area in the 1960s.',
    'Engineering case study quoting ABC11 reporting',
    'https://anyflip.com/wkcna/ipjn/basic/',
    'secondary',
    'Useful corroboration of repeated historic strikes; not used to invent individual incident dates.'
  )
on conflict (source_url) do update
set details=excluded.details, period_label=excluded.period_label, notes=excluded.notes;

-- Add the exact 1976 archival-photo incident.
do $$
declare v uuid;
begin
  if not exists (
    select 1 from public.bridge_reports
    where source_url='https://www.reddit.com/r/raleigh/comments/z7zu9f'
  ) then
    insert into public.bridge_incidents (
      incident_at, incident_date, title, confidence, location,
      truck_type, damage_summary, date_precision, evidence_level, historical_notes
    )
    values (
      '1976-11-19 12:00:00-05',
      date '1976-11-19',
      'Tractor-trailer wedged beneath Peace Street railroad overpass',
      0.98,
      'Peace Street railroad bridge, Raleigh, NC',
      'tractor-trailer',
      'Truck became lodged beneath the railroad overpass and required a wrecker.',
      'day',
      'archive',
      'A State Archives/N&O Negative Collection image identifies the incident as November 19, 1976. Driver Colby Maddox of Macon, Georgia, was cited for failure to follow a truck route. Noon is used only as a sorting placeholder because the exact time is not available.'
    )
    returning id into v;

    insert into public.bridge_reports (
      incident_id, title, source_url, source_name, source_kind,
      published_at, incident_date, detected_incident_at, status,
      confidence, extraction_method, excerpt, location, truck_type,
      damage_summary, notes
    )
    values (
      v,
      'Wrecker extracts tractor-trailer from Peace Street bridge, November 19, 1976',
      'https://www.reddit.com/r/raleigh/comments/z7zu9f',
      'N&O Negative Collection / State Archives of North Carolina (reposted on r/raleigh)',
      'archive',
      '2022-11-29 12:00:00-05',
      date '1976-11-19',
      '1976-11-19 12:00:00-05',
      'auto_confirmed',
      0.98,
      'archival-photo-caption',
      'Archival caption identifies a tractor-trailer being extracted from beneath the Southern Railroad overpass on Peace Street on November 19, 1976.',
      'Peace Street railroad bridge, Raleigh, NC',
      'tractor-trailer',
      'Truck became lodged beneath the railroad overpass and required a wrecker.',
      'Original image is in the News & Observer Negative Collection at the State Archives of North Carolina; copyright remains with the News & Observer.'
    );
  end if;
end $$;

-- Add the 1988 strike as a year-precision incident. WRAL specifically cites a
-- 1988 news story showing a tractor-trailer with its top sheared off.
do $$
declare v uuid;
begin
  if not exists (
    select 1 from public.bridge_reports
    where source_url='https://www.wral.com/archive/20978269/#peace-street-1988'
  ) then
    insert into public.bridge_incidents (
      incident_at, incident_date, title, confidence, location,
      truck_type, damage_summary, date_precision, evidence_level, historical_notes
    )
    values (
      '1988-07-01 12:00:00-04',
      date '1988-07-01',
      '1988 tractor-trailer roof sheared off at Peace Street bridge',
      0.93,
      'Peace Street railroad bridge, Raleigh, NC',
      'tractor-trailer',
      'Top of tractor-trailer was sheared off after failing to clear the bridge.',
      'year',
      'secondary',
      'WRAL Hidden History identifies a 1988 news story showing this strike. July 1 is only a midpoint sorting placeholder because the exact 1988 date is not given in the indexed retrospective.'
    )
    returning id into v;

    insert into public.bridge_reports (
      incident_id, title, source_url, source_name, source_kind,
      published_at, incident_date, detected_incident_at, status,
      confidence, extraction_method, excerpt, location, truck_type,
      damage_summary, notes
    )
    values (
      v,
      '1988 news story documents tractor-trailer strike at Peace Street bridge',
      'https://www.wral.com/archive/20978269/#peace-street-1988',
      'WRAL Hidden History',
      'news',
      '2023-08-01 12:57:23-04',
      date '1988-07-01',
      '1988-07-01 12:00:00-04',
      'auto_confirmed',
      0.93,
      'retrospective-year-only',
      'WRAL reports that a 1988 news story shows a tractor-trailer with a sheared-off top that was too tall to pass beneath the Peace Street bridge.',
      'Peace Street railroad bridge, Raleigh, NC',
      'tractor-trailer',
      'Top of tractor-trailer was sheared off.',
      'Exact day/month remains unresolved; the stored date is a sorting placeholder and date_precision is year.'
    );
  end if;
end $$;

-- Add a milestone explaining why older individual records remain incomplete.
insert into public.bridge_history_milestones
  (milestone_date, title, details, source_name, source_url)
values
  (
    date '1960-01-01',
    'Documented crash history reaches the 1960s',
    'ABC11 says its I-Team investigation found crashes at the Peace Street bridge going back as far as the 1960s. Searchable public sources still do not expose a complete date-by-date list for that decade.',
    'ABC11',
    'https://abc11.com/peace-street-bridge-truck-crash-hits/5968871#1960s-history'
  )
on conflict (source_url) do update
set details=excluded.details, title=excluded.title;

create index if not exists bridge_archive_leads_period_idx
on public.bridge_archive_leads(period_label);
