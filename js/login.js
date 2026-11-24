// 富格停車 — 登入／註冊
(function () {
  'use strict';
  const { $, $$ } = Fugo;
  const msg = $('#msg');
  const cfg = Fugo.cfg;

  // 只允許站內固定頁面，避免被利用成轉址跳板
  const params = new URLSearchParams(location.search);
  const next = params.get('next') === 'apply' ? 'member.html#apply' : 'member.html';
  const here = location.origin + location.pathname;
  const redirectTo = here + (params.get('next') === 'apply' ? '?next=apply' : '');

  if (!cfg.PHONE_LOGIN_ENABLED) $('#tab-phone').classList.add('hidden');
  if (!cfg.GOOGLE_LOGIN_ENABLED) {
    $('#btn-google').classList.add('hidden');
    $('.divider').classList.add('hidden');
  }

  function showForm(id) {
    ['#form-login', '#form-signup', '#form-phone'].forEach((f) => $(f).classList.toggle('hidden', f !== id));
    $$('.tabs button').forEach((b) => b.classList.toggle('on', '#form-' + b.dataset.tab === id));
    Fugo.hideMsg(msg);
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showForm('#form-' + b.dataset.tab)));

  function busy(form, on) {
    $$('button', form).forEach((b) => { b.disabled = on; });
  }

  // ── Cloudflare Turnstile「我不是機器人」 ──
  let captchaToken = '';
  let captchaWidget = null;
  const captchaOn = Boolean(cfg.TURNSTILE_SITE_KEY);
  function loadCaptcha() {
    if (!captchaOn) return;
    $('#captcha').classList.remove('hidden');
    window.fugoTurnstileReady = () => {
      captchaWidget = window.turnstile.render('#captcha', {
        sitekey: cfg.TURNSTILE_SITE_KEY,
        language: 'zh-tw',
        callback: (t) => { captchaToken = t; },
        'expired-callback': () => { captchaToken = ''; },
        'error-callback': () => { captchaToken = ''; },
      });
    };
    const sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=fugoTurnstileReady';
    sc.async = true;
    document.head.append(sc);
  }
  // 每個送出動作都要一個新的驗證碼；用過就重置
  function needCaptcha() {
    if (!captchaOn) return false;
    if (captchaToken) return false;
    Fugo.showMsg(msg, 'err', '請先完成下方的「我不是機器人」驗證');
    return true;
  }
  function takeCaptcha() {
    const t = captchaToken || undefined;
    captchaToken = '';
    if (captchaWidget !== null && window.turnstile) window.turnstile.reset(captchaWidget);
    return t;
  }
  loadCaptcha();

  async function afterLogin() {
    location.replace(next);
  }

  if (params.get('timeout') === '1') Fugo.showMsg(msg, 'info', '您已閒置一段時間，為了保護資料已自動登出，請重新登入。');

  if (!Fugo.ready) {
    Fugo.requireReady(msg);
    $$('form button, #btn-google').forEach((b) => { b.disabled = true; });
    return;
  }

  // 已登入就直接進會員中心；從「重設密碼」信回來則顯示設新密碼
  let recovering = /type=recovery/.test(location.hash) || params.get('reset') === '1';
  Fugo.client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recovering = true;
      $('#auth-main').classList.add('hidden');
      $('#form-forgot').classList.add('hidden');
      $('#form-newpass').classList.remove('hidden');
      $('#auth-title').textContent = '設定新密碼';
    }
  });
  Fugo.getSession().then((s) => {
    if (s && !recovering) afterLogin();
    if (s && recovering) {
      $('#auth-main').classList.add('hidden');
      $('#form-newpass').classList.remove('hidden');
      $('#auth-title').textContent = '設定新密碼';
    }
  });

  // Google
  $('#btn-google').addEventListener('click', async () => {
    const { error } = await Fugo.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) Fugo.showMsg(msg, 'err', Fugo.errText(error));
  });

  // Email 登入
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#li-email').value.trim();
    const password = $('#li-pass').value;
    if (!email || !password) return Fugo.showMsg(msg, 'err', '請輸入 Email 和密碼');
    if (needCaptcha()) return;
    busy(e.target, true);
    const { error } = await Fugo.client.auth.signInWithPassword({ email, password, options: { captchaToken: takeCaptcha() } });
    busy(e.target, false);
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    afterLogin();
  });

  // Email 註冊
  $('#form-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#su-email').value.trim();
    const p1 = $('#su-pass').value;
    const p2 = $('#su-pass2').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Fugo.showMsg(msg, 'err', 'Email 格式不正確');
    if (p1.length < 8) return Fugo.showMsg(msg, 'err', '密碼至少要 8 個字元');
    if (p1 !== p2) return Fugo.showMsg(msg, 'err', '兩次輸入的密碼不一樣');
    if (needCaptcha()) return;
    busy(e.target, true);
    const { data, error } = await Fugo.client.auth.signUp({ email, password: p1, options: { emailRedirectTo: redirectTo, captchaToken: takeCaptcha() } });
    busy(e.target, false);
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    if (data.session) return afterLogin();
    e.target.reset();
    Fugo.showMsg(msg, 'ok', '驗證信已寄到 ' + email + '，請到信箱點連結完成註冊（沒收到請看垃圾信件匣）。');
  });

  // 手機簡訊
  let phoneSent = '';
  $('#form-phone').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = $('#ph-num').value;
    if (!Fugo.isTwMobile(raw)) return Fugo.showMsg(msg, 'err', '請輸入正確的手機號碼（例：0912345678）');
    const phone = Fugo.toE164(raw);
    if ((!phoneSent || phoneSent !== phone) && needCaptcha()) return;
    busy(e.target, true);
    if (!phoneSent || phoneSent !== phone) {
      const { error } = await Fugo.client.auth.signInWithOtp({ phone, options: { captchaToken: takeCaptcha() } });
      busy(e.target, false);
      if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
      phoneSent = phone;
      $('#ph-code-row').classList.remove('hidden');
      $('#ph-btn').textContent = '確認驗證碼並登入';
      $('#ph-code').focus();
      return Fugo.showMsg(msg, 'ok', '驗證碼已傳到您的手機，請在 5 分鐘內輸入。');
    }
    const token = $('#ph-code').value.trim();
    if (!/^\d{6}$/.test(token)) { busy(e.target, false); return Fugo.showMsg(msg, 'err', '請輸入 6 位數驗證碼'); }
    const { error } = await Fugo.client.auth.verifyOtp({ phone, token, type: 'sms' });
    busy(e.target, false);
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    afterLogin();
  });

  // 忘記密碼
  $('#link-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    $('#auth-main').classList.add('hidden');
    $('#form-forgot').classList.remove('hidden');
    $('#fg-email').value = $('#li-email').value;
    Fugo.hideMsg(msg);
  });
  $('#link-back').addEventListener('click', (e) => {
    e.preventDefault();
    $('#form-forgot').classList.add('hidden');
    $('#auth-main').classList.remove('hidden');
    Fugo.hideMsg(msg);
  });
  $('#form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#fg-email').value.trim();
    if (!email) return Fugo.showMsg(msg, 'err', '請輸入 Email');
    if (needCaptcha()) return;
    busy(e.target, true);
    const { error } = await Fugo.client.auth.resetPasswordForEmail(email, { redirectTo: here + '?reset=1', captchaToken: takeCaptcha() });
    busy(e.target, false);
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    // 不論帳號是否存在都顯示一樣的訊息，避免被拿來查詢誰是會員
    Fugo.showMsg(msg, 'ok', '如果這個 Email 有註冊，重設密碼信已寄出，請到信箱查看。');
  });
  $('#form-newpass').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('#np-pass').value;
    if (p1.length < 8) return Fugo.showMsg(msg, 'err', '密碼至少要 8 個字元');
    if (p1 !== $('#np-pass2').value) return Fugo.showMsg(msg, 'err', '兩次輸入的密碼不一樣');
    busy(e.target, true);
    const { error } = await Fugo.client.auth.updateUser({ password: p1 });
    busy(e.target, false);
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    Fugo.toast('密碼已更新');
    setTimeout(() => location.replace('member.html'), 900);
  });
})();
