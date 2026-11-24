// 富格停車 — 管理後台
// 注意：這頁的隱藏只是方便使用；真正的權限由資料庫 RLS 把關，非管理員就算打開這頁也讀不到任何資料。
(function () {
  'use strict';
  const { $, $$, el } = Fugo;
  const msg = $('#msg');
  const db = () => Fugo.client;

  const APP_STATUS = {
    pending: ['待處理', 'b-warn'], contacted: ['已聯絡', 'b-blue'], approved: ['已成立', 'b-ok'],
    rejected: ['未成立', 'b-bad'], cancelled: ['已取消', 'b-mute'],
  };
  const PAY = { paid: ['已繳費', 'b-ok'], unpaid: ['未繳費', 'b-warn'], overdue: ['逾期', 'b-bad'] };

  let lots = [], rentals = [], apps = [], members = [];
  let editingRental = null, editingApp = null, editingLot = null;

  $('#btn-logout').addEventListener('click', () => Fugo.signOut());

  // ── 分頁 ──
  $$('.admin-tabs button').forEach((b) => b.addEventListener('click', () => {
    $$('.admin-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    if (b.dataset.tab === 'audit') loadAudit();
    ['rentals', 'apps', 'members', 'lots', 'audit'].forEach((t) => $('#tab-' + t).classList.toggle('hidden', t !== b.dataset.tab));
  }));

  async function init() {
    if (!Fugo.ready) { $('#loading').classList.add('hidden'); Fugo.requireReady(msg); return; }
    const s = await Fugo.getSession();
    if (!s) { location.replace('login.html'); return; }
    $('#who').textContent = s.user.email || s.user.phone || '';
    if (!(await Fugo.isAdmin())) {
      $('#loading').classList.add('hidden');
      Fugo.showMsg(msg, 'err', '您沒有管理後台的權限。');
      return;
    }
    $('#loading').classList.add('hidden');
    $('#content').classList.remove('hidden');
    Fugo.idleLogout(15);
    await reloadAll();
  }

  async function reloadAll() {
    try {
      await Promise.all([loadLots(), loadMembers()]);
      await Promise.all([loadRentals(), loadApps()]);
      renderStats();
    } catch (err) {
      Fugo.showMsg(msg, 'err', Fugo.errText(err));
    }
  }

  const lotName = (id) => (lots.find((l) => l.id === id) || {}).name || '—';
  const memberById = (id) => members.find((m) => m.id === id);
  const daysUntil = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(Fugo.today() + 'T00:00:00')) / 86400000);

  // ── 資料讀取 ──
  async function loadLots() {
    const { data, error } = await db().from('fugo_lots').select('*').order('sort_order').order('id');
    if (error) throw error;
    lots = data;
    const opts = lots.map((l) => el('option', { value: l.id, text: l.name + (l.active ? '' : '（暫停）') }));
    $('#rt-lot').replaceChildren(el('option', { value: '', text: '全部停車場' }), ...opts.map((o) => o.cloneNode(true)));
    $('#rf-lot').replaceChildren(...opts);
    renderLots();
  }
  async function loadMembers() {
    const { data, error } = await db().from('fugo_profiles').select('id, full_name, phone, email, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    members = data;
    $('#rf-member').replaceChildren(el('option', { value: '', text: '不綁定' }),
      ...members.filter((m) => m.full_name).map((m) => el('option', { value: m.id, text: `${m.full_name}（${m.phone || m.email || ''}）` })));
    renderMembers();
  }
  async function loadRentals() {
    const { data, error } = await db().from('fugo_rentals').select('*').order('end_date');
    if (error) throw error;
    rentals = data;
    renderRentals();
  }
  async function loadApps() {
    const { data, error } = await db().from('fugo_applications').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    apps = data;
    renderApps();
  }

  function renderStats() {
    const active = rentals.filter((r) => r.status === 'active');
    $('#st-active').textContent = active.length;
    $('#st-pending').textContent = apps.filter((a) => a.status === 'pending').length;
    $('#st-expiring').textContent = active.filter((r) => daysUntil(r.end_date) <= 14).length;
    $('#st-unpaid').textContent = active.filter((r) => r.payment_status !== 'paid').length;
    $('#st-income').textContent = Fugo.fmtMoney(active.reduce((s, r) => s + (r.monthly_fee || 0), 0));
    $('#st-members').textContent = members.length;
  }

  // ── 月租資料 ──
  function filteredRentals() {
    const q = $('#rt-search').value.trim().toLowerCase();
    const lot = $('#rt-lot').value;
    const f = $('#rt-filter').value;
    return rentals.filter((r) => {
      if (lot && String(r.lot_id) !== lot) return false;
      if (f === 'active' && r.status !== 'active') return false;
      if (f === 'ended' && r.status !== 'ended') return false;
      if (f === 'expiring' && !(r.status === 'active' && daysUntil(r.end_date) <= 14)) return false;
      if (f === 'unpaid' && !(r.status === 'active' && r.payment_status !== 'paid')) return false;
      if (q) {
        const hay = [r.tenant_name, r.phone, r.plate, r.space_no, r.note].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  function renderRentals() {
    const rows = filteredRentals();
    const body = $('#rt-body');
    if (!rows.length) return body.replaceChildren(el('tr', null, el('td', { colspan: 9, class: 'empty', text: '沒有符合的月租資料' })));
    body.replaceChildren(...rows.map((r) => {
      const [pl, pc] = PAY[r.payment_status] || [r.payment_status, 'b-mute'];
      const left = daysUntil(r.end_date);
      const due = r.status === 'ended' ? el('span', { class: 'badge b-mute', text: '已結束' })
        : left < 0 ? el('span', { class: 'badge b-bad', text: `已過期 ${-left} 天` })
        : left <= 14 ? el('span', { class: 'badge b-warn', text: `剩 ${left} 天` }) : null;
      const m = r.user_id ? memberById(r.user_id) : null;
      return el('tr', null,
        el('td', { text: lotName(r.lot_id) }),
        el('td', { text: r.space_no || '—' }),
        el('td', null, r.tenant_name, m ? el('div', null, el('span', { class: 'badge b-blue', text: '已綁會員' })) : null),
        el('td', null, el('a', { href: 'tel:' + r.phone.replace(/[^\d+]/g, ''), text: r.phone })),
        el('td', { text: r.plate }),
        el('td', { text: Fugo.fmtMoney(r.monthly_fee) }),
        el('td', null, `${Fugo.fmtDate(r.start_date)} ～ ${Fugo.fmtDate(r.end_date)}`, due ? el('div', null, due) : null),
        el('td', null, el('span', { class: 'badge ' + pc, text: pl }), r.paid_until ? el('div', { class: 'hint', text: '繳至 ' + Fugo.fmtDate(r.paid_until) }) : null),
        el('td', null, el('div', { class: 'row-actions' },
          el('button', { class: 'btn btn-line btn-sm', type: 'button', text: '編輯', onclick: () => openRental(r) }),
          el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: '刪除', onclick: () => deleteRental(r) }))));
    }));
  }
  ['#rt-search', '#rt-lot', '#rt-filter'].forEach((s) => $(s).addEventListener('input', renderRentals));

  function openRental(r, prefill) {
    editingRental = r || null;
    const d = r || prefill || {};
    $('#rt-title').textContent = r ? '編輯月租' : '新增月租';
    $('#rf-lot').value = d.lot_id || (lots[0] && lots[0].id) || '';
    $('#rf-space').value = d.space_no || '';
    $('#rf-name').value = d.tenant_name || '';
    $('#rf-phone').value = d.phone || '';
    $('#rf-plate').value = d.plate || '';
    $('#rf-fee').value = d.monthly_fee != null ? d.monthly_fee : '';
    $('#rf-start').value = d.start_date || Fugo.today();
    $('#rf-end').value = d.end_date || '';
    $('#rf-paid').value = d.paid_until || '';
    $('#rf-pay').value = d.payment_status || 'unpaid';
    $('#rf-status').value = d.status || 'active';
    $('#rf-member').value = d.user_id || '';
    $('#rf-note').value = d.note || '';
    Fugo.hideMsg($('#rt-msg'));
    $('#dlg-rental').showModal();
  }
  $('#rt-add').addEventListener('click', () => openRental(null));
  $('#rt-cancel').addEventListener('click', () => $('#dlg-rental').close());

  $('#form-rental').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = $('#rt-msg');
    const rec = {
      lot_id: Number($('#rf-lot').value),
      space_no: $('#rf-space').value.trim() || null,
      tenant_name: $('#rf-name').value.trim(),
      phone: $('#rf-phone').value.trim(),
      plate: Fugo.normalizePlate($('#rf-plate').value),
      monthly_fee: Number($('#rf-fee').value),
      start_date: $('#rf-start').value,
      end_date: $('#rf-end').value,
      paid_until: $('#rf-paid').value || null,
      payment_status: $('#rf-pay').value,
      status: $('#rf-status').value,
      user_id: $('#rf-member').value || null,
      note: $('#rf-note').value.trim() || null,
    };
    if (!rec.lot_id) return Fugo.showMsg(box, 'err', '請選擇停車場');
    if (!rec.tenant_name || !rec.phone || !rec.plate) return Fugo.showMsg(box, 'err', '租戶姓名、電話、車牌都要填');
    if (!Number.isInteger(rec.monthly_fee) || rec.monthly_fee < 0) return Fugo.showMsg(box, 'err', '月租金請填整數金額');
    if (!rec.start_date || !rec.end_date) return Fugo.showMsg(box, 'err', '請填起租日和到期日');
    if (rec.end_date < rec.start_date) return Fugo.showMsg(box, 'err', '到期日不能早於起租日');
    const btn = e.submitter || e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const q = editingRental ? db().from('fugo_rentals').update(rec).eq('id', editingRental.id) : db().from('fugo_rentals').insert(rec);
    const { error } = await q;
    btn.disabled = false;
    if (error) return Fugo.showMsg(box, 'err', Fugo.errText(error));
    $('#dlg-rental').close();
    Fugo.toast('月租資料已儲存');
    await loadRentals();
    renderStats();
  });

  async function deleteRental(r) {
    if (!confirm(`確定要刪除「${r.tenant_name} ${r.plate}」這筆月租資料嗎？刪除後無法復原。\n（租約結束建議改成「已結束」保留紀錄）`)) return;
    const { error } = await db().from('fugo_rentals').delete().eq('id', r.id);
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    Fugo.toast('已刪除');
    await loadRentals();
    renderStats();
  }

  // ── 月租申請 ──
  function renderApps() {
    const f = $('#ap-filter').value;
    const rows = apps.filter((a) => (f === 'open' ? ['pending', 'contacted'].includes(a.status) : !f || a.status === f));
    const body = $('#ap-body');
    if (!rows.length) return body.replaceChildren(el('tr', null, el('td', { colspan: 9, class: 'empty', text: '沒有申請' })));
    body.replaceChildren(...rows.map((a) => {
      const m = memberById(a.user_id) || {};
      const [sl, sc] = APP_STATUS[a.status] || [a.status, 'b-mute'];
      return el('tr', null,
        el('td', { text: Fugo.fmtDateTime(a.created_at) }),
        el('td', { text: lotName(a.lot_id) }),
        el('td', { text: m.full_name || '—' }),
        el('td', null, m.phone ? el('a', { href: 'tel:' + m.phone, text: m.phone }) : '—'),
        el('td', { text: `${a.car_type} ${a.plate}` }),
        el('td', { text: Fugo.fmtDate(a.start_date) }),
        el('td', { text: a.note || '' }),
        el('td', null, el('span', { class: 'badge ' + sc, text: sl })),
        el('td', null, el('div', { class: 'row-actions' },
          a.status !== 'cancelled' ? el('button', { class: 'btn btn-line btn-sm', type: 'button', text: '處理', onclick: () => openApp(a) }) : null,
          a.status !== 'cancelled' ? el('button', { class: 'btn btn-blue btn-sm', type: 'button', text: '建立月租', onclick: () => appToRental(a) }) : null)));
    }));
  }
  $('#ap-filter').addEventListener('input', renderApps);

  function openApp(a) {
    editingApp = a;
    const m = memberById(a.user_id) || {};
    $('#ap-info').textContent = `${m.full_name || ''} ${m.phone || ''}｜${lotName(a.lot_id)}｜${a.car_type} ${a.plate}`;
    $('#af-status').value = a.status === 'cancelled' ? 'pending' : a.status;
    $('#af-note').value = a.admin_note || '';
    $('#dlg-app').showModal();
  }
  $('#af-cancel').addEventListener('click', () => $('#dlg-app').close());
  $('#form-app').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await db().from('fugo_applications')
      .update({ status: $('#af-status').value, admin_note: $('#af-note').value.trim() || null }).eq('id', editingApp.id);
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    $('#dlg-app').close();
    Fugo.toast('申請已更新');
    await loadApps();
    renderStats();
  });

  function appToRental(a) {
    const m = memberById(a.user_id) || {};
    const start = a.start_date && a.start_date > Fugo.today() ? a.start_date : Fugo.today();
    const end = new Date(start + 'T00:00:00');
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    openRental(null, {
      lot_id: a.lot_id, tenant_name: m.full_name || '', phone: m.phone || '', plate: a.plate,
      start_date: start, end_date: end.toISOString().slice(0, 10), user_id: m.full_name ? a.user_id : '',
      note: a.note || '',
    });
  }

  // ── 會員 ──
  function renderMembers() {
    const q = $('#mb-search').value.trim().toLowerCase();
    const rows = members.filter((m) => !q || [m.full_name, m.phone, m.email].join(' ').toLowerCase().includes(q));
    const body = $('#mb-body');
    if (!rows.length) return body.replaceChildren(el('tr', null, el('td', { colspan: 5, class: 'empty', text: '沒有會員' })));
    body.replaceChildren(...rows.map((m) => el('tr', null,
      el('td', { text: m.full_name || '—' }),
      el('td', null, m.phone ? el('a', { href: 'tel:' + m.phone, text: m.phone }) : '—'),
      el('td', { text: m.email || '—' }),
      el('td', null, el('span', { class: 'badge ' + (m.full_name && m.phone ? 'b-ok' : 'b-warn'), text: m.full_name && m.phone ? '已填完整' : '未填完' })),
      el('td', { text: Fugo.fmtDateTime(m.created_at) }))));
  }
  $('#mb-search').addEventListener('input', renderMembers);

  // ── 停車場 ──
  function renderLots() {
    const body = $('#lt-body');
    if (!lots.length) return body.replaceChildren(el('tr', null, el('td', { colspan: 5, class: 'empty', text: '還沒有停車場' })));
    body.replaceChildren(...lots.map((l) => el('tr', null,
      el('td', { text: l.name }),
      el('td', { text: l.address || '—' }),
      el('td', null, l.map_query ? el('a', { href: Fugo.mapUrl(l.map_query), target: '_blank', rel: 'noopener noreferrer', text: l.map_query }) : '—'),
      el('td', null, el('span', { class: 'badge ' + (l.active ? 'b-ok' : 'b-mute'), text: l.active ? '開放申請' : '暫停' })),
      el('td', null, el('button', { class: 'btn btn-line btn-sm', type: 'button', text: '編輯', onclick: () => openLot(l) })))));
  }
  function openLot(l) {
    editingLot = l || null;
    $('#lt-title').textContent = l ? '編輯停車場' : '新增停車場';
    $('#lf-name').value = l ? l.name : '';
    $('#lf-addr').value = l ? l.address || '' : '';
    $('#lf-map').value = l ? l.map_query || '' : '';
    $('#lf-sort').value = l ? l.sort_order : lots.length + 1;
    $('#lf-active').value = !l || l.active ? '1' : '0';
    $('#dlg-lot').showModal();
  }
  $('#lt-add').addEventListener('click', () => openLot(null));
  $('#lf-cancel').addEventListener('click', () => $('#dlg-lot').close());
  $('#form-lot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rec = {
      name: $('#lf-name').value.trim(),
      address: $('#lf-addr').value.trim() || null,
      map_query: $('#lf-map').value.trim() || null,
      sort_order: parseInt($('#lf-sort').value, 10) || 0,
      active: $('#lf-active').value === '1',
    };
    if (!rec.name) return alert('請填停車場名稱');
    const q = editingLot ? db().from('fugo_lots').update(rec).eq('id', editingLot.id) : db().from('fugo_lots').insert(rec);
    const { error } = await q;
    if (error) return Fugo.showMsg(msg, 'err', Fugo.errText(error));
    $('#dlg-lot').close();
    Fugo.toast('停車場已儲存');
    await loadLots();
    renderRentals();
    renderApps();
  });

  // ── 操作紀錄 ──
  const TABLE_NAMES = { fugo_rentals: '月租資料', fugo_applications: '月租申請', fugo_lots: '停車場', fugo_profiles: '會員資料', fugo_admins: '管理員名單' };
  const ACTIONS = { INSERT: ['新增', 'b-ok'], UPDATE: ['修改', 'b-blue'], DELETE: ['刪除', 'b-bad'] };
  const SKIP = ['updated_at', 'created_at'];
  function auditSummary(a) {
    const o = a.old_data || {}, n = a.new_data || {};
    const d = a.action === 'DELETE' ? o : n;
    const who = d.tenant_name || d.full_name || d.name || d.email || d.plate || '';
    if (a.action !== 'UPDATE') return who;
    const changed = Object.keys(n).filter((k) => !SKIP.includes(k) && JSON.stringify(n[k]) !== JSON.stringify(o[k]));
    return (who ? who + '：' : '') + changed.map((k) => `${k} ${o[k] ?? '—'} → ${n[k] ?? '—'}`).join('；');
  }
  async function loadAudit() {
    const body = $('#au-body');
    const { data, error } = await db().from('fugo_audit_log').select('*').order('at', { ascending: false }).limit(200);
    if (error) return body.replaceChildren(el('tr', null, el('td', { colspan: 5, class: 'empty', text: Fugo.errText(error) })));
    if (!data.length) return body.replaceChildren(el('tr', null, el('td', { colspan: 5, class: 'empty', text: '還沒有紀錄' })));
    body.replaceChildren(...data.map((a) => {
      const [al, ac] = ACTIONS[a.action] || [a.action, 'b-mute'];
      return el('tr', null,
        el('td', { text: Fugo.fmtDateTime(a.at) }),
        el('td', { text: a.actor_email || (a.actor ? '會員' : '系統') }),
        el('td', { text: TABLE_NAMES[a.table_name] || a.table_name }),
        el('td', null, el('span', { class: 'badge ' + ac, text: al })),
        el('td', { text: auditSummary(a) }));
    }));
  }

  // ── CSV 匯出（防止 Excel 公式注入） ──
  function csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function download(name, header, rows) {
    const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('#rt-export').addEventListener('click', () => {
    download(`富格月租資料_${Fugo.today()}.csv`,
      ['停車場', '車位', '租戶', '電話', '車牌', '月租金', '起租日', '到期日', '已繳至', '繳費狀態', '租約狀態', '備註'],
      filteredRentals().map((r) => [lotName(r.lot_id), r.space_no, r.tenant_name, r.phone, r.plate, r.monthly_fee, r.start_date, r.end_date, r.paid_until,
        (PAY[r.payment_status] || [r.payment_status])[0], r.status === 'active' ? '有效中' : '已結束', r.note]));
  });
  $('#mb-export').addEventListener('click', () => {
    download(`富格會員_${Fugo.today()}.csv`, ['姓名', '手機', 'Email', '加入時間'],
      members.map((m) => [m.full_name, m.phone, m.email, Fugo.fmtDateTime(m.created_at)]));
  });

  init();
})();
