// 富格停車 — 停車場介紹頁（lot.html?id=...）
(function () {
  'use strict';
  const { el, $ } = Fugo;
  const lots = (window.FUGO_DATA && window.FUGO_DATA.lots) || [];
  const id = new URLSearchParams(location.search).get('id');
  const lot = Fugo.lotById(id) || lots[0];
  if (!lot) return;

  document.title = lot.name + '｜富格停車';
  $('#lot-name').textContent = lot.name;
  $('#lot-district').textContent = '台中市' + lot.district;
  $('#lot-map').setAttribute('src', Fugo.mapEmbed(lot.mapQuery));
  $('#lot-go').href = Fugo.mapUrl(lot.mapQuery);

  const row = (icon, label, value) => [
    el('dt', null, Fugo.icon(icon), el('span', { text: label })),
    el('dd', null, value),
  ];
  $('#lot-rows').replaceChildren(
    ...row('pin', '地址', lot.address),
    ...row('clock', '營業時間', lot.hours),
    ...row('park', '停車費率', lot.rate),
    ...row('phone', '客服專線', el('a', { href: 'tel:0800899969', text: '0800-899-969' })));
  $('#lot-tags').replaceChildren(...lot.tags.map((t) => el('span', { class: 'chip', text: t })));
  $('#other-lots').replaceChildren(...lots.filter((l) => l !== lot).map((l) =>
    el('li', null, el('a', { class: 'lot-row', href: 'lot.html?id=' + l.id },
      Fugo.icon('park', 'lot-p'),
      el('span', { class: 'lot-txt' }, el('strong', { text: l.name }), el('small', { text: l.district })),
      Fugo.icon('chev-r', 'lot-chev')))));
})();
