// 富格停車 — 會員中心
(function () {
  'use strict';
  const { $, el } = Fugo;
  const msg = $('#msg');

  const APP_STATUS = {
    pending: ['待處理', 'b-warn'],
    contacted: ['已聯絡', 'b-blue'],
    approved: ['已成立', 'b-ok'],
    rejected: ['未成立', 'b-bad'],
    cancelled: ['已取消', 'b-mute'],
  };
  const PAY_STATUS = { paid: ['已繳費', 'b-ok'], unpaid: ['未繳費', 'b-warn'], overdue: ['逾期', 'b-bad'] };

  let user = null;
  let lots = [];

  $('#btn-logout').addEventListener('click', () => Fugo.signOut());

  async function init() {
    if (!Fugo.ready) {
      $('#loading').classList.add('hidden');
      Fugo.requireReady(msg);
      return;
    }
    const session = await Fugo.getSession();
    if (!session) { location.replace('login.html'); return; }
    user = session.user;
    $('#who').textContent = user.email || user.phone || '';

    try {
      const [profile, admin] = await Promise.all([Fugo.getProfile(user.id), Fugo.isAdmin()]);
      if (admin) $('#admin-link').classList.remove('hidden');
      fillProfile(profile);
      $('#loading').classList.add('hidden');
      $('#content').classList.remove('hidden');
      Fugo.idleLogout(60);
      if (isComplete(profile)) await openMemberArea();
      else {
        $('#profile-sub').textContent = '第一次登入，請先填寫姓名與手機（必填），填完才能申請月租。';
        $('#pf-name').focus();
      }
    } catch (err) {
      $('#loading').classList.add('hidden');
      Fugo.showMsg(msg, 'err', Fugo.errText(err));
    }
  }

  const isComplete = (p) => Boolean(p && p.full_name && p.phone);

  function fillProfile(p) {
    $('#pf-name').value = (p && p.full_name) || (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
    let phone = (p && p.phone) || '';
    if (!phone && user.phone && /^886\d{9}$/.test(user.phone)) phone = '0' + user.phone.slice(3);
    $('#pf-phone').value = phone;
    $('#pf-email').value = (p && p.email) || user.email || (user.phone ? '手機 ' + phone : '');
  }

  $('#form-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const full_name = $('#pf-name').value.trim();
    const phone = Fugo.normalizePhone($('#pf-phone').value);
    if (!full_name) return Fugo.showMsg(msg, 'err', '請填寫姓名');
    if (!Fugo.isTwMobile(phone)) return Fugo.showMsg(msg, 'err', '請填寫正確的手機號碼（例：0912345678）');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { data, error } = await Fugo.client.from('fugo_profiles').update({ full_name, phone }).eq('id', user.id).select('id');
    btn.disabled = false;
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    if (!data || !data.length) return Fugo.showMsg(msg, 'err', '找不到會員資料，請登出後重新登入');
    Fugo.hideMsg(msg);
    Fugo.toast('會員資料已儲存');
    $('#profile-sub').textContent = '資料已儲存，可隨時修改。';
    if ($('#member-area').classList.contains('hidden')) await openMemberArea();
  });

  async function openMemberArea() {
    $('#member-area').classList.remove('hidden');
    await Promise.all([loadLots(), loadApps(), loadRentals()]);
    if (location.hash === '#apply') $('#apply').scrollIntoView({ behavior: 'smooth' });
  }

  async function loadLots() {
    const { data, error } = await Fugo.client.from('fugo_lots').select('id, name').eq('active', true).order('sort_order');
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    lots = data || [];
    $('#ap-lot').replaceChildren(
      el('option', { value: '', text: '請選擇停車場' }),
      ...lots.map((l) => el('option', { value: l.id, text: l.name })));
  }

  $('#form-apply').addEventListener('submit', async (e) => {
    e.preventDefault();
    const lot_id = Number($('#ap-lot').value);
    const plate = Fugo.normalizePlate($('#ap-plate').value);
    const start_date = $('#ap-start').value || null;
    const note = $('#ap-note').value.trim() || null;
    if (!lot_id) return Fugo.showMsg(msg, 'err', '請選擇停車場');
    if (!Fugo.isPlate(plate)) return Fugo.showMsg(msg, 'err', '車牌格式錯誤（例：ABC-1234）');
    if (start_date && start_date < Fugo.today()) return Fugo.showMsg(msg, 'err', '起租日不能早於今天');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { error } = await Fugo.client.from('fugo_applications').insert({ lot_id, plate, car_type: $('#ap-type').value, start_date, note });
    btn.disabled = false;
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    Fugo.hideMsg(msg);
    e.target.reset();
    Fugo.toast('申請已送出，客服會盡快與您聯絡');
    loadApps();
  });

  async function loadApps() {
    const box = $('#my-apps');
    const { data, error } = await Fugo.client.from('fugo_applications')
      .select('id, plate, car_type, start_date, note, status, admin_note, created_at, fugo_lots(name)')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) return box.replaceChildren(el('p', { class: 'empty', text: Fugo.errText(error) }));
    if (!data.length) return box.replaceChildren(el('p', { class: 'empty', text: '還沒有申請紀錄' }));
    box.replaceChildren(...data.map((a) => {
      const [label, cls] = APP_STATUS[a.status] || [a.status, 'b-mute'];
      return el('div', { class: 'list-item' },
        el('div', null,
          el('h4', null, (a.fugo_lots && a.fugo_lots.name) || '停車場', ' ', el('span', { class: 'badge ' + cls, text: label })),
          el('p', { text: `${a.car_type} ${a.plate}｜希望起租：${Fugo.fmtDate(a.start_date)}｜申請時間：${Fugo.fmtDateTime(a.created_at)}` }),
          a.admin_note ? el('p', { text: '客服回覆：' + a.admin_note }) : null),
        a.status === 'pending' ? el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: '取消申請', onclick: () => cancelApp(a.id) }) : null);
    }));
  }

  async function cancelApp(id) {
    if (!confirm('確定要取消這筆申請嗎？')) return;
    const { error } = await Fugo.client.rpc('fugo_cancel_application', { app_id: id });
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    Fugo.toast('已取消申請');
    loadApps();
  }

  async function loadRentals() {
    const box = $('#my-rentals');
    const { data, error } = await Fugo.client.from('fugo_rentals')
      .select('id, plate, space_no, monthly_fee, start_date, end_date, paid_until, payment_status, status, fugo_lots(name)')
      .eq('user_id', user.id).order('end_date', { ascending: false });
    if (error) return box.replaceChildren(el('p', { class: 'empty', text: Fugo.errText(error) }));
    if (!data.length) return box.replaceChildren(el('p', { class: 'empty', text: '目前沒有月租車位' }));
    box.replaceChildren(...data.map((r) => {
      const [label, cls] = PAY_STATUS[r.payment_status] || [r.payment_status, 'b-mute'];
      return el('div', { class: 'list-item' },
        el('div', null,
          el('h4', null, (r.fugo_lots && r.fugo_lots.name) || '停車場', r.space_no ? `（車位 ${r.space_no}）` : '', ' ',
            el('span', { class: 'badge ' + cls, text: label }),
            r.status === 'ended' ? el('span', { class: 'badge b-mute', text: '已結束' }) : null),
          el('p', { text: `車牌 ${r.plate}｜月租 ${Fugo.fmtMoney(r.monthly_fee)}｜租期 ${Fugo.fmtDate(r.start_date)} ～ ${Fugo.fmtDate(r.end_date)}${r.paid_until ? '｜已繳至 ' + Fugo.fmtDate(r.paid_until) : ''}` })));
    }));
  }

  init();
})();
