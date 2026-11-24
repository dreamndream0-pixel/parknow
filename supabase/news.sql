-- 富格停車 — 最新消息（後台可新增／編輯／下架）
-- 公開只能讀「已發布」的消息；只有管理員能新增修改；所有異動寫入 fugo_audit_log
create table if not exists public.fugo_news (
  id bigint generated always as identity primary key,
  cat text not null default 'notice' check (cat in ('notice', 'guide', 'lottery')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 5000),
  publish_date date not null default current_date,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fugo_news enable row level security;

create policy "news_public_read" on public.fugo_news
  for select to anon, authenticated
  using (published or (select public.fugo_is_admin()));

create policy "news_admin_write" on public.fugo_news
  for all to authenticated
  using ((select public.fugo_is_admin()))
  with check ((select public.fugo_is_admin()));

create index if not exists fugo_news_date_idx on public.fugo_news (publish_date desc, id desc);

create trigger fugo_audit_news after insert or update or delete on public.fugo_news
  for each row execute function public.fugo_audit();

-- 原本寫在 js/data.js 的範例消息搬進資料庫
insert into public.fugo_news (cat, title, body, publish_date)
select * from (values
  ('notice', '富格停車官網上線', E'富格停車官網正式上線！現在可以直接在網站查詢停車據點、開啟 Google 地圖導航，也能加入會員線上申請月租車位。\n使用上有任何問題，歡迎撥打客服專線 0800-899-969 或加入 LINE 官方帳號 @980gulhj。', date '2026-11-24'),
  ('guide', '月租申請流程說明', E'1. 加入會員：可用 Google 帳號或 Email 註冊登入。\n2. 填寫會員資料：第一次登入請填姓名與手機，方便我們聯絡您。\n3. 送出申請：選擇停車場、填寫車牌與希望起租日。\n4. 專人聯繫：客服確認車位後與您聯絡，完成簽約繳費即可開始停車。申請進度可隨時在會員中心查看。', date '2026-11-24'),
  ('guide', '如何查詢停車場入口', E'在首頁「找停車場」點選想去的據點，地圖會移到該停車場；按「導航」就會開啟 Google 地圖，帶您開到入口。\n也可以點進據點介紹頁，查看地址、營業時間與費率說明。', date '2026-11-18'),
  ('notice', '客服聯絡方式', E'客服專線：0800-899-969（免付費）\nLINE 官方帳號：@980gulhj\n總公司：台中市北區台灣大道二段360號18樓之3', date '2026-11-10')
) as v(cat, title, body, publish_date)
where not exists (select 1 from public.fugo_news);
