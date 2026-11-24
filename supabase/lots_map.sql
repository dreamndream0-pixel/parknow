-- 富格停車：停車場加上地圖與篩選用欄位（2026-11-25，網站地圖、後台新增停車場使用）
alter table public.fugo_lots
  add column if not exists city text not null default '台中市' check (char_length(city) between 1 and 10),
  add column if not exists district text not null default '' check (char_length(district) <= 10),
  add column if not exists lat double precision check (lat is null or (lat between 21 and 26.5)),
  add column if not exists lng double precision check (lng is null or (lng between 118 and 123)),
  add column if not exists hours text not null default '24 小時' check (char_length(hours) <= 40),
  add column if not exists rate text not null default '依現場公告' check (char_length(rate) <= 120),
  add column if not exists allow_temp boolean not null default true,
  add column if not exists allow_monthly boolean not null default true,
  add column if not exists allow_car boolean not null default true,
  add column if not exists allow_moto boolean not null default false,
  add column if not exists features text not null default '' check (char_length(features) <= 120);

update public.fugo_lots set district = '潭子區', address = '台中市潭子區（潭子區公所旁）', lat = 24.2096, lng = 120.7050, features = '共享停車' where id = 1;
update public.fugo_lots set district = '西區', lat = 24.1442, lng = 120.6633, map_query = '大墩文化中心 停車場 台中市西區英才路600號' where id = 2;
