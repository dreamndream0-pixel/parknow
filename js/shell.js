// 富格停車 — 前台共用外框：圖示、側邊服務選單、手機底部列、客服面板、捲動動畫
(function () {
  'use strict';
  const { el } = Fugo;
  const NS = 'http://www.w3.org/2000/svg';

  const ICONS = {
    pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
    headset: 'M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1zM17 19c0 1.4-1.8 2-4 2',
    megaphone: 'M3 10v4h3l8 4.5v-13L6 10zM17.5 9a4 4 0 0 1 0 6M6 14l1.2 5h2.3',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.01',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
    park: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM10 17V7h3a3 3 0 0 1 0 6h-3',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
    'chev-r': 'M9 6l6 6-6 6',
    'chev-d': 'M6 9l6 6 6-6',
    'chev-l': 'M15 6l-6 6 6 6',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    nav: 'M21 3L3 10.5l7.5 2.5L13 21z',
    car: 'M3 13l2.2-6h13.6L21 13v5H3zM3 13h18M7 15.5h.01M17 15.5h.01M5 18v2M19 18v2',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    close: 'M6 6l12 12M18 6L6 18',
    'arrow-r': 'M4 12h16M14 6l6 6-6 6',
    chat: 'M12 4c5 0 9 3 9 7s-4 7-9 7l-4 3v-3.5C5 16 3 13.8 3 11c0-4 4-7 9-7z',
    building: 'M4 21V5l8-2v18M12 8l8 2v11M3 21h18M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2',
    tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
    list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
    locate: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  };

  // 產生線條圖示（用 DOM 建立，不使用 innerHTML）
  Fugo.icon = function (name, cls) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', ICONS[name] || '');
    svg.append(path);
    return svg;
  };

  // 頁面上 <i data-icon="pin"></i> 的位置換成圖示
  Fugo.$$('i[data-icon]').forEach((i) => i.replaceWith(Fugo.icon(i.dataset.icon, i.className)));

  const page = document.body.dataset.page || '';
  const fmtDot = (d) => d.slice(5).replace('-', '.');
  Fugo.newsDate = fmtDot;
  Fugo.NEWS_CAT = { notice: '官方公告', guide: '服務指南' };

  // ── 側邊「服務選單」 ──
  function group(icon, label, items, open) {
    const id = 'dg-' + icon;
    const btn = el('button', { type: 'button', class: 'dr-row', 'aria-expanded': String(open), 'aria-controls': id },
      Fugo.icon(icon), el('span', { text: label }), Fugo.icon('chev-d', 'dr-chev'));
    const list = el('ul', { class: 'dr-sub', id }, items.map(([t, href]) => el('li', null, el('a', { href, text: t }))));
    if (!open) list.hidden = true;
    btn.addEventListener('click', () => {
      const o = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(o));
      list.hidden = !o;
    });
    return el('div', { class: 'dr-group' }, btn, list);
  }
  function link(icon, label, href) {
    return el('a', { class: 'dr-row', href }, Fugo.icon(icon), el('span', { text: label }), Fugo.icon('chev-r', 'dr-chev'));
  }

  const memberLabel = el('span', { text: '會員中心' });
  const drawer = el('aside', { class: 'drawer', id: 'drawer', 'aria-label': '服務選單', 'aria-hidden': 'true' },
    el('div', { class: 'dr-head' },
      el('a', { class: 'brand', href: 'index.html' },
        el('img', { src: 'assets/logo.png', alt: '' }),
        el('span', { class: 'brand-text' },
          el('span', { class: 'brand-zh' }, '富格', el('em', { text: '停車' })),
          el('span', { class: 'brand-en', text: 'FUGO PARKING' }))),
      el('button', { type: 'button', class: 'dr-close', 'aria-label': '關閉選單' }, Fugo.icon('close'))),
    el('div', { class: 'dr-body' },
      el('h2', { class: 'bar-title', text: '服務選單' }),
      group('park', '停車據點', [['地圖找車位', 'index.html#find'], ['據點列表', 'index.html#list']], true),
      group('calendar', '月租服務', [['月租申請', 'login.html?next=apply'], ['申請進度', 'member.html'], ['申請流程', 'index.html#monthly']], true),
      link('megaphone', '最新消息', 'news.html'),
      link('info', '關於富格', 'index.html#about'),
      el('a', { class: 'dr-row', href: 'member.html', id: 'dr-member' }, Fugo.icon('user'), memberLabel, Fugo.icon('chev-r', 'dr-chev'))),
    el('a', { class: 'dr-call', href: 'tel:0800899969' },
      Fugo.icon('phone'), el('span', null, el('small', { text: '聯絡客服' }), el('strong', { text: '0800-899-969' }))));
  const scrim = el('div', { class: 'scrim', hidden: true });
  document.body.append(scrim, drawer);

  const menuBtn = document.getElementById('menu-open');
  let lastFocus = null;
  function openDrawer() {
    lastFocus = document.activeElement;
    scrim.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lock');
    requestAnimationFrame(() => { drawer.classList.add('open'); scrim.classList.add('on'); });
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    drawer.querySelector('.dr-close').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    scrim.classList.remove('on');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lock');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!scrim.classList.contains('on')) scrim.hidden = true; }, 260);
    if (lastFocus) lastFocus.focus();
  }
  if (menuBtn) menuBtn.addEventListener('click', openDrawer);
  drawer.querySelector('.dr-close').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', () => { closeDrawer(); closeSheet(); });
  drawer.addEventListener('click', (e) => { if (e.target.closest('a')) closeDrawer(); });

  // ── 客服面板 ──
  const lineUrl = Fugo.cfg.LINE_URL;
  const sheet = el('div', { class: 'sheet', id: 'help-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': '聯絡客服', 'aria-hidden': 'true' },
    el('span', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    el('h2', { class: 'bar-title', text: '聯絡客服' }),
    el('a', { class: 'help-row', href: 'tel:0800899969' }, Fugo.icon('phone'),
      el('span', null, el('strong', { text: '撥打客服專線' }), el('small', { text: '0800-899-969・免付費' })), Fugo.icon('chev-r', 'dr-chev')),
    lineUrl ? el('a', { class: 'help-row', href: lineUrl, target: '_blank', rel: 'noopener noreferrer' }, el('img', { src: 'assets/line-icon.png', alt: '', class: 'help-line' }),
      el('span', null, el('strong', { text: 'LINE 線上客服' }), el('small', { text: '@980gulhj' })), Fugo.icon('chev-r', 'dr-chev')) : null,
    el('div', { class: 'help-row static' }, Fugo.icon('building'),
      el('span', null, el('strong', { text: '總公司' }), el('small', { text: '台中市北區台灣大道二段360號18樓之3' }))),
    el('button', { type: 'button', class: 'btn btn-line full sheet-close', text: '關閉' }));
  document.body.append(sheet);
  function openSheet() {
    scrim.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => { sheet.classList.add('open'); scrim.classList.add('on'); });
    sheet.querySelector('.help-row').focus();
  }
  function closeSheet() {
    if (!sheet.classList.contains('open')) return;
    sheet.classList.remove('open');
    scrim.classList.remove('on');
    sheet.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!scrim.classList.contains('on')) scrim.hidden = true; }, 260);
  }
  sheet.querySelector('.sheet-close').addEventListener('click', closeSheet);
  Fugo.openHelp = openSheet;
  Fugo.$$('[data-help]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openSheet(); }));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drawer.classList.contains('open')) closeDrawer();
    closeSheet();
  });

  // ── 手機底部列 ──
  const tab = (key, icon, label, href) => el('a', { class: 'tab' + (page === key ? ' on' : ''), href, 'aria-current': page === key ? 'page' : null },
    Fugo.icon(icon), el('span', { text: label }));
  const helpTab = el('button', { type: 'button', class: 'tab' }, Fugo.icon('headset'), el('span', { text: '客服' }));
  helpTab.addEventListener('click', openSheet);
  document.body.append(el('nav', { class: 'tabbar', 'aria-label': '快速選單' },
    tab('find', 'pin', '找車位', page === 'find' ? '#find' : 'index.html#find'),
    tab('monthly', 'calendar', '月租', 'login.html?next=apply'),
    tab('news', 'megaphone', '消息', 'news.html'),
    helpTab));
  document.body.classList.add('has-tabbar');

  // ── 已登入就把「會員登入」改成「會員中心」 ──
  Fugo.getSession().then((s) => {
    if (!s) return;
    Fugo.$$('[data-member-link]').forEach((a) => { a.textContent = '會員中心'; a.href = 'member.html'; });
  }).catch(() => {});

  // ── 捲動進場動畫 ──
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = Fugo.$$('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach((n) => n.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((n) => io.observe(n));
  }

  // 頂端列捲動後加陰影
  const head = document.querySelector('.ph');
  if (head) {
    const onScroll = () => head.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── 停車場資料：以後台資料庫為準，連不上才用 js/data.js 備用資料 ──
  const norm = (l) => ({
    id: l.id,
    name: l.name,
    city: l.city || '台中市',
    district: l.district || '',
    address: l.address || '',
    mapQuery: l.map_query || (l.lat != null ? l.lat + ',' + l.lng : l.name),
    lat: l.lat == null ? null : Number(l.lat),
    lng: l.lng == null ? null : Number(l.lng),
    hours: l.hours || '24 小時',
    rate: l.rate || '依現場公告',
    temp: l.allow_temp !== false,
    monthly: l.allow_monthly !== false,
    car: l.allow_car !== false,
    moto: Boolean(l.allow_moto),
    features: String(l.features || '').split(/[、,，\s]+/).filter(Boolean),
  });
  let lotsPromise = null;
  Fugo.loadLots = function () {
    if (lotsPromise) return lotsPromise;
    const fallback = () => ((window.FUGO_DATA && window.FUGO_DATA.lots) || []).map(norm);
    lotsPromise = (async () => {
      if (!Fugo.ready) return fallback();
      try {
        const { data, error } = await Fugo.client.from('fugo_lots').select('*').eq('active', true).order('sort_order').order('id');
        if (error || !data || !data.length) return fallback();
        return data.map(norm);
      } catch (e) {
        return fallback();
      }
    })();
    return lotsPromise;
  };
  Fugo.lotTags = (l) => [l.hours, l.temp && '臨停', l.monthly && '月租', l.car && '汽車', l.moto && '機車', ...l.features].filter(Boolean);
  Fugo.navUrl = (l) => (l.lat != null
    ? 'https://www.google.com/maps/dir/?api=1&destination=' + l.lat + ',' + l.lng
    : Fugo.mapUrl(l.mapQuery));
  Fugo.mapEmbed = (q) => 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&hl=zh-TW&z=16&output=embed';
})();
