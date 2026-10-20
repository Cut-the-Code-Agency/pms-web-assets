// Story Map: de bewegende kaarten in de Story Slides (About us, dia "Europe" en dia "World").
// De kaart zelf is de foto van de dia (zonder raster); daarboven staat per kaart een inline SVG
// (Webflow-component Story Map Europe / Story Map World, HtmlEmbed) met raster, coördinaten,
// vierkantjes en (Europe) een vizier. Die SVG staat in rust al in de eindstand, dus zonder script
// of met "minder beweging" ziet de kaart eruit zoals in Figma. Dit script:
//   1. Opbouw zodra de dia in beeld schuift: lijnen tekenen (verticaal van boven, horizontaal van
//      links, na elkaar), coördinaten en teksten faden in, vierkantjes groeien in.
//   2. Europe: het vizier pakt Nederland, schuift dan naar Duitsland en Spanje en terug, zolang de
//      dia zichtbaar is; de coördinaten rechtsonder lopen mee, de tijd linksonder tikt.
//   World: de vierkantjes lichten om de beurt op (vierkantje groeit, ring dijt uit en vervaagt).
//   Beide: de tijd linksonder tikt per seconde.
//   3. Flare: de rasterlijnen lichten wit op rond de muis; de lichtvlek loopt met vertraging achter de
//      muis aan (alleen bij een muis).
//   Altijd (ook bij minder beweging): randteksten blijven aan de rand van het scherm (data-pin).
// Waarom een script en geen IX3: de onderdelen zitten in een SVG (alleen zo blijft het raster op elke
// schermmaat precies op de foto, net als object-fit: cover), IX3 kent geen lus "zolang in beeld" en
// geen lichtvlek die de muis volgt. Laadt niets zelf; Web Animations API.
//
// Markup: svg.story-map_svg[data-story-map="europe"|"world"] ergens in een .story-slide_wrap.
//   .sm-v / .sm-h        rasterlijnen          .sm-label   letters/cijfers (optioneel, nu niet gebruikt)
//   .sm-square           vierkantje            .sm-frame   kader (Europe: van het vizier; World: per stip)
//   .sm-target           vizier (Europe), transform translate(x, y) in kaartpixels
//   [data-sm-dot]        locatie; Europe met data-lat / data-lon voor de uitlezing
//   .sm-time / .sm-coord teksten in de hoeken onder (tijd tikt; Europe: coördinaten volgen het vizier)

(() => {
  const EASE = 'cubic-bezier(0.75, 0, 0.5, 1)';
  const EASE_OUT = 'cubic-bezier(0.25, 1, 0.5, 1)';
  const NS = 'http://www.w3.org/2000/svg';
  const FLARE_RADIUS = '15rem';
  const FLARE_COLOR = 'rgba(255, 255, 255, 0.95)';
  const FLARE_FOLLOW = 0.06; // deel van de afstand tot de muis per frame: de lichtvlek loopt zichtbaar achter de muis aan
  const HOLD_MS = 2600;   // Europe: zo lang blijft het vizier op een land staan
  const MOVE_MS = 1300;   // Europe: verschuiven naar het volgende land
  const STEP_MS = 1100;   // World: tijd tussen twee stippen

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // Animatie die zijn eindstand vasthoudt als inline stijl (zodat een volgende animatie daar verder gaat).
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

  // Is de dia echt te zien (niet bedekt door de volgende sticky dia, niet buiten beeld)?
  function shown(slide) {
    const r = slide.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) return false;
    const next = slide.nextElementSibling;
    return !(next && next.getBoundingClientRect().top <= 0);
  }

  // Ligt een kaartpunt binnen het zichtbare deel van de SVG? (Op een staand scherm valt een deel van de
  // kaart weg door de uitsnede; daar slaat het vizier die landen over.)
  function inView(svg, x, y) {
    const m = svg.getScreenCTM(), r = svg.getBoundingClientRect();
    if (!m) return true;
    const sx = m.a * x + m.c * y + m.e, sy = m.b * x + m.d * y + m.f;
    const mx = r.width * 0.06, my = r.height * 0.06;
    return sx >= r.left + mx && sx <= r.right - mx && sy >= r.top + my && sy <= r.bottom - my;
  }

  function hideAll(svg) {
    svg.querySelectorAll('.sm-v').forEach((l) => (l.style.transform = 'scaleY(0)'));
    svg.querySelectorAll('.sm-h').forEach((l) => (l.style.transform = 'scaleX(0)'));
    svg.querySelectorAll('text, .sm-meta-group').forEach((t) => (t.style.opacity = '0'));
    svg.querySelectorAll('.sm-square, .sm-dot .sm-frame').forEach((q) => (q.style.transform = 'scale(0)'));
    svg.querySelectorAll('.sm-cross-v').forEach((l) => (l.style.transform = 'scaleY(0)'));
    svg.querySelectorAll('.sm-cross-h').forEach((l) => (l.style.transform = 'scaleX(0)'));
    svg.querySelectorAll('.sm-target .sm-frame').forEach((f) => (f.style.transform = 'scale(0)'));
  }

  // Opbouw; resolves als het raster staat (dan mag de lus en de flare beginnen).
  async function build(svg) {
    const kind = svg.dataset.storyMap;
    const v = [...svg.querySelectorAll('.sm-v')], h = [...svg.querySelectorAll('.sm-h')];
    v.forEach((l, i) => play(l, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 750, delay: i * 40, easing: EASE }));
    h.forEach((l, i) => play(l, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 750, delay: 120 + i * 40, easing: EASE }));
    svg.querySelectorAll('.sm-label').forEach((t, i) =>
      play(t, [{ opacity: '0' }, { opacity: '1' }], { duration: 400, delay: 350 + i * 15, easing: 'linear' }));
    svg.querySelectorAll('.sm-meta, .sm-meta-group').forEach((t) =>
      play(t, [{ opacity: '0' }, { opacity: '1' }], { duration: 500, delay: 600, easing: 'linear' }));
    const squares = [...svg.querySelectorAll('.sm-square')];
    squares.forEach((q, i) => {
      const end = q.closest('.sm-dot') || !q.dataset.smDot || q.dataset.smDot !== 'nl' ? 'scale(1)' : 'scale(0.79)';
      play(q, [{ transform: 'scale(0)' }, { transform: end }], { duration: 600, delay: 500 + i * 90, easing: EASE });
    });
    svg.querySelectorAll('.sm-dot .sm-frame').forEach((f, i) =>
      play(f, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 600, delay: 600 + i * 90, easing: EASE }));
    if (kind === 'europe') {
      const cv = svg.querySelector('.sm-cross-v'), ch = svg.querySelector('.sm-cross-h'), fr = svg.querySelector('.sm-target .sm-frame');
      play(cv, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 900, delay: 900, easing: EASE });
      play(ch, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 900, easing: EASE });
      play(fr, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 450, delay: 1350, easing: EASE });
    }
    await wait(1100 + Math.max(v.length, h.length) * 40);
  }

  // Klok linksonder (beide kaarten): tikt per seconde zolang de kaart te zien is.
  function clock(svg, slide) {
    const time = svg.querySelector('.sm-time');
    let timer = 0;
    if (!time) return { start() {}, stop() {} };
    const base = time.textContent;
    const m = base.match(/T(\d\d):(\d\d):(\d\d)/);
    let secs = m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
    const p = (n) => String(n).padStart(2, '0');
    function tick() {
      if (!shown(slide)) return;
      secs = (secs + 1) % 86400;
      time.textContent = base.replace(/T\d\d:\d\d:\d\d/, `T${p(Math.floor(secs / 3600))}:${p(Math.floor(secs / 60) % 60)}:${p(secs % 60)}`);
    }
    return {
      start() { if (!timer) timer = window.setInterval(tick, 1000); },
      stop() { window.clearInterval(timer); timer = 0; },
    };
  }

  // Europe: vizier van land naar land.
  function europeLoop(svg, slide) {
    const target = svg.querySelector('.sm-target');
    const frame = target.querySelector('.sm-frame');
    const coord = svg.querySelector('.sm-coord');
    const dots = [...svg.querySelectorAll('[data-sm-dot]')].map((q) => ({
      el: q, lat: +q.dataset.lat, lon: +q.dataset.lon,
      x: +q.getAttribute('x') + +q.getAttribute('width') / 2, y: +q.getAttribute('y') + +q.getAttribute('height') / 2,
    }));
    let at = 0, running = false, busy = false, timer = 0;

    async function next() {
      if (!running || busy) return;
      if (!shown(slide)) { timer = window.setTimeout(next, 500); return; }
      let n = 1;
      while (n < dots.length && !inView(svg, dots[(at + n) % dots.length].x, dots[(at + n) % dots.length].y)) n += 1;
      if (n >= dots.length) { timer = window.setTimeout(next, HOLD_MS); return; }
      busy = true;
      const from = dots[at], to = dots[(at + n) % dots.length];
      at = (at + n) % dots.length;
      play(frame, [{ transform: 'scale(1)' }, { transform: 'scale(0)' }], { duration: 250, easing: EASE });
      play(from.el, [{ transform: 'scale(0.79)' }, { transform: 'scale(1)' }], { duration: 250, easing: EASE });
      const move = play(target, [
        { transform: `translate(${from.x}px, ${from.y}px)` },
        { transform: `translate(${to.x}px, ${to.y}px)` },
      ], { duration: MOVE_MS, delay: 150, easing: EASE });
      // Uitlezing loopt mee met het vizier.
      const t0 = performance.now() + 150;
      const ease = (t) => { // benadering van de merkcurve voor de getallen
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      let raf = 0;
      const step = (now) => {
        const t = Math.min(1, Math.max(0, (now - t0) / MOVE_MS)), e = ease(t);
        if (coord) coord.textContent = readout(from.lat + (to.lat - from.lat) * e, from.lon + (to.lon - from.lon) * e);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      await move.finished.catch(() => {});
      cancelAnimationFrame(raf);
      if (coord) coord.textContent = readout(to.lat, to.lon);
      play(frame, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 450, easing: EASE });
      play(to.el, [{ transform: 'scale(1)' }, { transform: 'scale(0.79)' }], { duration: 450, easing: EASE });
      busy = false;
      if (running) timer = window.setTimeout(next, HOLD_MS);
    }
    return {
      start() {
        if (running) return; running = true;
        timer = window.setTimeout(next, HOLD_MS);
      },
      stop() { running = false; window.clearTimeout(timer); },
    };
  }

  // World: stippen om de beurt.
  function worldLoop(svg, slide) {
    const dots = [...svg.querySelectorAll('.sm-dot')];
    let i = 0, running = false, timer = 0;
    function pulse() {
      if (!running) return;
      const sqOf = (d) => d.querySelector('.sm-square');
      let n = 0;
      while (n < dots.length) {
        const q = sqOf(dots[(i + n) % dots.length]);
        if (inView(svg, +q.getAttribute('x') + 4, +q.getAttribute('y') + 4)) break;
        n += 1;
      }
      if (shown(slide) && n < dots.length) {
        const dot = dots[(i + n) % dots.length];
        i += n + 1;
        const sq = dot.querySelector('.sm-square'), fr = dot.querySelector('.sm-frame');
        const ring = fr.cloneNode();
        ring.removeAttribute('style');
        dot.insertBefore(ring, fr);
        ring.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(3.2)', opacity: 0 }],
          { duration: 1600, easing: EASE_OUT }).finished.then(() => ring.remove(), () => ring.remove());
        sq.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.9)', offset: 0.4 }, { transform: 'scale(1)' }],
          { duration: 1100, easing: EASE });
        fr.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)', offset: 0.4 }, { transform: 'scale(1)' }],
          { duration: 1100, easing: EASE });
      }
      timer = window.setTimeout(pulse, STEP_MS);
    }
    return {
      start() { if (running) return; running = true; timer = window.setTimeout(pulse, 400); },
      stop() { running = false; window.clearTimeout(timer); },
    };
  }

  // Flare: tweede SVG met dezelfde lijnen, wit, gemaskeerd rond de muis.
  function flare(svg, slide) {
    const layer = document.createElementNS(NS, 'svg');
    for (const a of ['viewBox', 'preserveAspectRatio']) layer.setAttribute(a, svg.getAttribute(a));
    layer.setAttribute('class', 'story-map_svg');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('focusable', 'false');
    const g = svg.querySelector('.sm-grid').cloneNode(true);
    g.querySelectorAll('line').forEach((l) => {
      l.removeAttribute('class'); l.removeAttribute('style');
      l.setAttribute('stroke', FLARE_COLOR); l.setAttribute('stroke-width', '1');
      l.setAttribute('vector-effect', 'non-scaling-stroke');
    });
    layer.appendChild(g);
    Object.assign(layer.style, { opacity: '0', transition: 'opacity 400ms cubic-bezier(0.5, 0, 0.5, 1)' });
    svg.after(layer);
    // De lichtvlek volgt de muis met vertraging (zachte inhaal per frame), zodat hij opvalt.
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
    slide.addEventListener('pointermove', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      inside = true; mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    });
    slide.addEventListener('pointerleave', () => { inside = false; placed = false; layer.style.opacity = '0'; });
    return { ready() { ready = true; } };
  }

  // Randteksten (letters boven, cijfers links, tijd en coördinaten in de hoeken) horen bij de rand van
  // het scherm, niet bij de foto: door de uitsnede (slice) valt anders een deel buiten beeld.
  // data-pin: t = boven, l = links, bl / br = hoek linksonder / rechtsonder. Verschuift via het
  // SVG-attribuut transform (de animaties gebruiken alleen opacity op deze elementen).
  function pin(svg) {
    const [, , vw, vh] = svg.getAttribute('viewBox').split(/[ ,]+/).map(Number);
    const els = [...svg.querySelectorAll('[data-pin]')];
    function layout() {
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const s = Math.max(r.width / vw, r.height / vh);
      const x0 = (vw - r.width / s) / 2, y0 = (vh - r.height / s) / 2; // weggesneden deel per kant
      els.forEach((el) => {
        const p = el.dataset.pin;
        const dx = p === 'l' || p === 'bl' ? x0 : p === 'br' ? -x0 : 0;
        const dy = p === 't' ? y0 : p === 'bl' || p === 'br' ? -y0 : 0;
        el.setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`);
      });
      // Letters/cijfers van een kolom of rij die (bijna) buiten beeld valt: weg, niet half tegen de rand.
      const edge = 18;
      els.forEach((el) => {
        if (el.dataset.pin !== 't' && el.dataset.pin !== 'l') return;
        el.removeAttribute('visibility');
        const b = el.getBoundingClientRect();
        const out = el.dataset.pin === 't'
          ? b.left < r.left + edge || b.right > r.right - edge // letters: kolom aan de zijkant weg
          : b.top < r.top + edge || b.bottom > r.bottom - edge; // cijfers: rij boven of onder weg
        if (out) el.setAttribute('visibility', 'hidden');
      });
    }
    layout();
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(svg);
    else window.addEventListener('resize', layout);
  }

  function setup(svg) {
    if (svg.dataset.storyMapReady) return;
    svg.dataset.storyMapReady = 'true';
    const slide = svg.closest('.story-slide_wrap') || svg.parentElement;
    hideAll(svg);
    const motion = svg.dataset.storyMap === 'europe' ? europeLoop(svg, slide) : worldLoop(svg, slide);
    const ticker = clock(svg, slide);
    const loop = { start() { motion.start(); ticker.start(); }, stop() { motion.stop(); ticker.stop(); } };
    const fl = finePointer.matches ? flare(svg, slide) : null;
    let built = false, visible = false;
    const sync = () => (built && visible && !document.hidden ? loop.start() : loop.stop());
    // Opbouw zodra de bovenkant van de dia 65 % van het scherm passeert.
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      await build(svg);
      built = true;
      if (fl) fl.ready();
      sync();
    }, { rootMargin: '0px 0px -35% 0px' });
    io.observe(slide);
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.15 }).observe(slide);
    document.addEventListener('visibilitychange', sync);
  }

  function init() {
    const maps = document.querySelectorAll('svg[data-story-map]');
    maps.forEach(pin); // ook bij minder beweging: dit is opmaak, geen animatie
    if (reduce.matches || !('animate' in Element.prototype)) return;
    maps.forEach(setup);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
