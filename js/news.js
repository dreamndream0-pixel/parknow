// 富格停車 — 最新消息（分類切換、點開看內容）
(function () {
  'use strict';
  const { el, $, $$ } = Fugo;
  let NEWS = [];
  const list = $('#news-list');
  const CATS = ['', 'notice', 'guide', 'lottery'];
  const qcat = new URLSearchParams(location.search).get('cat');
  let cat = CATS.includes(qcat) ? qcat : '';

  function item(n) {
    const bodyId = 'nb-' + n.id;
    const head = el('button', { type: 'button', class: 'news-row', 'aria-expanded': 'false', 'aria-controls': bodyId },
      el('span', { class: 'news-date', text: Fugo.newsDate(n.date) }),
      el('span', { class: 'news-main' },
        el('span', { class: 'news-tag ' + n.cat, text: Fugo.NEWS_CAT[n.cat] || '' }),
        el('strong', { text: n.title })),
      Fugo.icon('chev-d', 'news-chev'));
    const body = el('div', { class: 'news-body', id: bodyId, hidden: true },
      n.body.map((p) => el('p', { text: p })),
      el('time', { datetime: n.date, text: String(n.date).replace(/-/g, '/') }));
    head.addEventListener('click', () => toggle(head, body));
    return el('li', { id: n.id, class: 'news-item' }, head, body);
  }

  function toggle(head, body, force) {
    const open = force === undefined ? head.getAttribute('aria-expanded') !== 'true' : force;
    head.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    head.parentElement.classList.toggle('open', open);
  }

  function render() {
    const shown = NEWS.filter((n) => !cat || n.cat === cat);
    list.replaceChildren(...shown.map(item));
    if (!shown.length) list.append(el('li', { class: 'news-none', text: '目前沒有消息' }));
  }

  function setTab(b) {
    cat = b.dataset.cat;
    $$('.tabs3 button').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
  }
  $$('.tabs3 button').forEach((b) => b.addEventListener('click', () => {
    setTab(b);
    render();
    history.replaceState(null, '', cat ? '?cat=' + cat : location.pathname);
  }));
  const startTab = $('.tabs3 button[data-cat="' + cat + '"]');
  if (startTab) setTab(startTab);

  Fugo.loadNews().then((news) => {
    NEWS = news;
    render();
    openFromHash();
  });
  window.addEventListener('hashchange', openFromHash);

  // 從首頁點進來（news.html#id）就直接展開那一則
  function openFromHash() {
    const target = location.hash.slice(1);
    if (!target || !/^[a-z0-9-]+$/.test(target)) return;
    let li = document.getElementById(target);
    if (!li && cat) { setTab($('.tabs3 button[data-cat=""]')); render(); li = document.getElementById(target); }
    if (li) {
      toggle(li.querySelector('.news-row'), li.querySelector('.news-body'), true);
      li.scrollIntoView({ block: 'center' });
    }
  }
})();
