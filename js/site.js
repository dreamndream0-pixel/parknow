// 富格停車 — 首頁
(function () {
  'use strict';
  const { el } = Fugo;

  // 首頁顯示的停車場（不需登入也看得到）
  const LOTS = [
    {
      name: '潭子區公所共享停車場',
      area: '台中市潭子區',
      address: '潭子區公所旁',
      mapQuery: '潭子區公所 停車場',
      tags: ['24 小時', '共享停車', '臨停・月租'],
    },
    {
      name: '大墩文化中心停車場',
      area: '台中市西區',
      address: '台中市西區英才路600號',
      mapQuery: '大墩文化中心 停車場',
      tags: ['24 小時', '臨停・月租'],
    },
  ];

  function renderLots() {
    const box = document.getElementById('lots-list');
    const foot = document.getElementById('footer-lots');
    box.replaceChildren(...LOTS.map((l) => el('article', { class: 'lot' },
      el('div', { class: 'lot-top' },
        el('img', { src: 'assets/logo.png', alt: '' }),
        el('div', null, el('h3', { text: l.name }), el('small', { text: l.area }))),
      el('div', { class: 'lot-body' },
        el('div', { class: 'lot-row' }, '📍 ', el('b', { text: l.address })),
        el('div', { class: 'lot-row' }, '📞 客服 ', el('a', { href: 'tel:0800899969', text: '0800-899-969' })),
        el('div', { class: 'lot-tags' }, l.tags.map((t, i) => el('span', { class: i === 0 ? 'tag orange' : 'tag', text: t }))),
        el('div', { class: 'lot-actions' },
          el('a', { class: 'btn btn-blue', href: Fugo.mapUrl(l.mapQuery), target: '_blank', rel: 'noopener noreferrer', text: 'Google 地圖導航' }),
          el('a', { class: 'btn btn-line', href: 'login.html?next=apply', text: '申請月租' }))))));
    foot.replaceChildren(...LOTS.map((l) => el('li', null,
      el('a', { href: Fugo.mapUrl(l.mapQuery), target: '_blank', rel: 'noopener noreferrer', text: l.name }))));
  }

  async function updateMemberLink() {
    const s = await Fugo.getSession().catch(() => null);
    if (s) {
      const a = document.getElementById('member-link');
      a.textContent = '會員中心';
      a.href = 'member.html';
    }
  }

  renderLots();
  updateMemberLink();
})();
