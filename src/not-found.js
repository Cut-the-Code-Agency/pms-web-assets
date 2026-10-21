// Not Found (404-pagina): het vizier zoekt over de kaart.
// De opbouw bij laden (rasterlijnen, labels, vizier, coördinaten, teksten) is IX3 "Not Found | Inladen";
// dit script doet wat IX3 niet kan:
//   1. Zoeken: het vizier schuift langs een paar echte plekken die in het vrije deel van de kaart vallen;
//      per plek knippert het kader en verschijnt kort "No match" (de tekst staat in Webflow, dus vertaalbaar).
//   2. Daarna rustig zoeken: langzaam naar willekeurige punten, met langere pauzes, zonder melding.
//   3. Coördinaten rechtsonder (mobiel rechtsboven) tellen tijdens het schuiven mee: ze worden uitgerekend
//      uit de plek van het vizier op de kaart (kalibratie stock-kaart, zie decisions/components/kaart-leadmagnet.md).
// Pauzeert buiten beeld en in een verborgen tab. prefers-reduced-motion of geen GSAP: het vizier staat stil
// op één plek, met "No match" en de coördinaten van die plek.
//
// Webflow-markup (component Not Found): .not-found_wrap › .not-found_frame › .not-found_visual
// (img .not-found_img, .not-found_target met .not-found_target-box en p.not-found_status, p.not-found_coords)
// en .not-found_content (tekst en knoppen; daar zoekt het vizier niet).
// Gebruikt de GSAP (en CustomEase) die Webflow zelf laadt; laadt niets zelf.

(() => {
  // Stock-kaart (equirectangular, 1895 × 872): linkerrand −174,9°, bovenrand 97,15° N, 5,2 px per graad.
  const MAP_W = 1895;
  const MAP_H = 872;
  const MAP_LEFT = -174.9;
  const MAP_TOP = 97.15;
  const PX_PER_DEG = 5.2;

  // [breedte, lengte]: steden en een paar plekken op zee. Alleen wat in het vrije deel van de kaart valt doet mee.
  const SPOTS = [
    [64.15, -21.94], // Reykjavík
    [61.22, -149.9], // Anchorage
    [49.28, -123.12], // Vancouver
    [19.43, -99.13], // Mexico-Stad
    [-12.05, -77.04], // Lima
    [-23.55, -46.63], // São Paulo
    [-34.6, -58.38], // Buenos Aires
    [14.72, -17.47], // Dakar
    [6.52, 3.38], // Lagos
    [-33.92, 18.42], // Kaapstad
    [-1.29, 36.82], // Nairobi
    [30.04, 31.24], // Caïro
    [41.01, 28.98], // Istanbul
    [55.76, 37.62], // Moskou
    [35.69, 51.39], // Teheran
    [19.08, 72.88], // Mumbai
    [43.24, 76.95], // Almaty
    [55.01, 82.93], // Novosibirsk
    [47.89, 106.9], // Ulaanbaatar
    [39.9, 116.4], // Peking
    [13.76, 100.5], // Bangkok
    [-6.2, 106.85], // Jakarta
    [35.68, 139.69], // Tokio
    [-31.95, 115.86], // Perth
    [-33.87, 151.21], // Sydney
    [0, -30], // Atlantische Oceaan
    [-40, 80], // Indische Oceaan
  ];
  const SEARCH_COUNT = 4;
  const MS_PER_PX = 1.875; // motion.md: timing = afstand × 1,875 ms

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function fmt(v, pos, neg) {
    const a = Math.abs(v);
    let d = Math.floor(a);
    let m = Math.round((a - d) * 60);
    if (m === 60) { d += 1; m = 0; }
    return `${d}°${String(m).padStart(2, '0')}′ ${v >= 0 ? pos : neg}`;
  }
  function coordText(ll) {
    const lat = clamp(ll.lat, -90, 90);
    const lon = ((ll.lon + 540) % 360) - 180;
    return `${fmt(lat, 'N', 'S')}, ${fmt(lon, 'E', 'W')}`;
  }

  function setup(wrap) {
    const visual = wrap.querySelector('.not-found_visual');
    const img = wrap.querySelector('.not-found_img');
    const target = wrap.querySelector('.not-found_target');
    const box = wrap.querySelector('.not-found_target-box');
    const status = wrap.querySelector('.not-found_status');
    const coords = wrap.querySelector('.not-found_coords');
    const content = wrap.querySelector('.not-found_content');
    if (!visual || !img || !target) return;
    const gsap = window.gsap;
    const still = reduce.matches || !gsap;

    let geo = null;
    let blocked = [];
    const cur = { lat: 0, lon: 0 };

    function rectOf(el, pad) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const v = visual.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return { l: r.left - v.left - pad, t: r.top - v.top - pad, r: r.right - v.left + pad, b: r.bottom - v.top + pad };
    }
    function measure() {
      const W = visual.clientWidth;
      const H = visual.clientHeight;
      const nw = img.naturalWidth || MAP_W;
      const nh = img.naturalHeight || MAP_H;
      const s = Math.max(W / nw, H / nh);
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5));
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      geo = { W, H, rem, scale: (PX_PER_DEG * nw * s) / MAP_W, ox: (W - nw * s) * px, oy: (H - nh * s) * py };
      blocked = [rectOf(content, rem), rectOf(coords, rem)].filter(Boolean);
    }
    const toXY = (lat, lon) => ({ x: geo.ox + (lon - MAP_LEFT) * geo.scale, y: geo.oy + (MAP_TOP - lat) * geo.scale });
    const toLL = (x, y) => ({ lat: MAP_TOP - (y - geo.oy) / geo.scale, lon: MAP_LEFT + (x - geo.ox) / geo.scale });

    // Vrij: niet tegen de rand, en het vizier plus "No match" rechtsonder ervan (± 7 × 2,5rem) raakt
    // geen tekst, knoppen of coördinaten.
    function isFree(p) {
      const m = 2.5 * geo.rem;
      if (p.x < m || p.y < 2 * m || p.x > geo.W - 7 * geo.rem || p.y > geo.H - 3 * geo.rem) return false;
      const a = { l: p.x - geo.rem, t: p.y - geo.rem, r: p.x + 7 * geo.rem, b: p.y + 2.5 * geo.rem };
      return blocked.every((b) => a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b);
    }
    function randomFree(from) {
      let best = null;
      for (let i = 0; i < 40; i += 1) {
        const p = { x: Math.random() * geo.W, y: Math.random() * geo.H };
        if (!isFree(p)) continue;
        const d = from ? Math.hypot(p.x - from.x, p.y - from.y) : 0;
        if (!from || d > geo.W * 0.12) return toLL(p.x, p.y);
        if (!best || d > best.d) best = { d, ll: toLL(p.x, p.y) };
      }
      return best ? best.ll : toLL(geo.W * 0.5, geo.H * 0.25);
    }
    function pickSpots() {
      const free = SPOTS.map(([lat, lon]) => ({ lat, lon, p: toXY(lat, lon) })).filter((s) => isFree(s.p));
      const path = [];
      let pool = free.slice();
      if (pool.length) path.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      while (path.length < SEARCH_COUNT && pool.length) {
        const last = path[path.length - 1].p;
        const far = pool.filter((s) => Math.hypot(s.p.x - last.x, s.p.y - last.y) > geo.W * 0.12);
        const from = far.length ? far : pool;
        from.sort((a, b) => Math.hypot(a.p.x - last.x, a.p.y - last.y) - Math.hypot(b.p.x - last.x, b.p.y - last.y));
        const next = from[Math.floor(Math.random() * Math.min(2, from.length))];
        path.push(next);
        pool = pool.filter((s) => s !== next);
      }
      while (path.length < SEARCH_COUNT) {
        const last = path.length ? path[path.length - 1].p : null;
        const ll = randomFree(last);
        path.push({ ...ll, p: toXY(ll.lat, ll.lon) });
      }
      return path.map(({ lat, lon }) => ({ lat, lon }));
    }

    let lastText = '';
    function place() {
      const p = toXY(cur.lat, cur.lon);
      target.style.left = `${p.x.toFixed(1)}px`;
      target.style.top = `${p.y.toFixed(1)}px`;
      const t = coordText(cur);
      if (coords && t !== lastText) { coords.textContent = t; lastText = t; }
    }

    measure();
    const spots = pickSpots();
    Object.assign(cur, spots[0]);
    place();

    if (still) {
      if (status) status.style.opacity = '1';
      const refit = () => { measure(); place(); };
      img.addEventListener('load', refit);
      if ('ResizeObserver' in window) new ResizeObserver(refit).observe(visual);
      return;
    }

    const ce = window.CustomEase;
    const EASE_MOVE = ce ? ce.create('nfPosition', 'M0,0 C0.75,0 0.5,1 1,1') : 'power2.inOut';
    const EASE_FADE = ce ? ce.create('nfOpacity', 'M0,0 C0.5,0 0.5,1 1,1') : 'sine.inOut';

    function move(tl, to, calm) {
      const a = toXY(cur.lat, cur.lon);
      const b = toXY(to.lat, to.lon);
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const ms = calm ? clamp(dist * MS_PER_PX * 2.4, 2400, 5200) : clamp(dist * MS_PER_PX, 900, 1900);
      tl.to(cur, { lat: to.lat, lon: to.lon, duration: ms / 1000, ease: calm ? 'sine.inOut' : EASE_MOVE, onUpdate: place });
    }
    function noMatch(tl) {
      if (box) tl.to(box, { opacity: 0.2, duration: 0.12, repeat: 3, yoyo: true, ease: 'none' });
      if (status) {
        tl.to(status, { opacity: 1, duration: 0.3, ease: EASE_FADE }, '<');
        tl.to(status, { opacity: 0, duration: 0.3, ease: EASE_FADE }, '+=1.2');
      }
      tl.to({}, { duration: 0.35 });
    }

    let current = null;
    let step = 0;
    let visible = true;
    function run() {
      const tl = gsap.timeline({ paused: !visible || document.hidden, onComplete: run });
      if (step === 0) {
        noMatch(tl); // eerste plek: het vizier staat er al na de opbouw
      } else if (step < spots.length) {
        // Na het laden van het lettertype kan de tekst verschoven zijn: valt de plek nu onder tekst, dan een vrij punt.
        const to = isFree(toXY(spots[step].lat, spots[step].lon)) ? spots[step] : randomFree(toXY(cur.lat, cur.lon));
        move(tl, to, false);
        noMatch(tl);
      } else {
        move(tl, randomFree(toXY(cur.lat, cur.lon)), true);
        tl.to({}, { duration: 1.6 + Math.random() * 2.2 });
      }
      step += 1;
      current = tl;
    }
    function sync() {
      if (!current) return;
      if (visible && !document.hidden) current.play();
      else current.pause();
    }
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; sync(); }).observe(wrap);
    }
    const refit = () => { measure(); place(); };
    img.addEventListener('load', refit);
    if ('ResizeObserver' in window) new ResizeObserver(refit).observe(visual);

    // Start als de IX3-opbouw van het vizier klaar is (schaal terug op 1), uiterlijk na 4 s.
    const t0 = performance.now();
    let sawBuild = false;
    (function waitBuilt() {
      const ix = document.documentElement.classList.contains('w-mod-ix3');
      const sc = ix ? Number(gsap.getProperty(target, 'scaleX')) : 0;
      if (ix && sc < 0.999) sawBuild = true;
      const elapsed = performance.now() - t0;
      if ((ix && sawBuild && sc >= 0.999) || (ix && !sawBuild && elapsed > 2500) || elapsed > 4000) {
        measure();
        run();
        return;
      }
      requestAnimationFrame(waitBuilt);
    })();
  }

  function init() {
    document.querySelectorAll('.not-found_wrap').forEach(setup);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
