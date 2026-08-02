-- Peace Street Bridge Tracker v2.6.2
-- Raleigh calendar-day counter + verified incident photo backfill.
-- Safe to rerun.

alter table public.bridge_incidents
add column if not exists image_url text;

alter table public.bridge_reports
add column if not exists image_url text;

-- July 15, 2026 — WRAL
update public.bridge_reports
set image_url = 'https://images.wral.com/6169abdc-8470-4087-8cf5-04b0984a7052?f=jpg&h=675&w=1200'
where source_url like '%wral.com/news/local/truck-stuck-peace-bridge-july-2026%';

-- June 2, 2025 — WRAL
update public.bridge_reports
set image_url = 'https://images.wral.com/0fde184f-e63f-4114-9e4b-808c9b17d813?f=jpg&h=675&w=1200'
where source_url like '%wral.com/news/local/truck-stuck-peace-street-bridge-raleigh-may-2025%';

-- May 2, 2023 — WRAL
update public.bridge_reports
set image_url = 'https://images.wral.com/asset/traffic/2023/05/02/20839437/3184092-2023-05-02_11_57_19-Window-DMID1-5yrsucimq-640x360.jpg'
where source_url like '%wral.com/archive/20839435%'
   or source_url like '%wral.com/story/busch-league-beer-truck-gets-stuck-under-raleigh-s-peace-street-bridge%';

-- July 15, 2014 — ABC11
update public.bridge_reports
set image_url = 'https://cdn.abcotvs.com/dip/images/188787_071514-wtvd-truck-peace-street-1-img.jpg'
where source_url like '%abc11.com/post/photos-truck-gets-stuck-under-peace-street-bridge/188802%';

-- May 15, 2014 — ABC11
update public.bridge_reports
set image_url = 'https://cdn.abcotvs.com/dip/images/61257_051514-wtvd-truck-bridge-img.jpg'
where source_url like '%abc11.com/post/truck-gets-wedged-under-bridge/61259%';

-- December 16, 2009 — WRAL
update public.bridge_reports
set image_url = 'https://images.wral.com/asset/news/news_briefs/2009/12/16/6627967/6627967-1260974197-640x480.jpg?f=jpg&h=675&w=1200'
where source_url like '%wral.com/archive/6627962%'
   or source_url like '%wral.com/story/beer-truck-gets-stuck-under-peace-street-bridge/6627962%';

-- Promote one verified report image to each incident when the incident
-- does not already have an image.
update public.bridge_incidents i
set
  image_url = (
    select r.image_url
    from public.bridge_reports r
    where r.incident_id = i.id
      and r.image_url is not null
    order by
      case
        when lower(coalesce(r.source_kind, '')) in ('police', 'archive') then 0
        when lower(coalesce(r.source_kind, '')) = 'news' then 1
        else 2
      end,
      r.published_at asc nulls last
    limit 1
  ),
  updated_at = now()
where i.image_url is null
  and exists (
    select 1
    from public.bridge_reports r
    where r.incident_id = i.id
      and r.image_url is not null
  );

create index if not exists bridge_reports_incident_photo_idx
on public.bridge_reports(incident_id)
where image_url is not null;
