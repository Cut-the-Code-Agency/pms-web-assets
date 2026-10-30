// Paginaovergangen (View Transitions tussen pagina's): mineralenkaart ↔ productpagina (eerste blok) en een rustige
// overgang tussen alle andere pagina's (tweede blok).
// Laden als gewoon script in de <head> van elke pagina (site-breed, niet defer/async): pagereveal moet luisteren vóór
// het eerste beeld. Op /products en het Minerals-sjabloon staat daarnaast <link rel="expect" href="#main" blocking="render">.
// Besluit en metingen: PMS-repo decisions/components/kaart-naar-product.md (prototype: prototypes/kaart-naar-product).
// Browsers zonder overgangen tussen pagina's krijgen een gewone paginawissel; minder beweging: ook.
// Balklinks (eigen overgang per link in de head-CSS van de nav) beginnen ook in de stand van de oude pagina:
// data-nav-links houdt ze zonder beweging vast, bij het loslaten lopen ze als trappetje naar de eigen stand.
// Gedeeld door beide blokken hieronder (stond in het eerste blok, het tweede gaf "holdLinks is not defined" en bleef
// dan met een kleine nav staan). esbuild --format=iife zet het hele bestand in één functie: dit blijft lokaal.
function holdLinks(nav, from) {
  nav.setAttribute('data-nav-links', from > .5 ? 'hidden' : 'shown');
  const item = nav.querySelector('.nav_links_bar_item');
  if (item) getComputedStyle(item).opacity;
}

(function () {
  const html = document.documentElement;
  const KEY = 'pms-vt-handoff';
  const SCROLL_KEY = 'pms-vt-grid-scroll';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supported = 'onpagereveal' in window && 'CSSViewTransitionRule' in window;
  const P = (window.pmsVT = { version: '1.78.0' });

  // Adressen met en zonder taalvoorvoegsel (/products/x, /nl/products/x, /de/products/x), op elk domein
  const PATH = /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/products(?:\/([a-z0-9-]+))?\/?$/;
  const pathOf = url => new URL(url, location.href).pathname;
  const slugOf = url => (pathOf(url).match(PATH) || [])[1] || null;
  const isGrid = url => { const m = pathOf(url).match(PATH); return !!m && !m[1]; };
  const safeJSON = s => { try { return JSON.parse(s) || {}; } catch { return {}; } };
  const rectOf = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
  const pageKind = () => document.querySelector('.product-hero_visual') ? 'detail'
    : document.querySelector('.minerals-grid_list') && isGrid(location.href) ? 'grid' : null;

  // Nummer met vaste cijfers (CMS Sort Order 6 → "06", zoals de teller op de kaart): [data-number-pad="2"]
  function padNumbers() {
    document.querySelectorAll('[data-number-pad]').forEach(el => {
      const t = el.textContent.trim(), n = parseInt(el.dataset.numberPad, 10) || 2;
      if (/^\d+$/.test(t) && t.length < n) el.textContent = t.padStart(n, '0');
    });
  }
  addEventListener('DOMContentLoaded', padNumbers);

  if (!supported || reduce) return;

  // ---------- Opmaak van de overgang ----------
  // Timing en curves: motion.md (Position .75,0,.5,1 · exit .5,0,.75,1 · tekst ease-out .25,1,.5,1 · Opacity .5,0,.5,1)
  const css = `
@view-transition { navigation: auto; }
:root { --vt-dur: 900ms; --vt-ease: cubic-bezier(.75,0,.5,1); --vt-exit: cubic-bezier(.5,0,.75,1); --vt-text: cubic-bezier(.25,1,.5,1); --vt-border: var(--_theme---border); }
.vt-clone { position: fixed; z-index: 2; pointer-events: none; object-fit: fill; margin: 0; max-width: none; }
html.vt-leaving :is(.minerals-grid_head, .minerals-grid_item:not(.is-vt-active), .page_main > :not(:first-child), .footer_wrap) {
  opacity: 0 !important; translate: 0 .5rem; transition: opacity 250ms var(--vt-exit), translate 250ms var(--vt-exit) !important; }
::view-transition-group(*) { animation-duration: var(--vt-dur); animation-timing-function: var(--vt-ease); transform-origin: 0 0; }
::view-transition-old(root) { animation: vt-out 250ms var(--vt-exit) both; z-index: 1; }
::view-transition-new(root) { animation: none; }
::view-transition-group(vt-frame) { z-index: 2; }
/* Lijnen vullen hun groep precies: standaard krijgt een beeld de breedte van de groep en een hoogte naar verhouding,
   dan werd een lijn boven/onder dikker (heen) en een zijlijn veel te lang (terug) */
.vt-edge { position: fixed; z-index: 2; pointer-events: none; background: var(--vt-border); --bw: var(--border-width--main, 1px); }
::view-transition-group(vt-edge-t), ::view-transition-group(vt-edge-r), ::view-transition-group(vt-edge-b), ::view-transition-group(vt-edge-l) { z-index: 2; }
::view-transition-old(vt-edge-t), ::view-transition-old(vt-edge-r), ::view-transition-old(vt-edge-b), ::view-transition-old(vt-edge-l),
::view-transition-new(vt-edge-t), ::view-transition-new(vt-edge-r), ::view-transition-new(vt-edge-b), ::view-transition-new(vt-edge-l) { animation: none; width: 100%; height: 100%; object-fit: fill; }
::view-transition-old(vt-frame) { height: 100%; object-fit: fill; animation: vt-out 200ms var(--vt-exit) both; }
::view-transition-new(vt-frame) { display: none; }
::view-transition-group(vt-stone) { z-index: 4; }
::view-transition-old(vt-stone), ::view-transition-new(vt-stone) { animation: none; }
::view-transition-group(vt-formula), ::view-transition-group(vt-num) { z-index: 3; }
::view-transition-group(vt-cardtext) { animation: none; z-index: 3; }
::view-transition-old(vt-cardtext) { animation: vt-out 300ms cubic-bezier(.5,0,.5,1) both; }
::view-transition-group(vt-thumbs) { z-index: 3; }
::view-transition-new(vt-thumbs) { animation: none; }
::view-transition-old(vt-thumbs) { animation: vt-out 150ms var(--vt-exit) both; }
::view-transition-group(vt-nav) { animation: none; z-index: 100; }
::view-transition-new(vt-nav) { animation: none; }
/* Alleen de levende nieuwe nav: die begint in de stand van de oude en groeit/krimpt mee (navFrom hieronder); de oude
   als beeld erbij gaf twee logo's (ingeklapt en vol) over elkaar */
::view-transition-old(vt-nav) { animation: none; opacity: 0; }
@keyframes vt-out { to { opacity: 0; } }
@keyframes vt-up { from { opacity: 0; translate: 0 1.25rem; } }
html.vt-returning .is-vt-active .card_mineral_content { animation: vt-up 750ms var(--vt-text) var(--vt-dur) both; }
html.vt-arriving :is(.product-hero_meta, .product-hero_formula, .product-hero_number) { opacity: 1 !important; visibility: visible !important; }
`;
  const style = document.createElement('style');
  style.id = 'pms-page-transition';
  style.textContent = css;
  document.head.append(style);

  // Productpagina's alvast ophalen bij hover (geen prerender: een vooraf opgebouwde pagina brak de overgang af)
  if (window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    const rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({ prefetch: [{ where: { or: [{ href_matches: '/products/*' }, { href_matches: '/*/products/*' }] }, eagerness: 'moderate' }] });
    document.head.append(rules);
  }

  // ---------- Onderdelen die van kaart naar productkop gaan ----------
  function gridParts(slug) {
    const link = [...document.querySelectorAll('.minerals-grid_list .card_mineral_wrap a.clickable_link')].find(a => slugOf(a.href) === slug);
    const card = link && link.closest('.card_mineral_wrap');
    if (!card || !card.getClientRects().length) return null; // weggefilterd
    const q = s => card.querySelector(s);
    return {
      slug, card, item: card.closest('.minerals-grid_item'), frame: card,
      formula: q('.card_mineral_formula'), stone: q('.card_mineral_image'),
      content: q('.card_mineral_content'), num: q('.card_mineral_number'),
    };
  }
  function detailParts() {
    const visual = document.querySelector('.product-hero_visual');
    if (!visual) return null;
    const track = visual.querySelector('.product-hero_track');
    const q = s => visual.querySelector(s);
    return {
      slug: slugOf(location.href), frame: visual, formula: q('.product-hero_formula'), num: q('.product-hero_number'),
      // Alleen als de steen-dia in beeld is (niet de korrelfoto)
      stone: !track || track.scrollLeft < 10 ? q('.product-hero_slide.is-stone .product-hero_stone') : null,
      thumbs: q('.product-hero_thumbs'),
    };
  }

  // Het zichtbare deel van een afbeelding met object-fit: contain (kaartvak en productvak hebben een andere
  // verhouding; zo vliegt alleen de steen zelf en rekt hij niet uit)
  function drawnRect(img, aspect) {
    const r = img.getBoundingClientRect();
    const a = img.naturalWidth ? img.naturalWidth / img.naturalHeight : aspect || r.width / r.height;
    const w = Math.min(r.width, r.height * a), h = w / a;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  }

  // Vliegende steen: een kopie van de afbeelding op het zichtbare deel, het origineel even verborgen. De steen mag
  // nooit wegvallen: kopie vooraf klaarzetten (decode), origineel pas uit als de kopie te tekenen is, kopie pas weg
  // als het origineel te tekenen is.
  let clone = null, hidden = null, ready = null;
  function prepareClone(img) {
    const src = img && (img.currentSrc || img.src);
    if (!src || (ready && ready.src === src)) return;
    ready = new Image();
    ready.src = src;
    ready.decode().catch(() => {});
  }
  function makeClone(img, src, aspect) {
    removeClone();
    const r = drawnRect(img, aspect);
    clone = ready && ready.src === src ? ready : new Image();
    ready = null;
    clone.className = 'vt-clone';
    clone.alt = '';
    clone.decoding = 'sync';
    if (clone.src !== src) clone.src = src;
    Object.assign(clone.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.append(clone);
    if (clone.complete && clone.naturalWidth) img.style.visibility = 'hidden';
    hidden = img;
    return clone;
  }
  function removeClone() {
    const img = hidden, c = clone;
    hidden = clone = null;
    if (!img) { if (c) c.remove(); return; }
    const done = () => { img.style.visibility = ''; if (c) requestAnimationFrame(() => c.remove()); };
    const show = () => (img.decode ? img.decode() : Promise.resolve()).then(done, done);
    if (img.complete && img.naturalWidth) show(); else img.addEventListener('load', show, { once: true });
  }

  // Rand van het kader als vier lijnen (een rand op de groep zou meeschalen): elke lijn schaalt alleen in zijn lengte
  let edges = [];
  function makeEdges(frame) {
    removeEdges();
    const r = frame.getBoundingClientRect(), L = r.left + 'px', T = r.top + 'px', W = r.width + 'px', H = r.height + 'px';
    const sides = {
      t: { left: L, top: T, width: W, height: 'var(--bw)' },
      b: { left: L, top: `calc(${T} + ${H} - var(--bw))`, width: W, height: 'var(--bw)' },
      l: { left: L, top: T, width: 'var(--bw)', height: H },
      r: { left: `calc(${L} + ${W} - var(--bw))`, top: T, width: 'var(--bw)', height: H },
    };
    for (const k in sides) {
      const el = document.createElement('div');
      el.className = 'vt-edge';
      Object.assign(el.style, sides[k]);
      document.body.append(el);
      edges.push(el);
      name(el, 'vt-edge-' + k);
    }
  }
  function removeEdges() { for (const el of edges) el.remove(); edges = []; }

  // Vlucht alleen met transform (verschuiven + schalen) in plaats van breedte/hoogte. Breedte/hoogte rekent Chrome
  // op de hoofdtaak uit; die is op de nieuwe pagina bezig met opstarten (Webflow, IX3, scripts), en dan bevriest de
  // vlucht 100–500 ms en springt daarna door. Transform loopt los van de hoofdtaak, zoals Safari het al deed.
  // Zelfde baan en curve: hoek en maat bewegen lineair met de voortgang, net als bij breedte/hoogte.
  const shift = t => {
    if (!t || t === 'none') return [0, 0];
    const m = /^matrix\(([^)]+)\)$/.exec(t);
    const v = m && m[1].split(',').map(parseFloat);
    return v && v[0] === 1 && v[1] === 0 && v[2] === 0 && v[3] === 1 ? [v[4], v[5]] : null;
  };
  function compositeFlight() {
    for (const a of document.getAnimations()) {
      const fx = a.effect;
      if (!fx || !/^::view-transition-group\(vt-/.test(fx.pseudoElement || '') || !fx.getKeyframes) continue;
      const k = fx.getKeyframes();
      if (k.length !== 2) continue;
      const [f, t] = k, w0 = parseFloat(f.width), h0 = parseFloat(f.height), w1 = parseFloat(t.width), h1 = parseFloat(t.height);
      const p0 = shift(f.transform), p1 = shift(t.transform);
      if (!p0 || !p1 || !(w0 > 0 && h0 > 0 && w1 > 0 && h1 > 0)) continue;
      fx.setKeyframes([
        { offset: 0, easing: f.easing, width: w1 + 'px', height: h1 + 'px', transform: `translate(${p0[0]}px, ${p0[1]}px) scale(${w0 / w1}, ${h0 / h1})` },
        { offset: 1, width: w1 + 'px', height: h1 + 'px', transform: `translate(${p1[0]}px, ${p1[1]}px) scale(1, 1)` },
      ]);
    }
  }

  // Namen alleen tijdens een overgang (een view-transition-name maakt van een element een eigen laag)
  let named = [];
  const name = (el, n) => { if (el) { el.style.viewTransitionName = n; named.push(el); } };
  function nameParts(p, stoneEl) {
    name(p.frame, 'vt-frame');
    makeEdges(p.frame);
    name(p.formula, 'vt-formula');
    name(p.num, 'vt-num');
    name(stoneEl, 'vt-stone');
    name(p.thumbs, 'vt-thumbs');
    name(document.querySelector('[data-nav="component"]'), 'vt-nav');
    html.style.setProperty('--vt-border', getComputedStyle(p.frame).borderTopColor);
  }
  function clearNames() {
    for (const el of named) el.style.viewTransitionName = '';
    named = [];
    removeEdges();
  }

  // Vluchtduur volgens motion.md: afstand × 1,875 ms, tussen 750 en 1200 ms
  function flightDuration(a, b) {
    const d = Math.hypot(a.left + a.width / 2 - (b.left + b.width / 2), a.top + a.height / 2 - (b.top + b.height / 2));
    return Math.min(1200, Math.max(750, d * 1.875));
  }

  // ---------- Hover eerst dicht ----------
  // Kaart in rust zetten, ook als de muis er nog op staat: Lumos-trigger op "uit" (zoals een kaart in rust) en de
  // themakleuren van de hover terug naar die van de sectie. Uithoveren loopt met de eigen overgangen van de kaart.
  const CALM_VARS = ['background', 'text', 'background-2', 'eyebrow--text', 'heading-accent', 'border', 'card-mineral--meta'].map(v => '--_theme---' + v);
  const TRIGGER_VARS = ['--_trigger---on', '--_trigger---off'];
  function calmCard(card) {
    const rest = [...document.querySelectorAll('.card_mineral_wrap')].find(c => c !== card && !c.matches(':hover, :focus-within'));
    const on = rest ? parseFloat(getComputedStyle(rest).getPropertyValue('--_trigger---on')) : NaN;
    if (!isNaN(on)) { card.style.setProperty('--_trigger---on', on); card.style.setProperty('--_trigger---off', 1 - on); }
    for (const v of CALM_VARS) card.style.setProperty(v, 'inherit');
    card.style.pointerEvents = 'none';
  }
  function restoreCard(card) {
    if (!card) return;
    for (const v of CALM_VARS.concat(TRIGGER_VARS)) card.style.removeProperty(v);
    card.style.pointerEvents = '';
  }
  // Korrelmasker (clip-path: inset(0 R B 0), 100 % = dicht) en steen terug?
  function atRest(card) {
    const bg = card.querySelector('.card_mineral_bg');
    const m = bg && getComputedStyle(bg).clipPath.match(/inset\(\s*[\d.]+px\s+([\d.]+)%\s+([\d.]+)%/);
    const stone = card.querySelector('.card_mineral_image');
    return (!m || (+m[1] >= 99 && +m[2] >= 99)) && (!stone || +getComputedStyle(stone).opacity >= 0.98);
  }

  // ---------- Klik op een kaart in het overzicht ----------
  // Klik → de kaart sluit zijn hover (de rest blijft staan) → wissel; de rest vervaagt in de overgang zelf, tegelijk
  // met het vertrek van het kader (één beweging; vervaagde hij vooraf, dan stond het beeld daarna stil zolang de
  // productpagina opbouwt). Duurt de wissel langer (geen prefetch, traag netwerk), dan vervaagt de rest alvast.
  let leaving = false, slowTimer = 0;
  const clearSlow = () => { clearTimeout(slowTimer); slowTimer = 0; };
  document.addEventListener('click', e => {
    if (pageKind() !== 'grid') return;
    const a = e.target.closest && e.target.closest('.minerals-grid_list .card_mineral_wrap a.clickable_link');
    if (!a || !slugOf(a.href) || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (leaving) return;
    leaving = true;
    const card = a.closest('.card_mineral_wrap');
    prepareClone(card.querySelector('.card_mineral_image'));
    // Alleen de aangeklikte kaart blijft staan; een net teruggevlogen kaart dimt gewoon mee
    document.querySelectorAll('.is-vt-active').forEach(el => el.classList.remove('is-vt-active'));
    card.closest('.minerals-grid_item').classList.add('is-vt-active');
    calmCard(card);
    a.blur();
    const t0 = performance.now();
    P.clickAbs = performance.timeOrigin + t0;
    (function wait() {
      if (atRest(card) || performance.now() - t0 > 600) requestAnimationFrame(() => {
        location.href = a.href;
        slowTimer = setTimeout(() => html.classList.add('vt-leaving'), 150);
      });
      else requestAnimationFrame(wait);
    })();
  }, true);
  // Uit het geheugen van de browser terug: de wachtende timer niet alsnog laten afgaan
  addEventListener('pagehide', clearSlow);

  // ---------- Oude pagina: vlak voor het wisselen ----------
  addEventListener('pageswap', e => {
    clearSlow();
    const url = e.viewTransition && e.activation && e.activation.entry && e.activation.entry.url;
    if (!url) return;
    let parts = null;
    if (pageKind() === 'grid' && slugOf(url)) {
      parts = gridParts(slugOf(url));
      sessionStorage.setItem(SCROLL_KEY, String(Math.round(scrollY))); // voor de weg terug
    } else if (pageKind() === 'detail' && isGrid(url)) parts = detailParts();
    if (!parts) return;

    const nav = document.querySelector('[data-nav="component"]');
    const hand = { slug: parts.slug, at: Date.now(), clickAbs: P.clickAbs || 0, frame: rectOf(parts.frame), stone: null,
      navS: nav ? parseFloat(getComputedStyle(nav).getPropertyValue('--nav--scrolled')) || 0 : 0 };
    let stoneEl = null;
    if (parts.stone && parts.stone.naturalWidth) {
      const img = parts.stone;
      hand.stone = { src: img.currentSrc || img.src, aspect: img.naturalWidth / img.naturalHeight };
      stoneEl = makeClone(img, hand.stone.src, hand.stone.aspect);
    }
    localStorage.setItem(KEY, JSON.stringify(hand));
    nameParts(parts, stoneEl);
    // Kaarttekst los van het kader: rekt niet mee met het groeiende kader, vervaagt rustig op zijn plek
    name(parts.content, 'vt-cardtext');
    e.viewTransition.finished.finally(() => { clearNames(); removeClone(); });
  });

  // ---------- Inladen van de productkop (IX3) afstemmen op de vlucht ----------
  // De GSAP-klok (Webflow Interactions) even vasthouden, zodat titel en teksten pas inladen als het kader al een
  // eind onderweg is (45 %). Wat meevliegt (nummer, formule) staat via de opmaak hierboven meteen zichtbaar.
  function holdIX3(until) {
    let paused = false, done = false;
    const tryPause = () => {
      if (done || paused || !window.gsap) return paused;
      gsap.globalTimeline.pause();
      return (paused = true);
    };
    document.addEventListener('DOMContentLoaded', tryPause, { capture: true, once: true });
    (function poll() { if (!tryPause() && !done) requestAnimationFrame(poll); })();
    setTimeout(() => { done = true; if (paused) gsap.globalTimeline.resume(); }, Math.max(0, until - performance.now()));
  }

  // Terug naar het overzicht: geen inlaadanimatie (die hoort bij een eerste bezoek). Laadt het overzicht opnieuw,
  // dan elke IX3-tijdlijn die iets in het raster raakt in zijn geheel afmaken (scroll-animaties verderop blijven).
  function finishGridIX3() {
    const grid = document.querySelector('.minerals-grid_wrap') || document.querySelector('.minerals-grid_list');
    const t0 = performance.now();
    (function tick() {
      if (window.gsap && grid) {
        const inGrid = tw => (tw.targets ? tw.targets() : []).some(t => t && t.nodeType === 1 && grid.contains(t));
        for (const top of gsap.globalTimeline.getChildren(false, true, true)) {
          if (top.progress() >= 1) continue;
          if (top.getChildren ? top.getChildren(true, true, false).some(inGrid) : inGrid(top)) top.progress(1);
        }
      }
      if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
    })();
  }

  // Terug naar het overzicht: scrollpositie zelf terugzetten vóór de plek van de kaart bepaald wordt (iPhone doet
  // het pas na het eerste beeld; dan vloog de steen onder het scherm uit)
  function restoreGridScroll() {
    const y = parseInt(sessionStorage.getItem(SCROLL_KEY), 10);
    if (isNaN(y) || Math.abs(scrollY - y) <= 1) return;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    scrollTo(0, y);
  }

  // Nav in de stand van de oude pagina laten beginnen (ingeklapt of vol, --nav--scrolled uit de head-CSS van de nav) en
  // tijdens de vlucht naar de eigen stand laten groeien of krimpen: logo en balklinks bewegen zoals bij scrollen,
  // in de duur van de vlucht. Eigen stand: zoals nav.js (scrollY voorbij de balkhoogte).
  function navFrom(from, vt, dur) {
    const nav = document.querySelector('[data-nav="component"]'), bar = nav && nav.querySelector('[data-nav="bar"]');
    if (!nav || !bar) return;
    const to = scrollY > bar.offsetHeight;
    nav.toggleAttribute('data-nav-scrolled', to);
    if (Math.abs(from - (to ? 1 : 0)) < 0.01) return;
    nav.style.transition = 'none';
    nav.style.setProperty('--nav--scrolled', from);
    getComputedStyle(nav).getPropertyValue('--nav--scrolled');
    holdLinks(nav, from);
    const go = () => {
      nav.style.transition = '';
      nav.removeAttribute('data-nav-links');
      nav.style.transitionDuration = dur + 'ms';
      nav.style.removeProperty('--nav--scrolled');
      setTimeout(() => { nav.style.transitionDuration = ''; }, dur + 100);
    };
    vt.ready.then(go, go);
  }

  // ---------- Nieuwe pagina: vóór het eerste beeld ----------
  addEventListener('pagereveal', e => {
    padNumbers();
    clearSlow();
    html.classList.remove('vt-leaving', 'vt-arriving', 'vt-returning');
    leaving = false;
    const h = safeJSON(localStorage.getItem(KEY));
    localStorage.removeItem(KEY);
    const vt = e.viewTransition;
    let parts = null;
    if (vt && h.slug && Date.now() - h.at < 10000) {
      if (pageKind() === 'grid') restoreGridScroll();
      parts = pageKind() === 'detail' ? detailParts() : pageKind() === 'grid' ? gridParts(h.slug) : null;
      if (parts && parts.card) {
        const r = parts.card.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight) parts = null; // kaart niet in beeld: gewone overvloeier
      }
      if (parts && parts.slug !== h.slug) parts = null;
    }
    // Teruggekomen uit het geheugen van de browser: kaarten weer gewoon
    document.querySelectorAll('.is-vt-active').forEach(el => {
      if (!parts || el !== parts.item) el.classList.remove('is-vt-active');
      if (!parts) restoreCard(el.querySelector('.card_mineral_wrap'));
    });
    clearNames();
    removeClone();
    if (!parts) return;

    const dur = flightDuration(h.frame, rectOf(parts.frame));
    html.style.setProperty('--vt-dur', dur + 'ms');
    const stoneEl = h.stone && parts.stone ? makeClone(parts.stone, h.stone.src, h.stone.aspect) : null;
    nameParts(parts, stoneEl);
    vt.ready.then(compositeFlight, () => {});
    navFrom(h.navS || 0, vt, dur);
    if (pageKind() === 'detail') {
      html.classList.add('vt-arriving');
      holdIX3(performance.now() + dur * 0.45);
    } else {
      html.classList.add('vt-returning');
      parts.item.classList.add('is-vt-active');
      parts.card.style.pointerEvents = 'none'; // geen hover terwijl de steen terugvliegt
      if (!e.persisted) finishGridIX3();
    }
    P.arrival = { dur: Math.round(dur), stone: !!stoneEl, wait: h.clickAbs ? Math.round(performance.timeOrigin + performance.now() - h.clickAbs) : 0 };
    vt.finished.finally(() => {
      clearNames();
      removeClone();
      if (pageKind() === 'detail') prepareClone(parts.stone); // klaar voor de weg terug
      if (parts.card) restoreCard(parts.card);
      setTimeout(() => {
        html.classList.remove('vt-arriving', 'vt-returning');
        if (parts.item) parts.item.classList.remove('is-vt-active');
      }, 1500);
    });
  });

  // Productpagina direct geopend: steen alvast klaarzetten voor de weg terug
  addEventListener('DOMContentLoaded', () => { if (pageKind() === 'detail') { const p = detailParts(); if (p) prepareClone(p.stone); } });
})();

// ---------- Rustige overgang tussen alle andere pagina's ----------
// De nav blijft stilstaan, het blokje van de actieve balklink glijdt met een boogje naar de nieuwe link, alleen de
// inhoud wisselt zacht (Opacity uit motion.md); daarna laadt de pagina in zoals altijd (IX3). Vanuit het open menu
// blijft het menu open tot de wissel en schuift het paneel op de nieuwe pagina omhoog weg, zoals bij sluiten.
// Kaart ↔ productpagina: dat doet het blok hierboven (de vliegende kaart). Besluit: PMS-repo decisions/motion.md
// ("Rustige paginaovergang"); prototype: prototypes/pagina-overgang/.
(function () {
  const html = document.documentElement;
  const KEY = 'pms-calm';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supported = 'onpagereveal' in window && 'CSSViewTransitionRule' in window;
  const safeJSON = s => { try { return JSON.parse(s) || {}; } catch { return {}; } };
  const C = (window.pmsCalm = { version: (window.pmsVT && window.pmsVT.version) || '' });
  if (reduce || !supported) return;

  const k = 1;
  const FADE = 300 * k; // Opacity: 300 ms, cubic-bezier(.5,0,.5,1)
  const NEW_DELAY = 150 * k; // oude inhoud uit, nieuwe 150 ms later in (door de paginakleur heen)
  const OPACITY = 'cubic-bezier(.5,0,.5,1)', POSITION = 'cubic-bezier(.75,0,.5,1)', EXIT = 'cubic-bezier(.5,0,.75,1)';
  const MENU = 750 * k; // menu open + link: het paneel schuift op de nieuwe pagina weg (Position exit, motion.md)

  // Kaart ↔ productpagina: dat doet page-transition.js (zelfde adresregels)
  const PATH = /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/products(?:\/([a-z0-9-]+))?\/?$/;
  const pathOf = url => new URL(url, location.href).pathname;
  const slugOf = url => (pathOf(url).match(PATH) || [])[1] || null;
  const isGrid = url => { const m = pathOf(url).match(PATH); return !!m && !m[1]; };
  const byCard = (from, to) => !!window.pmsVT && ((isGrid(from) && !!slugOf(to)) || (!!slugOf(from) && isGrid(to)));

  const css = `
@view-transition { navigation: auto; }
html.pms-calm-vt::view-transition { background: var(--pms-calm-bg, transparent); }
html.pms-calm-vt::view-transition-old(root) { animation: pms-calm-out ${FADE}ms ${OPACITY} both; mix-blend-mode: normal; z-index: auto; }
html.pms-calm-vt::view-transition-new(root) { animation: pms-calm-in ${FADE}ms ${OPACITY} ${NEW_DELAY}ms both; mix-blend-mode: normal; }
html.pms-calm-vt::view-transition-group(root) { animation: none; }
html.pms-calm-vt::view-transition-group(pms-nav) { animation: none; z-index: 2; }
/* De standaard overvloeier neemt zijn duur en fill over van de groep; die staat stil (animation: none), dus zonder
   eigen fill stond de oude nav na afloop weer vol naast de nieuwe (tekst dubbel, donkerder) */
html.pms-calm-vt::view-transition-old(pms-nav), html.pms-calm-vt::view-transition-new(pms-nav) { animation-duration: ${FADE}ms; animation-timing-function: ${OPACITY}; animation-fill-mode: both; }
html.pms-calm-vt::view-transition-group(pms-marker) { z-index: 3; animation-duration: var(--pms-calm-move, 750ms); animation-timing-function: ${POSITION}; transform-origin: 0 0; }
html.pms-calm-vt::view-transition-old(pms-marker), html.pms-calm-vt::view-transition-new(pms-marker) { animation: none; }
html.pms-calm-vt::view-transition-old(pms-marker):only-child { animation: pms-calm-out ${FADE}ms ${OPACITY} both; }
html.pms-calm-vt::view-transition-new(pms-marker):only-child { animation: pms-calm-in ${FADE}ms ${OPACITY} ${NEW_DELAY}ms both; }
html.pms-calm-vt:not(.pms-calm-grow) [data-nav="links"] .nav_link::before { visibility: hidden; }
/* Nav groeit/krimpt mee (navGrow): alleen de levende nieuwe nav, die begint in de stand van de oude; het blokje schuift
   met zijn link mee in plaats van als eigen laag te glijden */
html.pms-calm-vt.pms-calm-grow::view-transition-old(pms-nav) { animation: none; opacity: 0; }
html.pms-calm-vt.pms-calm-grow::view-transition-new(pms-nav) { animation: none; }
/* Vanuit het open menu: de nieuwe pagina staat meteen onder het paneel, het paneel schuift omhoog weg zoals bij sluiten */
html.pms-calm-menu::view-transition-old(root) { animation: none; opacity: 0; }
html.pms-calm-menu::view-transition-new(root) { animation: none; }
html.pms-calm-menu::view-transition-group(pms-menu) { animation: none; z-index: 1; }
html.pms-calm-menu::view-transition-old(pms-menu) { animation: pms-calm-menu-up ${MENU}ms ${EXIT} both; }
@keyframes pms-calm-menu-up { to { translate: 0 -100%; } }
.pms-calm-marker { position: fixed; pointer-events: none; z-index: 2147483000; }
@keyframes pms-calm-out { to { opacity: 0; } }
@keyframes pms-calm-in { from { opacity: 0; } }
`;
  const style = document.createElement('style');
  style.id = 'pms-calm';
  style.textContent = css;
  document.head.append(style);

  // Alle pagina's van de site alvast ophalen bij hover (geen prerender: dat brak de kaartovergang af)
  if (window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    const rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({ prefetch: [{ where: { href_matches: '/*' }, eagerness: 'moderate' }] });
    document.head.append(rules);
  }

  // ---------- Nav en blokje ----------
  const navEl = () => document.querySelector('[data-nav="component"]');
  // Het blokje is een ::before op de actieve balklink (head-CSS van de nav, alleen ≥ 992 px); hier als los element
  // op dezelfde plek, zodat het als eigen laag van link naar link kan glijden
  function markerRect() {
    const link = document.querySelector('[data-nav="links"] .nav_link:is(.w--current, [data-nav-current])');
    if (!link || !link.getClientRects().length) return null;
    const cs = getComputedStyle(link, '::before');
    if (cs.content === 'none' || cs.display === 'none') return null;
    const r = link.getBoundingClientRect();
    const w = parseFloat(cs.width), h = parseFloat(cs.height);
    if (!(w > 0 && h > 0) || r.width === 0) return null;
    return { left: r.left + parseFloat(cs.left), top: r.top + parseFloat(cs.top), width: w, height: h, color: cs.backgroundColor };
  }
  let marker = null, named = [];
  function name(el, n) { if (el) { el.style.viewTransitionName = n; named.push(el); } }
  const menuOpen = () => !!document.querySelector('[data-nav="component"] [data-nav="menu-button"].w--open');
  const menuPanel = () => [...document.querySelectorAll('[data-nav="component"] [data-nav="panel"]')].find(el => el.getClientRects().length && el.getBoundingClientRect().height > 0);
  function setup(m, panel) {
    name(navEl(), 'pms-nav');
    name(panel, 'pms-menu');
    if (m) {
      marker = document.createElement('div');
      marker.className = 'pms-calm-marker';
      marker.setAttribute('aria-hidden', 'true');
      Object.assign(marker.style, { left: m.left + 'px', top: m.top + 'px', width: m.width + 'px', height: m.height + 'px', background: m.color });
      document.body.append(marker);
      name(marker, 'pms-marker');
    }
    // Achtergrond van de pagina (met korrel) achter de wissel, zodat de inhoud erdoorheen vervaagt en niet door wit
    const bg = getComputedStyle(document.body);
    html.style.setProperty('--pms-calm-bg', bg.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(html).backgroundColor : bg.backgroundColor);
    html.classList.add('pms-calm-vt');
  }
  function cleanup() {
    for (const el of named) el.style.viewTransitionName = '';
    named = [];
    if (marker) { marker.remove(); marker = null; }
    html.classList.remove('pms-calm-vt', 'pms-calm-menu', 'pms-calm-grow');
  }

  // Zichtbare stand van de balk: ingeklapt (--nav--scrolled, head-CSS van de nav) tenzij de muis erop staat (--nav--hover)
  function navState(nav) {
    const bar = nav && nav.querySelector('[data-nav="bar"]');
    if (!nav || !bar) return { s: 0, bar };
    const v = (el, p) => parseFloat(getComputedStyle(el).getPropertyValue(p)) || 0;
    return { s: v(nav, '--nav--scrolled') * (1 - v(bar, '--nav--hover')), bar };
  }
  // Nav in de stand van de oude pagina laten beginnen en naar de eigen stand laten groeien of krimpen (zoals bij
  // scrollen: 750 ms, curves van de nav-CSS), met de toon van de oude pagina als begin, zodat nav.js de kleur zacht
  // laat overgaan. Eigen stand: zoals nav.js (scroll voorbij de balkhoogte). Zelfde aanpak als de kaartovergang.
  function navGrow(from, tones, vt) {
    const nav = navEl(), { bar } = navState(nav);
    if (!bar) return false;
    const to = scrollY > bar.offsetHeight;
    nav.toggleAttribute('data-nav-scrolled', to);
    if (Math.abs(from - (to ? 1 : 0)) < 0.01) return false;
    for (const k in tones || {}) nav.querySelectorAll(`[data-nav="${k}"]`).forEach(el => el.setAttribute('data-nav-tone', tones[k]));
    nav.style.transition = 'none';
    nav.style.setProperty('--nav--scrolled', from);
    getComputedStyle(nav).getPropertyValue('--nav--scrolled');
    holdLinks(nav, from);
    // nav.js meet bij scroll opnieuw: dan krijgt de balk zijn eigen toon (zacht, 300 ms), ook terug uit het geheugen van de
    // browser, waar nav.js nog de oude stand van deze pagina kent en anders niets zou bijwerken
    const go = () => { nav.style.transition = ''; nav.removeAttribute('data-nav-links'); nav.style.removeProperty('--nav--scrolled'); dispatchEvent(new Event('scroll')); };
    vt.ready.then(go, go);
    return true;
  }

  // ---------- Klik op een link in het open menu ----------
  // De Webflow Navbar sluit het menu meteen bij een klik op een link erin; dan schoof het paneel al weg terwijl de
  // nieuwe pagina nog laadde, en vervaagde het daarna nog eens los (hard). Het menu blijft nu open tot de wissel;
  // het paneel schuift op de nieuwe pagina omhoog weg. De link zelf werkt gewoon (geen preventDefault).
  let heldMenu = false;
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-nav="panel"] a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target !== '_self')) return;
    const to = new URL(a.href, location.href);
    if (to.origin !== location.origin || (to.pathname === location.pathname && to.search === location.search)) return;
    if (!menuOpen()) return;
    e.stopPropagation();
    heldMenu = true;
  }, true);
  // Terug uit het geheugen van de browser: het menu stond nog open, nu gewoon sluiten
  addEventListener('pageshow', e => {
    if (!e.persisted || !heldMenu) return;
    heldMenu = false;
    const btn = document.querySelector('[data-nav="component"] [data-nav="menu-button"].w--open');
    if (btn) btn.click();
  });

  // ---------- Oude pagina: vlak voor het wisselen ----------
  addEventListener('pageswap', e => {
    const to = e.activation && e.activation.entry && e.activation.entry.url;
    if (!e.viewTransition || !to || e.activation.navigationType === 'reload') return;
    const calm = !byCard(location.href, to);
    const menu = calm && menuOpen();
    const nav = navEl(), st = navState(nav);
    // Open menu: de balklinks zijn weg, het blokje komt gewoon op. Ingeklapte nav: de links (en het blokje) staan
    // onzichtbaar achter Contact, dus geen blokje om vandaan te glijden
    const m = calm && !menu && st.s < 0.5 ? markerRect() : null;
    const tones = {};
    if (nav) nav.querySelectorAll('[data-nav][data-nav-tone]').forEach(el => { tones[el.dataset.nav] = el.dataset.navTone; });
    sessionStorage.setItem(KEY, JSON.stringify({ from: location.href, at: Date.now(), calm, menu, marker: m, navS: st.s, tones }));
    if (!calm) return;
    setup(m, menu ? menuPanel() : null);
    e.viewTransition.finished.finally(cleanup);
  });

  // Inladen (IX3) pas als de nieuwe inhoud opkomt: de GSAP-klok van Webflow tot dan vasthouden
  function holdIX3(until) {
    let paused = false, done = false;
    const tryPause = () => {
      if (done || paused || !window.gsap) return paused;
      gsap.globalTimeline.pause();
      return (paused = true);
    };
    document.addEventListener('DOMContentLoaded', tryPause, { capture: true, once: true });
    (function poll() { if (!tryPause() && !done) requestAnimationFrame(poll); })();
    setTimeout(() => { done = true; if (paused) gsap.globalTimeline.resume(); }, Math.max(0, until - performance.now()));
  }

  // ---------- Nieuwe pagina: vóór het eerste beeld ----------
  addEventListener('pagereveal', e => {
    cleanup(); // terug uit het geheugen van de browser
    const d = safeJSON(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    const vt = e.viewTransition;
    if (!vt || !d.calm || Date.now() - d.at > 10000 || (d.from && byCard(d.from, location.href))) { C.last = null; return; }
    // Blokje: pas na de opbouw van de nav staat de actieve link op zijn plek (lettertype, nav.js); meten vlak voor het
    // vastleggen van de nieuwe stand
    // Terug uit het geheugen van de browser heeft de balk zijn eigen toon nog; anders beginnen met die van de oude pagina
    const grow = !d.menu && navGrow(d.navS || 0, e.persisted ? null : d.tones, vt);
    const m = grow ? null : markerRect();
    const dist = m && d.marker ? Math.hypot(m.left - d.marker.left, m.top - d.marker.top) : 0;
    html.style.setProperty('--pms-calm-move', Math.min(1100, Math.max(750, dist * 1.875)) * k + 'ms'); // motion.md
    setup(m);
    if (grow) html.classList.add('pms-calm-grow');
    if (d.menu) html.classList.add('pms-calm-menu');
    holdIX3(performance.now() + (d.menu ? MENU * 0.4 : NEW_DELAY));
    // Een klein boogje over de woorden: recht vooruit liep het blokje door de bovenkant van de letters
    if (m && d.marker && dist > 1) vt.ready.then(() => {
      const lift = m.height + 2;
      html.animate([
        { transform: 'translateY(0)', easing: OPACITY },
        { transform: `translateY(${-lift}px)`, offset: 0.5, easing: OPACITY },
        { transform: 'translateY(0)' },
      ], { pseudoElement: '::view-transition-group(pms-marker)', duration: Math.min(1100, Math.max(750, dist * 1.875)) * k, composite: 'add' });
    }, () => {});
    C.last = { marker: !!m, from: !!d.marker, dist: Math.round(dist), menu: !!d.menu };
    vt.finished.finally(cleanup);
  });

})();
