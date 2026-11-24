// 富格停車 — 停車場介紹頁（lot.html?id=...）
(function () {
  'use strict';
  const { el, $ } = Fugo;
  const id = new URLSearchParams(location.search).get('id');

  Fugo.loadLots().then((lots) => {
    const lot = lots.find((l) => String(l.id) === id) || lots[0];
    if (!lot) return;

    document.title = lot.name + '｜富格停車';
    $('#lot-name').textContent = lot.name;
    $('#lot-district').textContent = lot.city + lot.district;
    const q = lot.lat != null ? lot.lat + ',' + lot.lng : lot.mapQuery;
    $('#lot-map').setAttribute('src', Fugo.mapEmbed(q));
    $('#lot-go').href = Fugo.navUrl(lot);
    if (!lot.monthly) $('#lot-apply').classList.add('hidden');

    const row = (icon, label, value) => [
      el('dt', null, Fugo.icon(icon), el('span', { text: label })),
      el('dd', null, value),
    ];
    $('#lot-rows').replaceChildren(
      ...row('pin', '地址', lot.address || lot.city + lot.district),
      ...row('clock', '營業時間', lot.hours),
      ...row('park', '停車費率', lot.rate),
      ...row('car', '車種', [lot.car && '汽車', lot.moto && '機車'].filter(Boolean).join('・')),
      ...row('phone', '客服專線', el('a', { href: 'tel:0800899969', text: '0800-899-969' })));
    $('#lot-tags').replaceChildren(...Fugo.lotTags(lot).map((t) => el('span', { class: 'chip', text: t })));
    $('#other-lots').replaceChildren(...lots.filter((l) => l !== lot).map((l) =>
      el('li', null, el('a', { class: 'lot-row', href: 'lot.html?id=' + l.id },
        Fugo.icon('park', 'lot-p'),
        el('span', { class: 'lot-txt' }, el('strong', { text: l.name }), el('small', { text: l.city + l.district })),
        Fugo.icon('chev-r', 'lot-chev')))));
    if (lots.length < 2) $('.other-lots').classList.add('hidden');
  });
})();
