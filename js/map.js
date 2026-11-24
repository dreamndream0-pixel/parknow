// 富格停車 — 首頁地圖：有 Google Maps 金鑰就用 Google 地圖，沒有或載入失敗就用 Leaflet（CARTO 底圖）
// 對外介面：Fugo.createMap(el).then((m) => m.markers(lots, current, onClick) / m.fit(lots) / m.focus(lot))
(function () {
  'use strict';
  const CENTER = { lat: 24.17, lng: 120.68 };

  // ── Leaflet 版本 ──
  function leafletMap(el) {
    if (!window.L) return null;
    el.replaceChildren();
    const map = L.map(el, { zoomControl: false, scrollWheelZoom: false, tap: true }).setView([CENTER.lat, CENTER.lng], 12);
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap © CARTO',
    }).addTo(map);
    L.control.zoom({ position: 'topright', zoomInTitle: '放大', zoomOutTitle: '縮小' }).addTo(map);
    // 在地圖上按一下才啟用滾輪縮放，避免捲動頁面時被地圖卡住
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());
    let list = [];
    return {
      kind: 'leaflet',
      markers(lots, current, onClick, pinEl) {
        list.forEach((m) => m.remove());
        list = lots.map((lot) => {
          const m = L.marker([lot.lat, lot.lng], {
            icon: L.divIcon({ className: 'pin-wrap', html: pinEl(lot), iconSize: [44, 52], iconAnchor: [22, 50] }),
            title: lot.name, keyboard: true, zIndexOffset: lot === current ? 1000 : 0,
          }).addTo(map);
          m.on('click', () => onClick(lot));
          return m;
        });
      },
      fit(lots) {
        if (!lots.length) return;
        if (lots.length === 1) map.setView([lots[0].lat, lots[0].lng], 15, { animate: true });
        else map.fitBounds(L.latLngBounds(lots.map((l) => [l.lat, l.lng])), { padding: [70, 70], maxZoom: 15, animate: true });
      },
      focus(lot) { map.setView([lot.lat, lot.lng], Math.max(map.getZoom(), 15), { animate: true }); },
    };
  }

  // ── Google Maps 版本 ──
  let gPromise = null;
  function loadGoogle(key) {
    if (gPromise) return gPromise;
    gPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 12000);
      window.__fugoGmapsReady = () => { clearTimeout(timer); resolve(window.google.maps); };
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key)
        + '&v=weekly&loading=async&language=zh-TW&region=TW&callback=__fugoGmapsReady';
      s.async = true;
      s.onerror = () => { clearTimeout(timer); reject(new Error('load')); };
      document.head.appendChild(s);
    });
    return gPromise;
  }

  function googleMap(el, gm) {
    const map = new gm.Map(el, {
      center: CENTER, zoom: 12,
      disableDefaultUI: true, zoomControl: true, fullscreenControl: false, streetViewControl: false, mapTypeControl: false,
      zoomControlOptions: { position: gm.ControlPosition.RIGHT_CENTER },
      gestureHandling: 'cooperative', // 手機兩指移動、電腦按 Ctrl 滾輪縮放，不會卡住頁面捲動
      clickableIcons: false,
      styles: [{ featureType: 'poi.business', stylers: [{ visibility: 'off' }] }],
    });

    // 自訂 HTML 圖釘（沿用網站的橘色 P 圖釘樣式）
    class Pin extends gm.OverlayView {
      constructor(lot, node, onClick, top) {
        super();
        this.lot = lot;
        this.node = el.ownerDocument.createElement('div');
        this.node.className = 'pin-wrap gpin';
        this.node.style.zIndex = top ? '10' : '1';
        this.node.title = lot.name;
        this.node.setAttribute('role', 'button');
        this.node.setAttribute('tabindex', '0');
        this.node.setAttribute('aria-label', lot.name);
        this.node.appendChild(node);
        const go = (e) => { e.stopPropagation(); onClick(lot); };
        this.node.addEventListener('click', go);
        this.node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
        gm.OverlayView.preventMapHitsAndGesturesFrom(this.node);
      }
      onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.node); }
      draw() {
        const p = this.getProjection().fromLatLngToDivPixel(new gm.LatLng(this.lot.lat, this.lot.lng));
        if (!p) return;
        this.node.style.left = (p.x - 22) + 'px';
        this.node.style.top = (p.y - 50) + 'px';
      }
      onRemove() { this.node.remove(); }
    }

    let list = [];
    return {
      kind: 'google',
      markers(lots, current, onClick, pinEl) {
        list.forEach((m) => m.setMap(null));
        list = lots.map((lot) => {
          const m = new Pin(lot, pinEl(lot), onClick, lot === current);
          m.setMap(map);
          return m;
        });
      },
      fit(lots) {
        if (!lots.length) return;
        if (lots.length === 1) { map.panTo({ lat: lots[0].lat, lng: lots[0].lng }); map.setZoom(15); return; }
        const b = new gm.LatLngBounds();
        lots.forEach((l) => b.extend({ lat: l.lat, lng: l.lng }));
        map.fitBounds(b, 70);
        gm.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > 15) map.setZoom(15); });
      },
      focus(lot) {
        map.panTo({ lat: lot.lat, lng: lot.lng });
        if (map.getZoom() < 15) map.setZoom(15);
      },
    };
  }

  Fugo.createMap = function (el) {
    const key = ((window.FUGO_CONFIG || {}).GOOGLE_MAPS_KEY || '').trim();
    if (!key) return Promise.resolve(leafletMap(el));
    return loadGoogle(key).then((gm) => {
      const m = googleMap(el, gm);
      // 金鑰錯誤或未開通時，Google 會呼叫 gm_authFailure；改用備用地圖
      window.gm_authFailure = () => { if (m.onFail) m.onFail(); };
      return m;
    }).catch(() => leafletMap(el));
  };
  Fugo.fallbackMap = leafletMap;
})();
