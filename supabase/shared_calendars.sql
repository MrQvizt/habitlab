-- Applied to the Supabase project "habitlab" (ref jwjabhcebwnzhfphsuwg, eu-north-1) as migration
-- "shared_calendars". Kept here so the backend is reviewable and reproducible.
-- Data lives in a private schema (not exposed by the API); RLS is on with no policies, so tables
-- can't be read or written directly. The app can only call the five functions below.
create schema if not exists hl;
revoke all on schema hl from public, anon, authenticated;

create table hl.calendars (
  id uuid primary key,
  key_hash text not null,
  name text not null default '' check (char_length(name) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table hl.events (
  calendar_id uuid not null references hl.calendars(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  title text not null check (char_length(title) between 1 and 60),
  date date not null,
  time text not null default '' check (time = '' or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  place text not null default '' check (char_length(place) <= 80),
  kind text not null default 'other' check (kind ~ '^[a-z]{1,12}$'),
  notes text not null default '' check (char_length(notes) <= 140),
  primary key (calendar_id, id)
);
create table hl.signups (
  id bigint generated always as identity primary key,
  calendar_id uuid not null,
  event_id text not null,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  foreign key (calendar_id, event_id) references hl.events(calendar_id, id) on delete cascade
);
create index on hl.signups (calendar_id, event_id);
alter table hl.calendars enable row level security;
alter table hl.events enable row level security;
alter table hl.signups enable row level security;

-- Owner publishes the activities they marked "open to friends" (replaces the previous list).
create or replace function public.hl_publish(p_id uuid, p_key text, p_name text, p_events jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  h text := encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  cur text;
begin
  if p_key is null or char_length(p_key) < 32 then raise exception 'bad key'; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 200 then raise exception 'bad events'; end if;
  select key_hash into cur from hl.calendars where id = p_id;
  if cur is null then
    insert into hl.calendars (id, key_hash, name) values (p_id, h, left(coalesce(p_name, ''), 40));
  elsif cur <> h then
    raise exception 'not allowed';
  else
    update hl.calendars set name = left(coalesce(p_name, ''), 40), updated_at = now() where id = p_id;
  end if;
  delete from hl.events e where e.calendar_id = p_id
    and not exists (select 1 from jsonb_array_elements(p_events) x where x->>'id' = e.id);
  insert into hl.events (calendar_id, id, title, date, time, place, kind, notes)
  select p_id, x->>'id', left(x->>'title', 60), (x->>'date')::date, coalesce(x->>'time', ''), left(coalesce(x->>'place', ''), 80), coalesce(x->>'kind', 'other'), left(coalesce(x->>'notes', ''), 140)
  from jsonb_array_elements(p_events) x
  on conflict (calendar_id, id) do update set title = excluded.title, date = excluded.date, time = excluded.time, place = excluded.place, kind = excluded.kind, notes = excluded.notes;
end $$;

-- Anyone with the link: the upcoming public activities and how many are joining (not who).
create or replace function public.hl_calendar(p_id uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select case when c.id is null then null else jsonb_build_object(
    'name', c.name,
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'date', e.date, 'time', e.time, 'place', e.place, 'kind', e.kind, 'notes', e.notes,
        'going', (select count(*) from hl.signups s where s.calendar_id = e.calendar_id and s.event_id = e.id)) order by e.date, e.time)
      from hl.events e where e.calendar_id = c.id and e.date >= current_date - 1), '[]'::jsonb)) end
  from (select 1) one left join hl.calendars c on c.id = p_id;
$$;

-- A friend says "I'll join".
create or replace function public.hl_join(p_id uuid, p_event text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  going int;
begin
  if char_length(n) < 1 or char_length(n) > 40 then raise exception 'Please enter your name'; end if;
  if not exists (select 1 from hl.events where calendar_id = p_id and id = p_event and date >= current_date - 1) then raise exception 'This activity is no longer on the calendar'; end if;
  select count(*) into going from hl.signups where calendar_id = p_id and event_id = p_event;
  if going >= 100 then raise exception 'This activity is full'; end if;
  if not exists (select 1 from hl.signups where calendar_id = p_id and event_id = p_event and lower(name) = lower(n)) then
    insert into hl.signups (calendar_id, event_id, name) values (p_id, p_event, n);
  end if;
  return jsonb_build_object('going', (select count(*) from hl.signups where calendar_id = p_id and event_id = p_event));
end $$;

-- Owner only: who is joining which activity.
create or replace function public.hl_signups(p_id uuid, p_key text)
returns jsonb language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('event', s.event_id, 'name', s.name, 'at', s.created_at) order by s.created_at), '[]'::jsonb)
  from hl.signups s join hl.calendars c on c.id = s.calendar_id
  where c.id = p_id and c.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
$$;

-- Owner stops sharing: everything is deleted.
create or replace function public.hl_unpublish(p_id uuid, p_key text)
returns void language sql security definer set search_path = '' as $$
  delete from hl.calendars where id = p_id and key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
$$;

revoke all on function public.hl_publish(uuid, text, text, jsonb), public.hl_calendar(uuid), public.hl_join(uuid, text, text), public.hl_signups(uuid, text), public.hl_unpublish(uuid, text) from public;
grant execute on function public.hl_publish(uuid, text, text, jsonb), public.hl_calendar(uuid), public.hl_join(uuid, text, text), public.hl_signups(uuid, text), public.hl_unpublish(uuid, text) to anon, authenticated;
