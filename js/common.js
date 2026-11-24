// 富格停車 — 共用工具
(function () {
  'use strict';
  const cfg = window.FUGO_CONFIG || {};

  const Fugo = {
    cfg,
    client: null,
    ready: Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_KEY && window.supabase),
  };

  if (Fugo.ready) {
    Fugo.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }

  // 建立元素（一律用 textContent，避免把使用者輸入當成 HTML 執行）
  Fugo.el = function (tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  };

  Fugo.$ = (sel, root) => (root || document).querySelector(sel);
  Fugo.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let toastTimer;
  Fugo.toast = function (text) {
    let t = document.getElementById('toast');
    if (!t) {
      t = Fugo.el('div', { id: 'toast', class: 'toast', role: 'status' });
      document.body.append(t);
    }
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
  };

  Fugo.showMsg = function (box, kind, text) {
    if (!box) return;
    box.className = 'msg ' + kind;
    box.textContent = text;
    box.classList.remove('hidden');
  };
  Fugo.hideMsg = (box) => box && box.classList.add('hidden');

  Fugo.mapUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  // 台灣手機：09xxxxxxxx
  Fugo.normalizePhone = (v) => String(v || '').replace(/[\s-]/g, '');
  Fugo.isTwMobile = (v) => /^09\d{8}$/.test(Fugo.normalizePhone(v));
  Fugo.toE164 = (v) => '+886' + Fugo.normalizePhone(v).slice(1);
  // 車牌：大寫、統一用 -
  Fugo.normalizePlate = (v) => {
    let s = String(v || '').toUpperCase().replace(/\s/g, '').replace(/[－—_]/g, '-');
    if (!s.includes('-')) {
      const m = s.match(/^([A-Z]+)(\d+)$/) || s.match(/^(\d+)([A-Z]+)$/);
      if (m) s = m[1] + '-' + m[2];
    }
    return s;
  };
  Fugo.isPlate = (v) => /^[A-Z0-9]{2,4}-[A-Z0-9]{2,4}$/.test(Fugo.normalizePlate(v));

  Fugo.fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');
  Fugo.fmtDateTime = (d) => {
    if (!d) return '—';
    const x = new Date(d);
    return x.toLocaleString('zh-TW', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  Fugo.fmtMoney = (n) => 'NT$ ' + Number(n || 0).toLocaleString('zh-TW');
  Fugo.today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  // 把 Supabase 錯誤轉成白話
  Fugo.errText = function (err) {
    const m = String((err && (err.message || err.error_description)) || err || '');
    if (/Invalid login credentials/i.test(m)) return 'Email 或密碼錯誤';
    if (/Email not confirmed/i.test(m)) return '這個 Email 還沒完成驗證，請先到信箱點驗證連結';
    if (/User already registered/i.test(m)) return '這個 Email 已經註冊過，請直接登入';
    if (/Password should be/i.test(m)) return '密碼至少要 8 個字元';
    if (/rate limit|too many/i.test(m)) return '操作太頻繁，請稍等幾分鐘再試';
    if (/provider is not enabled|Unsupported provider/i.test(m)) return '這個登入方式還沒開通';
    if (/Token has expired|invalid.*otp|Invalid OTP/i.test(m)) return '驗證碼錯誤或已過期';
    if (/row-level security|permission denied/i.test(m)) return '沒有權限執行這個動作';
    if (/fugo_profiles_phone_check|phone_check/i.test(m)) return '手機號碼格式錯誤（例：0912345678）';
    if (/plate_check/i.test(m)) return '車牌格式錯誤（例：ABC-1234）';
    if (/Failed to fetch|NetworkError/i.test(m)) return '網路連線失敗，請稍後再試';
    return m || '發生錯誤，請稍後再試';
  };

  Fugo.requireReady = function (box) {
    if (Fugo.ready) return true;
    Fugo.showMsg(box, 'info', '會員系統正在設定中，即將開放。如需月租服務請來電 0800-899-969。');
    return false;
  };

  Fugo.getSession = async function () {
    if (!Fugo.ready) return null;
    const { data } = await Fugo.client.auth.getSession();
    return data.session || null;
  };

  Fugo.getProfile = async function (uid) {
    const { data, error } = await Fugo.client.from('fugo_profiles').select('id, full_name, phone, email, created_at').eq('id', uid).maybeSingle();
    if (error) throw error;
    return data;
  };

  Fugo.isAdmin = async function () {
    const { data, error } = await Fugo.client.rpc('fugo_is_admin');
    if (error) return false;
    return data === true;
  };

  Fugo.signOut = async function () {
    if (Fugo.ready) await Fugo.client.auth.signOut();
    location.href = 'index.html';
  };

  // 手機選單
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('menu-btn');
    const nav = document.getElementById('nav');
    if (btn && nav) {
      btn.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.addEventListener('click', (e) => { if (e.target.tagName === 'A') nav.classList.remove('open'); });
    }
    const y = document.getElementById('year');
    if (y) y.textContent = String(new Date().getFullYear());
  });

  window.Fugo = Fugo;
})();
