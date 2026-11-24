// 富格停車 — 最新消息（分類切換、點開看內容）
(function () {
  'use strict';
  const { el, $, $$ } = Fugo;
  const NEWS = (window.FUGO_DATA && window.FUGO_DATA.news) || [];
  const list = $('#news-list');
  let cat = '';

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
      el('time', { datetime: n.date, text: n.date.replace(/-/g, '/') }));
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

  $$('.tabs3 button').forEach((b) => b.addEventListener('click', () => {
    cat = b.dataset.cat;
    $$('.tabs3 button').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    render();
  }));

  render();

  // 從首頁點進來（news.html#id）就直接展開那一則
  const target = location.hash.slice(1);
  if (target && /^[a-z0-9-]+$/.test(target)) {
    const li = document.getElementById(target);
    if (li) {
      toggle(li.querySelector('.news-row'), li.querySelector('.news-body'), true);
      li.scrollIntoView({ block: 'center' });
    }
  }
})();
