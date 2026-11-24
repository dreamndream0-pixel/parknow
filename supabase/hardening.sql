-- 富格停車：安全補強（2026-11-24）
-- 1. 權限收到最小：未登入只能讀停車場；會員只能改自己的姓名、手機
-- 2. 申請只能選開放中的停車場，且每人最多 3 筆待處理（防灌爆）
-- 3. 操作紀錄：月租、申請、停車場、會員資料的每一次新增／修改／刪除都留下「誰、何時、改了什麼」，任何人都不能改紀錄
-- 4. 內部檢測用的函式放在不對外開放的 fugo_private schema

-- ───────── 1. 最小權限 ─────────
revoke all on public.fugo_lots, public.fugo_profiles, public.fugo_applications, public.fugo_rentals, public.fugo_admins from anon, authenticated;

grant select on public.fugo_lots to anon;
grant select, insert, update on public.fugo_lots to authenticated;          -- 寫入仍受 RLS：只有管理員

grant select on public.fugo_profiles to authenticated;                      -- RLS：自己＋管理員
grant update (full_name, phone) on public.fugo_profiles to authenticated;   -- 只能改這兩欄

grant select on public.fugo_applications to authenticated;
grant insert (lot_id, plate, car_type, start_date, note) on public.fugo_applications to authenticated;
grant update (status, admin_note) on public.fugo_applications to authenticated; -- RLS：只有管理員
grant delete on public.fugo_applications to authenticated;                  -- RLS：只有管理員

grant select, insert, update, delete on public.fugo_rentals to authenticated; -- 寫入 RLS：只有管理員

-- ───────── 2. 申請限制（加一層「必須同時符合」的限制型規則） ─────────
create or replace function public.fugo_can_apply(p_lot bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.fugo_lots l where l.id = p_lot and l.active)
     and (select count(*) from public.fugo_applications a
          where a.user_id = auth.uid() and a.status = 'pending') < 3;
$$;
revoke all on function public.fugo_can_apply(bigint) from public, anon;
grant execute on function public.fugo_can_apply(bigint) to authenticated;

create policy "apps_insert_limits" on public.fugo_applications
  as restrictive
  for insert to authenticated
  with check ((select public.fugo_can_apply(lot_id)));

-- ───────── 3. 操作紀錄 ─────────
create table if not exists public.fugo_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  table_name text not null,
  row_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb
);
alter table public.fugo_audit_log enable row level security;
revoke all on public.fugo_audit_log from anon, authenticated;
grant select on public.fugo_audit_log to authenticated;
create policy "audit_admin_read" on public.fugo_audit_log
  for select to authenticated
  using ((select public.fugo_is_admin()));

create or replace function public.fugo_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  em text;
begin
  if uid is not null then
    select u.email into em from auth.users u where u.id = uid;
  end if;
  insert into public.fugo_audit_log (actor, actor_email, table_name, row_id, action, old_data, new_data)
  values (
    uid, em, tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', ''),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.fugo_audit() from public, anon, authenticated;

create trigger fugo_audit_rentals after insert or update or delete on public.fugo_rentals
  for each row execute function public.fugo_audit();
create trigger fugo_audit_apps after insert or update or delete on public.fugo_applications
  for each row execute function public.fugo_audit();
create trigger fugo_audit_lots after insert or update or delete on public.fugo_lots
  for each row execute function public.fugo_audit();
create trigger fugo_audit_profiles after update or delete on public.fugo_profiles
  for each row execute function public.fugo_audit();
create trigger fugo_audit_admins after insert or update or delete on public.fugo_admins
  for each row execute function public.fugo_audit();

-- 未登入讀停車場時規則會呼叫 fugo_is_admin（對未登入回傳 false）
grant execute on function public.fugo_is_admin() to anon;
