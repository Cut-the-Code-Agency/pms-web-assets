// Contact Map: de kaart bovenaan Contact (Webflow-component Contact Map).
// Zelfde beeldtaal als de Story Map (About us) en de Network Map (Our service):
//   1. Opbouw bij laden: lijnen tekenen (verticaal van boven, horizontaal van links, na elkaar),
//      tijd en coördinaten faden in, vierkantjes groeien vanuit hun midden, het vizier groeit vanuit
//      PMS en de adreskaart klapt uit (Scale vanuit linksboven).
//   2. Locaties: klik op een vierkantje (knop) → open adreskaart klapt in, het vizier schuift naar
//      die locatie (coördinaten rechtsonder lopen mee), de nieuwe kaart klapt uit op een plek met
//      ruimte (niet onder het formulier, niet buiten beeld). Elk vierkantje heeft een naam ernaast (actief
//      wit, de rest grijs); de andere vierkantjes lichten om de beurt op met een uitdijende ring, zoals de
//      wereldkaart op About.
//   3. Flare: rasterlijnen lichten wit op rond de muis, lichtvlek loopt vertraagd mee (alleen muis).
//   Altijd (ook bij minder beweging): viewBox per breedte, klok linksonder (Nederlandse tijd).
// Waarom een script: raster en punten zitten in een SVG over de foto, wisselen vraagt een vizier dat
// vanaf zijn huidige plek verder schuift, en IX3 kent geen lichtvlek die de muis volgt.
//
// Markup (binnen .contact-map_wrap):
//   svg[data-contact-map]                 data-vb-desktop / data-vb-compact (≤ 991 px) / data-vb-band (rem)
//     .cm-v / .cm-h  rasterlijnen
//     .cm-square[data-cm-place=key][data-lat][data-lon]      .cm-target  vizier (translate in kaarteenheden)
//   button.contact-map_marker[data-place=key] › .contact-map_marker_label (naam; + is-active / is-hover)
//   .contact-map_card[data-place=key] (+ is-active)
//   [data-contact-map-time]  [data-contact-map-coords]   .contact-map_panel (formulier, kaart blijft ernaast)

(() => {
  const EASE = 'cubic-bezier(0.75, 0, 0.5, 1)';
  const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 1)';
  const EASE_OUT = 'cubic-bezier(0.25, 1, 0.5, 1)';
  const NS = 'http://www.w3.org/2000/svg';
  const FLARE_RADIUS = '15rem';
  const FLARE_COLOR = 'rgba(255, 255, 255, 0.95)';
  const FLARE_FOLLOW = 0.06;
  const MOVE_MS = 1300;
  const PULSE_MS = 2400;
  const GAP = 18;    // px tussen vierkantje en adreskaart
  const EDGE = 14;   // px vrij van de rand van de kaart

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const compact = window.matchMedia('(max-width: 991px)');
  const canAnimate = () => !reduce.matches && 'animate' in Element.prototype;

  function play(el, frames, opts) {
    const a = el.animate(frames, { fill: 'both', ...opts });
    a.finished.then(() => {
      const last = frames[frames.length - 1];
      for (const k in last) if (k !== 'offset' && k !== 'easing') el.style[k] = last[k];
      a.cancel();
    }).catch(() => {});
    return a;
  }
  const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));

  function dms(v, pos, neg) {
    const a = Math.abs(v);
    let d = Math.floor(a), m = Math.round((a - d) * 60);
    if (m === 60) { d += 1; m = 0; }
    return `${d}°${String(m).padStart(2, '0')}′ ${v >= 0 ? pos : neg}`;
  }
  const readout = (lat, lon) => `${dms(lat, 'N', 'S')}, ${dms(lon, 'E', 'W')}`;

  // Klok: ISO-notatie in Nederlandse tijd, zoals Figma (2026-06-04T10:30:17+01:00).
  function nlTime() {
    const now = new Date();
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]));
    const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const off = Math.round((local - Math.floor(now.getTime() / 1000) * 1000) / 60000);
    const sign = off >= 0 ? '+' : '-', oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'), om = String(Math.abs(off) % 60).padStart(2, '0');
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${oh}:${om}`;
  }

  // Kaarteenheden → pixels binnen de sectie.
  function toLocal(svg, wrap, x, y) {
    const m = svg.getScreenCTM(), r = wrap.getBoundingClientRect();
    if (!m) return { x: 0, y: 0 };
    return { x: m.a * x + m.c * y + m.e - r.left, y: m.b * x + m.d * y + m.f - r.top };
  }

  // viewBox per breedte (desktop / ≤ 991 px). Geen letters en cijfers langs de rand: op About weggehaald
  // ("te druk", feedback 2026-10-20), hier dus ook niet.
  // ≤ 991 loopt de kaart door achter de adreskaart en het formulier (Afrika, zoals Figma mobiel). De
  // bovenste band (data-vb-band, in rem) toont data-vb-compact zoals voorheen (meet); daaronder loopt de
  // kaart op dezelfde schaal door tot de onderkant van het vak.
  function layoutSvg(svg) {
    let vb = compact.matches ? svg.dataset.vbCompact : svg.dataset.vbDesktop;
    const r = svg.getBoundingClientRect();
    if (vb && compact.matches && r.width && r.height) {
      const [x, y, w, h] = vb.split(/\s+/).map(Number);
      const band = (parseFloat(svg.dataset.vbBand) || 0) * parseFloat(getComputedStyle(document.documentElement).fontSize) || r.height;
      const s = Math.min(r.width / w, Math.min(band, r.height) / h);
      const vw = r.width / s, vh = r.height / s;
      vb = `${(x + w / 2 - vw / 2).toFixed(1)} ${y} ${vw.toFixed(1)} ${vh.toFixed(1)}`;
    }
    if (vb && svg.getAttribute('viewBox') !== vb) svg.setAttribute('viewBox', vb);
    // Verticale lijnen lopen ≤ 991 door tot data-vb-line-end; op desktop houden ze hun lengte (zelfde tekensnelheid).
    const end = svg.dataset.vbLineEnd;
    if (end) svg.querySelectorAll('.cm-v').forEach((l) => {
      if (!l.dataset.y2) l.dataset.y2 = l.getAttribute('y2');
      l.setAttribute('y2', compact.matches ? end : l.dataset.y2);
    });
  }

  function flare(svg, wrap) {
    const layer = document.createElementNS(NS, 'svg');
    for (const a of ['viewBox', 'preserveAspectRatio']) layer.setAttribute(a, svg.getAttribute(a));
    layer.setAttribute('class', 'contact-map_svg');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('focusable', 'false');
    const g = svg.querySelector('.cm-grid').cloneNode(true);
    g.querySelectorAll('line').forEach((l) => {
      l.removeAttribute('class'); l.removeAttribute('style');
      l.setAttribute('stroke', FLARE_COLOR); l.setAttribute('stroke-width', '1');
      l.setAttribute('vector-effect', 'non-scaling-stroke');
    });
    layer.appendChild(g);
    Object.assign(layer.style, { opacity: '0', transition: 'opacity 400ms cubic-bezier(0.5, 0, 0.5, 1)' });
    svg.after(layer);
    new MutationObserver(() => layer.setAttribute('viewBox', svg.getAttribute('viewBox')))
      .observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    let raf = 0, mx = 0, my = 0, cx = 0, cy = 0, inside = false, ready = false, placed = false;
    function paint() {
      raf = 0;
      const r = layer.getBoundingClientRect();
      const tx = mx - r.left, ty = my - r.top;
      const over = inside && tx >= 0 && ty >= 0 && tx <= r.width && ty <= r.height;
      if (!ready || !over) { layer.style.opacity = '0'; placed = false; return; }
      if (!placed) { cx = tx; cy = ty; placed = true; }
      cx += (tx - cx) * FLARE_FOLLOW; cy += (ty - cy) * FLARE_FOLLOW;
      const mask = `radial-gradient(circle ${FLARE_RADIUS} at ${cx}px ${cy}px, #000 0%, rgba(0, 0, 0, 0.5) 35%, transparent 100%)`;
      layer.style.maskImage = mask;
      layer.style.webkitMaskImage = mask;
      layer.style.opacity = '1';
      if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) raf = requestAnimationFrame(paint);
    }
    wrap.addEventListener('pointermove', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      inside = true; mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    });
    wrap.addEventListener('pointerleave', () => { inside = false; placed = false; layer.style.opacity = '0'; });
    return { ready() { ready = true; } };
  }

  function setup(wrap) {
    const svg = wrap.querySelector('svg[data-contact-map]');
    if (!svg || wrap.dataset.contactMapReady) return;
    wrap.dataset.contactMapReady = 'true';
    const target = svg.querySelector('.cm-target');
    const coords = wrap.querySelector('[data-contact-map-coords]');
    const time = wrap.querySelector('[data-contact-map-time]');
    const panel = wrap.querySelector('.contact-map_panel');
    const places = [...svg.querySelectorAll('[data-cm-place]')].map((sq) => {
      const key = sq.dataset.cmPlace;
      return {
        key, sq, lat: +sq.dataset.lat, lon: +sq.dataset.lon,
        x: +sq.getAttribute('x') + 12, y: +sq.getAttribute('y') + 12,
        btn: wrap.querySelector(`.contact-map_marker[data-place="${key}"]`),
        label: wrap.querySelector(`.contact-map_marker[data-place="${key}"] .contact-map_marker_label`),
        card: wrap.querySelector(`.contact-map_card[data-place="${key}"]`),
      };
    });
    let active = places.find((p) => p.card && p.card.classList.contains('is-active')) || places[0];
    let busy = false;
    let queued = null; // klik tijdens het schuiven: na afloop alsnog uitvoeren

    // Klok
    if (time) { time.textContent = nlTime(); window.setInterval(() => { if (!document.hidden) time.textContent = nlTime(); }, 1000); }
    if (coords) coords.textContent = readout(active.lat, active.lon);

    // Knoppen op de vierkantjes en de adreskaart naast het actieve vierkantje.
    function placeCard(p) {
      const c = p.card;
      if (!c) return;
      if (compact.matches) { c.style.left = ''; c.style.top = ''; c.style.transformOrigin = ''; return; }
      const pt = toLocal(svg, wrap, p.x, p.y);
      const w = c.offsetWidth, h = c.offsetHeight, W = wrap.clientWidth, H = wrap.clientHeight;
      const pr = panel ? panel.getBoundingClientRect() : null, wr = wrap.getBoundingClientRect();
      const block = pr ? { l: pr.left - wr.left - EDGE, t: pr.top - wr.top - EDGE, r: pr.right - wr.left + EDGE, b: pr.bottom - wr.top + EDGE } : null;
      const prefLeft = p.key === 'pms';
      const cands = [];
      for (const left of prefLeft ? [true, false] : [false, true]) for (const up of [false, true]) {
        cands.push({ x: left ? pt.x - GAP - w : pt.x + GAP, y: up ? pt.y - GAP - h : pt.y + GAP });
      }
      const fits = (q) => q.x >= EDGE && q.y >= EDGE + 80 && q.x + w <= W - EDGE && q.y + h <= H - EDGE - 40
        && !(block && q.x < block.r && q.x + w > block.l && q.y < block.b && q.y + h > block.t);
      const q = { ...(cands.find(fits) || cands[0]) };
      // Past nergens helemaal (smal desktopscherm): binnen de kaart en links van het formulier houden.
      const maxX = (block ? block.l : W - EDGE) - w;
      q.x = Math.max(EDGE, Math.min(q.x, maxX));
      q.y = Math.max(EDGE + 80, Math.min(q.y, H - EDGE - 40 - h));
      c.style.left = `${Math.round(q.x)}px`;
      c.style.top = `${Math.round(q.y)}px`;
      // De kaart groeit uit de hoek die het dichtst bij het vierkantje ligt (NL rechtsboven, ES linksonder).
      c.style.transformOrigin = `${q.x + w / 2 < pt.x ? '100%' : '0%'} ${q.y + h / 2 < pt.y ? '100%' : '0%'}`;
    }
    function placeMarkers() {
      places.forEach((p) => {
        if (!p.btn) return;
        const pt = toLocal(svg, wrap, p.x, p.y);
        p.btn.style.left = `${pt.x.toFixed(1)}px`;
        p.btn.style.top = `${pt.y.toFixed(1)}px`;
      });
    }
    // Namen staan rechts van hun vierkantje; botst een naam met een ander vierkantje, een andere naam of de
    // open adreskaart, dan gaat hij links (is-left). Op mobiel liggen PMS en TYMO dicht bij elkaar.
    const hit = (a, b, m = 0) => a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;
    function placeLabels() {
      const taken = [];
      const cardBox = active.card && !compact.matches ? active.card.getBoundingClientRect() : null;
      places.forEach((p) => {
        const l = p.label;
        if (!l) return;
        l.classList.remove('is-left');
        const others = places.filter((q) => q !== p).map((q) => q.btn && q.btn.getBoundingClientRect())
          .filter(Boolean).map((r) => { const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2; return { left: cx - 8, right: cx + 8, top: cy - 8, bottom: cy + 8 }; });
        const clear = (r) => !others.some((o) => hit(r, o, 4)) && !taken.some((t) => hit(r, t, 4)) && !(cardBox && hit(r, cardBox, 4));
        let r = l.getBoundingClientRect();
        if (!clear(r)) {
          l.classList.add('is-left');
          const left = l.getBoundingClientRect();
          if (clear(left)) r = left; else l.classList.remove('is-left');
        }
        taken.push(r);
      });
    }
    function layout() { layoutSvg(svg); placeMarkers(); placeCard(active); placeLabels(); }
    function setState(p) {
      places.forEach((q) => {
        const on = q === p;
        q.sq.classList.toggle('is-active', on);
        if (q.btn) q.btn.setAttribute('aria-expanded', String(on));
        if (q.label) q.label.classList.toggle('is-active', on);
        if (q.card) q.card.classList.toggle('is-active', on);
      });
    }
    setState(active);
    layout();
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(wrap);
    else window.addEventListener('resize', layout);
    compact.addEventListener('change', layout);

    async function select(p) {
      if (busy) { queued = p; return; }
      if (p === active) return;
      busy = true;
      const from = active;
      const anim = canAnimate();
      if (anim && from.card) await play(from.card, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }],
        { duration: 250, easing: EASE_IN }).finished.catch(() => {});
      if (from.card) { from.card.classList.remove('is-active'); from.card.style.transform = ''; from.card.style.opacity = ''; }
      from.sq.classList.remove('is-active');
      if (anim) {
        const move = play(target, [
          { transform: `translate(${from.x}px, ${from.y}px)` },
          { transform: `translate(${p.x}px, ${p.y}px)` },
        ], { duration: MOVE_MS, easing: EASE });
        const t0 = performance.now();
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        let raf = 0;
        const step = (now) => {
          const t = Math.min(1, Math.max(0, (now - t0) / MOVE_MS)), e = ease(t);
          if (coords) coords.textContent = readout(from.lat + (p.lat - from.lat) * e, from.lon + (p.lon - from.lon) * e);
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        await move.finished.catch(() => {});
        cancelAnimationFrame(raf);
      } else {
        target.style.transform = `translate(${p.x}px, ${p.y}px)`;
      }
      if (coords) coords.textContent = readout(p.lat, p.lon);
      active = p;
      setState(p);
      placeCard(p);
      placeLabels();
      if (anim && p.card) play(p.card, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 450, easing: EASE });
      busy = false;
      const next = queued;
      queued = null;
      if (next && next !== active) select(next);
    }
    const hover = (p, on) => {
      p.sq.classList.toggle('is-hover', on && p !== active);
      if (p.label) p.label.classList.toggle('is-hover', on && p !== active);
    };
    places.forEach((p) => {
      if (!p.btn) return;
      p.btn.addEventListener('click', () => { hover(p, false); select(p); });
      p.btn.addEventListener('pointerenter', () => hover(p, true));
      p.btn.addEventListener('pointerleave', () => hover(p, false));
      p.btn.addEventListener('focus', () => hover(p, true));
      p.btn.addEventListener('blur', () => hover(p, false));
    });

    if (!canAnimate()) return;

    // Opbouw (bij laden: de kaart staat bovenaan de pagina)
    const v = [...svg.querySelectorAll('.cm-v')], h = [...svg.querySelectorAll('.cm-h')];
    v.forEach((l) => (l.style.transform = 'scaleY(0)'));
    h.forEach((l) => (l.style.transform = 'scaleX(0)'));
    places.forEach((p) => (p.sq.style.opacity = '0'));
    svg.querySelectorAll('.cm-cross').forEach((l) => (l.style.transform = l.classList.contains('cm-cross-v') ? 'scaleY(0)' : 'scaleX(0)'));
    const frame = target.querySelector('.cm-frame');
    frame.style.transform = 'scale(0)';
    const meta = [time, coords].filter(Boolean);
    const labels = places.map((p) => p.label).filter(Boolean);
    labels.forEach((l) => (l.style.opacity = '0'));
    meta.forEach((m) => (m.style.opacity = '0'));
    if (active.card) active.card.style.transform = 'scale(0)';

    const fl = finePointer.matches ? flare(svg, wrap) : null;
    async function build() {
      v.forEach((l, i) => play(l, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 750, delay: i * 40, easing: EASE }));
      h.forEach((l, i) => play(l, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 750, delay: 120 + i * 40, easing: EASE }));
      places.forEach((p, i) => {
        p.sq.style.opacity = '';
        const end = p === active ? 'scale(0.833)' : 'scale(1)';
        play(p.sq, [{ transform: 'scale(0)' }, { transform: end }], { duration: 600, delay: 500 + i * 90, easing: EASE })
          .finished.then(() => { p.sq.style.transform = ''; });
      });
      svg.querySelectorAll('.cm-cross').forEach((l) => {
        const ax = l.classList.contains('cm-cross-v') ? 'scaleY' : 'scaleX';
        play(l, [{ transform: `${ax}(0)` }, { transform: `${ax}(1)` }], { duration: 900, delay: 900, easing: EASE });
      });
      play(frame, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 450, delay: 1350, easing: EASE });
      if (active.card) play(active.card, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 750, delay: 1500, easing: EASE });
      meta.forEach((m) => play(m, [{ opacity: '0' }, { opacity: '1' }], { duration: 500, delay: 600, easing: 'linear' }));
      labels.forEach((l, i) => play(l, [{ opacity: '0' }, { opacity: '1' }], { duration: 500, delay: 900 + i * 90, easing: 'linear' }));
      await wait(1100 + Math.max(v.length, h.length) * 40);
    }

    // Vierkantjes die je kunt aanklikken lichten om de beurt op, zolang de kaart te zien is: het vierkantje
    // groeit en een ring (omtrek van het vierkantje) dijt uit en vervaagt, zoals de wereldkaart op About.
    let visible = true, built = false, turn = 0;
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0.15 }).observe(wrap);
    function pulse() {
      if (built && visible && !document.hidden && !busy) {
        const others = places.filter((p) => p !== active);
        const p = others[turn++ % others.length];
        if (p && !p.sq.classList.contains('is-hover')) {
          const ring = p.sq.cloneNode();
          ring.removeAttribute('class');
          ring.removeAttribute('style');
          Object.assign(ring.style, {
            fill: 'none', stroke: 'var(--_theme---text, #f0f2f4)', strokeWidth: '1', vectorEffect: 'non-scaling-stroke',
            transformBox: 'fill-box', transformOrigin: '50% 50%', scale: getComputedStyle(p.sq).scale, pointerEvents: 'none',
          });
          p.sq.before(ring);
          ring.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(3.2)', opacity: 0 }],
            { duration: 1600, easing: EASE_OUT }).finished.then(() => ring.remove(), () => ring.remove());
          p.sq.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.9)', offset: 0.4 }, { transform: 'scale(1)' }],
            { duration: 1100, easing: EASE });
        }
      }
      window.setTimeout(pulse, PULSE_MS);
    }
    build().then(() => {
      built = true;
      if (fl) fl.ready();
      window.setTimeout(pulse, 800);
    });
  }

  function init() { document.querySelectorAll('.contact-map_wrap').forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
