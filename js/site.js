// 富格停車 — 首頁：找停車場（搜尋、臨停／月租、地圖）、最新消息預覽
(function () {
  'use strict';
  const { el, $ } = Fugo;
  const DATA = window.FUGO_DATA || { lots: [], news: [] };
  const LOTS = DATA.lots;

  let mode = 'temp';
  let current = LOTS[0];

  const list = $('#lot-list');
  const frame = $('#map-frame');
  const card = $('#map-card');

  function rows() {
    const q = $('#lot-search').value.trim().replace(/\s+/g, '');
    const shown = LOTS.filter((l) => !q || (l.name + l.district + l.address).replace(/\s+/g, '').includes(q));
    list.replaceChildren(...shown.map((lot) =>
      el('li', null,
        el('button', {
          type: 'button',
          class: 'lot-row' + (lot === current ? ' on' : ''),
          'aria-pressed': String(lot === current),
          onclick() { select(lot, true); },
        },
          Fugo.icon('park', 'lot-p'),
          el('span', { class: 'lot-txt' },
            el('strong', { text: lot.name }),
            el('small', { text: lot.district + (mode === 'monthly' ? '・可申請月租' : '・' + lot.hours) })),
          Fugo.icon('chev-r', 'lot-chev')))));
    $('#lot-empty').classList.toggle('hidden', shown.length > 0);
  }

  function select(lot, fromUser) {
    current = lot;
    const src = Fugo.mapEmbed(lot.mapQuery);
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    $('#mc-name').textContent = lot.name;
    $('#mc-district').textContent = '台中市' + lot.district;
    const go = $('#mc-go');
    if (mode === 'monthly') {
      go.href = 'login.html?next=apply';
      go.removeAttribute('target');
      $('#mc-go-text').textContent = '申請月租';
    } else {
      go.href = Fugo.mapUrl(lot.mapQuery);
      go.setAttribute('target', '_blank');
      $('#mc-go-text').textContent = '導航';
    }
    $('#mc-more').href = 'lot.html?id=' + lot.id;
    card.classList.remove('pop');
    void card.offsetWidth; // 重新播放彈出動畫
    card.classList.add('pop');
    rows();
    // 手機版：點了清單就把地圖捲進畫面
    if (fromUser && window.matchMedia('(max-width: 860px)').matches) {
      const top = $('.find-map').getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  $('#lot-search').addEventListener('input', rows);
  Fugo.$$('.seg button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    Fugo.$$('.seg button').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    $('#find-hint').textContent = mode === 'monthly'
      ? '所有據點都可申請月租，選好停車場後按「申請月租」。'
      : '點選停車場，地圖會移到該據點。';
    select(current, false);
  }));

  // 最新消息預覽（最新 3 則）
  Fugo.newsRow = function (n, href) {
    return el('li', null,
      el('a', { class: 'news-row', href },
        el('span', { class: 'news-date', text: Fugo.newsDate(n.date) }),
        el('span', { class: 'news-main' },
          el('span', { class: 'news-tag ' + n.cat, text: Fugo.NEWS_CAT[n.cat] || '' }),
          el('strong', { text: n.title })),
        Fugo.icon('chev-r', 'news-chev')));
  };
  $('#news-preview').replaceChildren(...DATA.news.slice(0, 3).map((n) => Fugo.newsRow(n, 'news.html#' + n.id)));

  $('#footer-lots').replaceChildren(...LOTS.map((l) => el('li', null, el('a', { href: 'lot.html?id=' + l.id, text: l.name }))));

  if (current) select(current, false);
})();
