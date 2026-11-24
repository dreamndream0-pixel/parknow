// 富格停車 — 首頁：最新消息、找停車場地圖（臨停／月租、汽車／機車、地區搜尋、卡片內導航與列表）
(function () {
  'use strict';
  const { el, $, $$ } = Fugo;
  const DATA = window.FUGO_DATA || { news: [] };

  // ── 最新消息（精簡 3 則） ──
  $('#news-preview').replaceChildren(...DATA.news.slice(0, 3).map((n) =>
    el('li', null, el('a', { href: 'news.html#' + n.id },
      el('span', { class: 'nm-date', text: Fugo.newsDate(n.date) }),
      el('span', { class: 'news-tag ' + n.cat, text: Fugo.NEWS_CAT[n.cat] || '' }),
      el('span', { class: 'nm-title', text: n.title }),
      Fugo.icon('chev-r', 'nm-chev')))));

  // ── 地圖 ──
  const state = { use: 'temp', veh: 'car', city: '', dist: '' };
  let lots = [];
  let shown = [];
  let current = null;
  let map = null;

  function pinEl(lot) {
    return el('div', { class: 'pin' + (lot === current ? ' on' : ''), title: lot.name },
      el('span', { class: 'pin-p', text: 'P' }),
      state.use === 'monthly' ? el('span', { class: 'pin-sub', text: '租' }) : null);
  }

  function drawMarkers() {
    if (map) map.markers(shown, current, (lot) => select(lot, true), pinEl);
  }

  function fit() {
    if (map) map.fit(shown);
  }

  const mapReady = Fugo.createMap($('#map')).then((m) => {
    map = m;
    if (map) map.onFail = () => { map = Fugo.fallbackMap($('#map')); drawMarkers(); fit(); };
    drawMarkers();
    fit();
  });

  const areaText = () => (state.city || '全部城市') + (state.dist ? '・' + state.dist : state.city ? '・全部地區' : '');

  function card() {
    $('#lc-area').replaceChildren(Fugo.icon('pin'), el('span', { text: areaText() }));
    $('#lc-n').textContent = shown.length;
    $('#find-count').textContent = shown.length ? '共 ' + shown.length + ' 個停車場' : '';
    const main = $('#lc-main');
    if (!current) {
      main.replaceChildren(el('p', { class: 'lc-empty', text: '這個條件目前沒有停車場，換個地區或切換臨停／月租、汽車／機車看看。' }));
      return;
    }
    const lot = current;
    main.replaceChildren(
      el('div', { class: 'lc-title' },
        el('h3', { text: lot.name }),
        el('span', { text: lot.city + lot.district })),
      lot.address ? el('p', { class: 'lc-addr', text: lot.address }) : null,
      el('div', { class: 'lc-tags' }, Fugo.lotTags(lot).map((t) => el('span', { class: 'chip', text: t }))),
      el('div', { class: 'lc-actions' },
        el('a', { class: 'lc-go', href: Fugo.navUrl(lot), target: '_blank', rel: 'noopener noreferrer' }, Fugo.icon('nav'), el('span', { text: '導航' })),
        state.use === 'monthly'
          ? el('a', { class: 'lc-apply', href: 'login.html?next=apply' }, Fugo.icon('calendar'), el('span', { text: '申請月租' }))
          : null,
        el('a', { class: 'lc-more', href: 'lot.html?id=' + lot.id }, el('span', { text: '據點介紹' }), Fugo.icon('chev-r'))));
    $('#lc-list').replaceChildren(...shown.map((l) =>
      el('li', null, el('button', {
        type: 'button',
        class: 'lot-row' + (l === current ? ' on' : ''),
        onclick() { select(l, true); toggleList(false); },
      },
        Fugo.icon('park', 'lot-p'),
        el('span', { class: 'lot-txt' }, el('strong', { text: l.name }), el('small', { text: l.city + l.district + '・' + l.hours })),
        Fugo.icon('chev-r', 'lot-chev')))));
  }

  function select(lot, pan) {
    current = lot;
    drawMarkers();
    card();
    if (pan && map && lot) map.focus(lot);
  }

  function apply(refit) {
    shown = lots.filter((l) => l.lat != null && l.lng != null
      && (state.use === 'temp' ? l.temp : l.monthly)
      && (state.veh === 'car' ? l.car : l.moto)
      && (!state.city || l.city === state.city)
      && (!state.dist || l.district === state.dist));
    if (!shown.includes(current)) current = shown[0] || null;
    drawMarkers();
    card();
    if (refit) fit();
  }

  // 臨停／月租、汽車／機車
  $$('.pill button').forEach((b) => b.addEventListener('click', () => {
    state[b.dataset.f] = b.dataset.v;
    $$('.pill button[data-f="' + b.dataset.f + '"]').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    apply(true);
  }));

  // 列表（在卡片內展開）
  function toggleList(force) {
    const btn = $('#lc-list-btn');
    const open = force === undefined ? btn.getAttribute('aria-expanded') !== 'true' : force;
    btn.setAttribute('aria-expanded', String(open));
    $('#lc-list').hidden = !open;
    $('#lot-card').classList.toggle('listing', open);
  }
  $('#lc-list-btn').addEventListener('click', () => toggleList());

  // 放大鏡：選城市／行政區（只列出有停車場的地區）
  const pop = $('#area-pop');
  const openBtn = $('#area-open');
  function chip(text, on, onclick) {
    return el('button', { type: 'button', class: 'achip' + (on ? ' on' : ''), 'aria-pressed': String(on), text, onclick });
  }
  function renderArea() {
    const withPos = lots.filter((l) => l.lat != null);
    const cities = [...new Set(withPos.map((l) => l.city))];
    $('#city-chips').replaceChildren(
      chip('全部', !state.city, () => { state.city = ''; state.dist = ''; renderArea(); apply(true); }),
      ...cities.map((c) => chip(c, state.city === c, () => { state.city = c; state.dist = ''; renderArea(); apply(true); })));
    const dists = [...new Set(withPos.filter((l) => !state.city || l.city === state.city).map((l) => l.district).filter(Boolean))];
    $('#dist-chips').replaceChildren(
      chip('全部地區', !state.dist, () => { state.dist = ''; renderArea(); apply(true); closePop(); }),
      ...dists.map((d) => chip(d, state.dist === d, () => { state.dist = d; renderArea(); apply(true); closePop(); })));
  }
  function openPop() {
    renderArea();
    pop.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => pop.classList.add('open'));
    const first = pop.querySelector('.achip.on') || pop.querySelector('button');
    if (first) first.focus();
  }
  function closePop() {
    pop.classList.remove('open');
    openBtn.setAttribute('aria-expanded', 'false');
    pop.hidden = true;
  }
  openBtn.addEventListener('click', () => (pop.hidden ? openPop() : closePop()));
  $('#area-close').addEventListener('click', () => { closePop(); openBtn.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { closePop(); openBtn.focus(); } });
  document.addEventListener('click', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !openBtn.contains(e.target)) closePop();
  });

  // 載入停車場（後台資料）
  Fugo.loadLots().then((data) => {
    lots = data;
    apply(true);
    $('#footer-lots').replaceChildren(...lots.map((l) => el('li', null, el('a', { href: 'lot.html?id=' + l.id, text: l.name }))));
    openListFromHash();
  });
  function openListFromHash() {
    if (location.hash !== '#list' || !lots.length) return;
    toggleList(true);
    $('#find').scrollIntoView({ behavior: 'smooth' });
  }
  window.addEventListener('hashchange', openListFromHash);
})();
