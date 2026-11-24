-- 富格停車 FUGO PARKING 資料庫結構
-- 安全原則：每張表都開啟 RLS（列層級權限）。
--   一般會員：只能讀寫「自己的」個人資料與申請，只能讀「自己的」月租紀錄。
--   管理員：名單存在 fugo_admins（只能由資料庫擁有者在 SQL 後台加入，網站無法修改）。
--   未登入訪客：只能讀取停車場清單。

-- ───────── 管理員名單 ─────────
create table if not exists public.fugo_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.fugo_admins enable row level security;
-- 不建立任何 policy → 網站（anon / authenticated）完全無法讀寫此表

-- 判斷目前登入者是否為管理員（Email 必須已驗證）
create or replace function public.fugo_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.fugo_admins a on a.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.fugo_is_admin() from public, anon;
grant execute on function public.fugo_is_admin() to authenticated;

-- ───────── 會員資料 ─────────
create table if not exists public.fugo_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 50),
  phone text check (phone is null or phone ~ '^09[0-9]{8}$'),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fugo_profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.fugo_profiles;
create policy "profiles_select_own_or_admin" on public.fugo_profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.fugo_is_admin()));

-- 不開放網站直接新增會員資料：一律由註冊時的觸發器建立（避免偽造 Email）

drop policy if exists "profiles_update_own" on public.fugo_profiles;
create policy "profiles_update_own" on public.fugo_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 新註冊時自動建立空白會員資料（Email 從登入帳號帶入，會員不能自己改）
create or replace function public.fugo_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fugo_profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 50), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.fugo_handle_new_user() from public, anon, authenticated;

drop trigger if exists fugo_on_auth_user_created on auth.users;
create trigger fugo_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fugo_handle_new_user();

-- 會員不能竄改 email／id／建立時間；更新時間由資料庫自動填
create or replace function public.fugo_profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists fugo_profiles_guard on public.fugo_profiles;
create trigger fugo_profiles_guard
  before update on public.fugo_profiles
  for each row execute function public.fugo_profiles_guard();

-- 判斷會員資料是否已填完整（姓名＋手機）
create or replace function public.fugo_profile_complete()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fugo_profiles p
    where p.id = auth.uid() and p.full_name is not null and p.phone is not null
  );
$$;
revoke all on function public.fugo_profile_complete() from public, anon;
grant execute on function public.fugo_profile_complete() to authenticated;

-- ───────── 停車場 ─────────
create table if not exists public.fugo_lots (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  address text check (address is null or char_length(address) <= 120),
  map_query text check (map_query is null or char_length(map_query) <= 120),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.fugo_lots enable row level security;

drop policy if exists "lots_public_read" on public.fugo_lots;
create policy "lots_public_read" on public.fugo_lots
  for select to anon, authenticated
  using (active or (select public.fugo_is_admin()));

drop policy if exists "lots_admin_write" on public.fugo_lots;
create policy "lots_admin_write" on public.fugo_lots
  for all to authenticated
  using ((select public.fugo_is_admin()))
  with check ((select public.fugo_is_admin()));

-- ───────── 月租申請（會員送出） ─────────
create table if not exists public.fugo_applications (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lot_id bigint not null references public.fugo_lots(id),
  plate text not null check (plate ~ '^[A-Z0-9]{2,4}-[A-Z0-9]{2,4}$'),
  car_type text not null default '汽車' check (car_type in ('汽車','機車')),
  start_date date,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending','contacted','approved','rejected','cancelled')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fugo_applications_user_idx on public.fugo_applications(user_id);
create index if not exists fugo_applications_lot_idx on public.fugo_applications(lot_id);
alter table public.fugo_applications enable row level security;

drop policy if exists "apps_select_own_or_admin" on public.fugo_applications;
create policy "apps_select_own_or_admin" on public.fugo_applications
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.fugo_is_admin()));

drop policy if exists "apps_insert_own_complete_profile" on public.fugo_applications;
create policy "apps_insert_own_complete_profile" on public.fugo_applications
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and admin_note is null
    and (select public.fugo_profile_complete())
  );

drop policy if exists "apps_admin_update" on public.fugo_applications;
create policy "apps_admin_update" on public.fugo_applications
  for update to authenticated
  using ((select public.fugo_is_admin()))
  with check ((select public.fugo_is_admin()));

drop policy if exists "apps_admin_delete" on public.fugo_applications;
create policy "apps_admin_delete" on public.fugo_applications
  for delete to authenticated
  using ((select public.fugo_is_admin()));

-- 會員取消自己「待處理」的申請（只能改狀態為 cancelled，不能改其他欄位）
create or replace function public.fugo_cancel_application(app_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.fugo_applications
     set status = 'cancelled', updated_at = now()
   where id = app_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception '無法取消這筆申請';
  end if;
end;
$$;
revoke all on function public.fugo_cancel_application(bigint) from public, anon;
grant execute on function public.fugo_cancel_application(bigint) to authenticated;

-- ───────── 月租資料（管理員維護） ─────────
create table if not exists public.fugo_rentals (
  id bigint generated always as identity primary key,
  lot_id bigint not null references public.fugo_lots(id),
  user_id uuid references auth.users(id) on delete set null,
  tenant_name text not null check (char_length(tenant_name) between 1 and 50),
  phone text not null check (char_length(phone) between 6 and 20),
  plate text not null check (char_length(plate) between 2 and 12),
  space_no text check (space_no is null or char_length(space_no) <= 20),
  monthly_fee integer not null default 0 check (monthly_fee >= 0 and monthly_fee <= 1000000),
  start_date date not null,
  end_date date not null,
  paid_until date,
  payment_status text not null default 'unpaid' check (payment_status in ('paid','unpaid','overdue')),
  status text not null default 'active' check (status in ('active','ended')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists fugo_rentals_lot_idx on public.fugo_rentals(lot_id);
create index if not exists fugo_rentals_user_idx on public.fugo_rentals(user_id);
alter table public.fugo_rentals enable row level security;

drop policy if exists "rentals_select_own_or_admin" on public.fugo_rentals;
create policy "rentals_select_own_or_admin" on public.fugo_rentals
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.fugo_is_admin()));

drop policy if exists "rentals_admin_insert" on public.fugo_rentals;
create policy "rentals_admin_insert" on public.fugo_rentals
  for insert to authenticated
  with check ((select public.fugo_is_admin()));

drop policy if exists "rentals_admin_update" on public.fugo_rentals;
create policy "rentals_admin_update" on public.fugo_rentals
  for update to authenticated
  using ((select public.fugo_is_admin()))
  with check ((select public.fugo_is_admin()));

drop policy if exists "rentals_admin_delete" on public.fugo_rentals;
create policy "rentals_admin_delete" on public.fugo_rentals
  for delete to authenticated
  using ((select public.fugo_is_admin()));

-- 更新時間自動填
create or replace function public.fugo_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists fugo_rentals_touch on public.fugo_rentals;
create trigger fugo_rentals_touch before update on public.fugo_rentals
  for each row execute function public.fugo_touch_updated_at();
drop trigger if exists fugo_apps_touch on public.fugo_applications;
create trigger fugo_apps_touch before update on public.fugo_applications
  for each row execute function public.fugo_touch_updated_at();

-- 申請一旦建立，申請人與建立時間不可被改
create or replace function public.fugo_apps_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists fugo_apps_guard on public.fugo_applications;
create trigger fugo_apps_guard before update on public.fugo_applications
  for each row execute function public.fugo_apps_guard();

-- 明確收回 anon 對個資表的權限（RLS 之外再加一道）
revoke all on public.fugo_profiles, public.fugo_applications, public.fugo_rentals, public.fugo_admins from anon;
revoke all on public.fugo_admins from authenticated;
revoke insert, update, delete on public.fugo_lots from anon;

-- ───────── 預設停車場 ─────────
insert into public.fugo_lots (name, address, map_query, sort_order)
select * from (values
  ('潭子區公所共享停車場', '台中市潭子區', '潭子區公所 停車場', 1),
  ('大墩文化中心停車場', '台中市西區英才路600號', '大墩文化中心 停車場', 2)
) v(name, address, map_query, sort_order)
where not exists (select 1 from public.fugo_lots);
