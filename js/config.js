// 富格停車 — 網站設定
// SUPABASE_URL 與 SUPABASE_KEY（publishable / anon key）本來就是公開給瀏覽器用的，
// 資料安全靠資料庫的 RLS 權限規則（見 supabase/schema.sql），不是靠隱藏這兩個值。
// 絕對不要把 service_role / secret key 放進這個檔案。
window.FUGO_CONFIG = {
  SUPABASE_URL: 'https://kapktvwocibjvmqotbzh.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcGt0dndvY2lianZtcW90YnpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1MjA3NDgsImV4cCI6MjExMTA5Njc0OH0.cw3JclG7NTpfxjil2tDs3VoIADXqofD5JMTtPAjD6vw',
  // 手機簡訊登入：需要先在 Supabase 後台設定簡訊服務（如 Twilio），設定好再改成 true
  PHONE_LOGIN_ENABLED: false,
  // Google 登入：需要先在 Supabase 後台啟用 Google 登入，設定好再改成 true
  GOOGLE_LOGIN_ENABLED: true,
};
