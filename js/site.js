// 富格停車 — 首頁
(function () {
  'use strict';
  const { el } = Fugo;

  const LOTS = [
    {
      name: '潭子區公所共享停車場',
      district: '潭子區',
      address: '潭子區公所旁',
      mapQuery: '潭子區公所 停車場',
      tags: ['24 小時', '共享停車', '臨停・月租'],
    },
    {
      name: '大墩文化中心停車場',
      district: '西區',
      address: '台中市西區英才路600號',
      mapQuery: '大墩文化中心 停車場',
      tags: ['24 小時', '臨停・月租'],
    },
  ];

  const filters = document.getElementById('lot-filters');
  const results = document.getElementById('lot-results');

  function mapLink(lot, attrs) {
    return el('a', {
      href: Fugo.mapUrl(lot.mapQuery),
      target: '_blank',
      rel: 'noopener noreferrer',
      ...attrs,
    });
  }

  function lotCard(lot) {
    return el('article', { class: 'lot', 'data-district': lot.district },
      el('div', { class: 'lot-top' },
        el('span', { class: 'lot-symbol', 'aria-hidden': 'true', text: 'P' }),
        el('div', null, el('small', { text: '台中市' + lot.district }), el('h3', { text: lot.name }))),
      el('div', { class: 'lot-body' },
        el('p', { class: 'lot-row', text: lot.address }),
        el('div', { class: 'lot-tags' }, lot.tags.map((tag, index) =>
          el('span', { class: index === 0 ? 'tag orange' : 'tag', text: tag }))),
        el('div', { class: 'lot-actions' },
          mapLink(lot, { class: 'btn btn-blue', text: 'Google 地圖導航' }),
          el('a', { class: 'btn btn-line', href: 'login.html?next=apply', text: '申請月租' }))));
  }

  function renderLots() {
    const cards = LOTS.map(lotCard);
    document.getElementById('lots-list').replaceChildren(...cards);
    document.getElementById('footer-lots').replaceChildren(...LOTS.map((lot) =>
      el('li', null, mapLink(lot, { text: lot.name }))));

    const districts = [...new Set(LOTS.map((lot) => lot.district))];
    filters.replaceChildren(...['', ...districts].map((district) =>
      el('button', {
        type: 'button',
        text: district || '全部',
        'aria-pressed': String(!district),
        onclick(event) {
          filters.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
          event.currentTarget.setAttribute('aria-pressed', 'true');

          let visible = 0;
          cards.forEach((card) => {
            card.hidden = Boolean(district && card.dataset.district !== district);
            if (!card.hidden) visible += 1;
          });
          results.textContent = (district || '全部地區') + '有 ' + visible + ' 個停車場';
        },
      })));
  }

  function setupNavigation() {
    const menu = document.getElementById('menu-btn');
    const nav = document.getElementById('nav');

    function closeMenu() {
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
    }

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        menu.focus();
      }
    });
    window.matchMedia('(max-width: 860px)').addEventListener('change', closeMenu);
  }

  async function updateMemberLink() {
    const session = await Fugo.getSession().catch(() => null);
    if (session) {
      const link = document.getElementById('member-link');
      link.textContent = '會員中心';
      link.href = 'member.html';
    }
  }

  renderLots();
  setupNavigation();
  updateMemberLink();
})();
