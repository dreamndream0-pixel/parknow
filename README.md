# 富格停車 FUGO PARKING 網站

網址：https://dreamndream0-pixel.github.io/parknow/ （push 到 main 後 GitHub Pages 自動更新）

## 頁面
| 檔案 | 用途 |
|---|---|
| `index.html` | 首頁：品牌、停車場（Google 地圖導航）、服務特色、月租申請流程、聯絡資訊 |
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

## 開通設定（在 Supabase 後台）
1. **網址設定**：Authentication → URL Configuration
   - Site URL：`https://dreamndream0-pixel.github.io/parknow/`
   - Redirect URLs：加入 `https://dreamndream0-pixel.github.io/parknow/**`
2. **Google 登入**：在 Google Cloud Console 建立 OAuth 用戶端（網頁應用程式），已授權的重新導向 URI 填 `https://kapktvwocibjvmqotbzh.supabase.co/auth/v1/callback`；把 Client ID／Secret 填到 Supabase → Authentication → Providers → Google。完成後把 `js/config.js` 的 `GOOGLE_LOGIN_ENABLED` 改成 `true`。
3. **手機簡訊登入**：Supabase → Authentication → Providers → Phone，選簡訊服務（如 Twilio）填入帳號（簡訊會產生費用）。完成後把 `PHONE_LOGIN_ENABLED` 改成 `true`。
4. **Email 驗證信**：Supabase 內建寄信每小時只能寄少量，會員多時建議在 Authentication → SMTP Settings 接自己的寄信服務。
