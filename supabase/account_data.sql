-- Accounts: each person's app data, saved privately (applied to project "habitlab" as migration
-- account_data_sync). Private schema `hl`, RLS on with no policies: only these functions touch the
-- table, and each acts only for the logged-in person (auth.uid()). Anonymous callers can't run them.
create table if not exists hl.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  saved_at bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table hl.user_data enable row level security;
revoke all on hl.user_data from anon, authenticated;

create or replace function public.hl_my_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if uid is null then raise exception 'Not logged in' using errcode = '28000'; end if;
  select data, saved_at, updated_at into r from hl.user_data where user_id = uid;
  if not found then return null; end if;
  return jsonb_build_object('data', r.data, 'saved_at', r.saved_at, 'updated_at', r.updated_at);
end;
$$;

create or replace function public.hl_save_my_data(p_data jsonb, p_saved_at bigint)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t timestamptz := now();
begin
  if uid is null then raise exception 'Not logged in' using errcode = '28000'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Bad data' using errcode = '22023'; end if;
  if octet_length(p_data::text) > 3000000 then raise exception 'Too much data' using errcode = '54000'; end if;
  insert into hl.user_data (user_id, data, saved_at, updated_at)
  values (uid, p_data, coalesce(p_saved_at, 0), t)
  on conflict (user_id) do update set data = excluded.data, saved_at = excluded.saved_at, updated_at = t;
  return t;
end;
$$;

create or replace function public.hl_delete_my_data()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not logged in' using errcode = '28000'; end if;
  delete from hl.user_data where user_id = auth.uid();
end;
$$;

revoke all on function public.hl_my_data() from public, anon;
revoke all on function public.hl_save_my_data(jsonb, bigint) from public, anon;
revoke all on function public.hl_delete_my_data() from public, anon;
grant execute on function public.hl_my_data() to authenticated;
grant execute on function public.hl_save_my_data(jsonb, bigint) to authenticated;
grant execute on function public.hl_delete_my_data() to authenticated;
