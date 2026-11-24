# 富格停車 FUGO PARKING 網站

網址：https://dreamndream0-pixel.github.io/parknow/ （push 到 main 後 GitHub Pages 自動更新）

## 頁面
| 檔案 | 用途 |
|---|---|
| `index.html` | 首頁：主視覺、找停車場（搜尋＋臨停／月租切換＋Google 地圖）、最新消息、月租服務、關於富格 |
| `lot.html?id=…` | 停車場介紹：地圖、地址、營業時間、費率、導航、申請月租 |
| `news.html` | 最新消息：官方公告／服務指南分類，點開看內容 |

停車場在管理後台「停車場」分頁新增／編輯（城市、行政區、座標、臨停／月租、汽車／機車），首頁地圖會直接讀資料庫；`js/data.js` 是連不上資料庫時的備用資料，最新消息也寫在那裡。首頁地圖用 Leaflet（`js/vendor/leaflet-1.9.4.js`）＋ CARTO 底圖。
前台共用的側邊服務選單、手機底部列、客服面板在 `js/shell.js`，樣式在 `css/site.css`。
| `login.html` | 會員登入／註冊：Google、Email、手機簡訊（Google 與手機需先開通，見下方） |
| `member.html` | 會員中心：第一次登入必填姓名＋手機；申請月租、查看申請進度與自己的月租 |
| `admin.html` | 管理後台：月租資料（新增／編輯／到期提醒／繳費狀態／匯出）、月租申請、會員、停車場 |
| `privacy.html` | 隱私權政策 |

## 資料與安全
- 資料庫：Supabase 專案 `fugo-parking`（東京區），結構與權限在 `supabase/schema.sql`。
- 每張表都開啟 RLS：會員只能看／改自己的資料；月租資料只有管理員能新增修改；未登入只能看停車場清單。
- 管理員名單在 `fugo_admins` 表，網站無法讀寫，只能在 Supabase 的 SQL Editor 加入：
  ```sql
  insert into public.fugo_admins (email) values ('管理員的email（小寫）');
  ```
  管理員的 Email 必須已驗證（Google 登入或 Email 註冊並點過驗證信）。
- `js/config.js` 裡的 anon key 是公開金鑰，本來就會出現在瀏覽器；**絕對不要**放 service_role / secret key。
- 所有頁面有 CSP，只允許載入本站程式；使用者輸入一律以純文字顯示，避免 XSS；CSV 匯出防公式注入。
- 補強（`supabase/hardening.sql`）：欄位級最小權限（會員只能改姓名、手機）；申請只能選開放中的停車場、每人最多 3 筆待處理；所有新增／修改／刪除寫入 `fugo_audit_log`（後台「操作紀錄」可看，任何人都不能改）。
- 防嵌入：網站被別人用 iframe 嵌入時自動隱藏並跳回本站。後台閒置 15 分鐘、會員中心 60 分鐘自動登出。
- 權限自我檢測：在 Supabase SQL Editor 執行 `select fugo_private.selftest();`，會模擬會員、未登入、假管理員做 33 項攻擊，結果顯示在錯誤訊息裡，所有測試資料自動復原。

## 開通設定（在 Supabase 後台）
1. **網址設定**：Authentication → URL Configuration
   - Site URL：`https://dreamndream0-pixel.github.io/parknow/`
   - Redirect URLs：加入 `https://dreamndream0-pixel.github.io/parknow/**`
2. **Google 登入**：在 Google Cloud Console 建立 OAuth 用戶端（網頁應用程式），已授權的重新導向 URI 填 `https://kapktvwocibjvmqotbzh.supabase.co/auth/v1/callback`；把 Client ID／Secret 填到 Supabase → Authentication → Providers → Google。完成後把 `js/config.js` 的 `GOOGLE_LOGIN_ENABLED` 改成 `true`。
3. **手機簡訊登入**：Supabase → Authentication → Providers → Phone，選簡訊服務（如 Twilio）填入帳號（簡訊會產生費用）。完成後把 `PHONE_LOGIN_ENABLED` 改成 `true`。
4. **Email 驗證信**：Supabase 內建寄信每小時只能寄少量，會員多時建議在 Authentication → SMTP Settings 接自己的寄信服務。
