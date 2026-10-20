// Network Map: wat Webflow Interactions (IX3) niet kunnen bij de netwerkkaart (Our service).
// De opbouw bij in beeld komen (lijnen groeien, coördinaten, vierkantjes) is IX3; dit script doet:
//   1. Oplichten: zolang de kaart in beeld is lichten de vierkantjes om de beurt op (groeien vanuit
//      hun midden in en weer uit, zonder gloed), een paar tegelijk, in willekeurige volgorde.
//   2. Flare: de rasterlijnen lichten wit op rond de muis; de lichtvlek loopt met vertraging achter de
//      muis aan (zoals Story Map op About us).
// Het groeien van een vierkantje bij hover is een stijl-overgang (Lumos-trigger op .network-map_dot).
//
// Webflow-markup (component Network Map):
//   [data-network-map]          het kader (luistert naar de muis, in-beeld-meting)
//   [data-network-map-visual]   de beeldlaag (kaart, raster, vierkantjes); hier komt de flare-laag in
//   .network-map_line-v / -h    rasterlijnen (posities worden uitgelezen, niet aangepast)
//   .network-map_dot-square     het zichtbare vierkantje van een locatie
//
// Touch (geen hover/fijne aanwijzer): geen flare, oplichten blijft. prefers-reduced-motion: niets
// (IX3 staat dan ook uit, alles staat direct stil in beeld). Laadt niets zelf; geen GSAP nodig
// (Web Animations API voor het oplichten, CSS-mask voor de flare).

const PULSE_MS = 1500;
const FLARE_RADIUS = '15rem';
const LINE_COLOR = 'rgba(255, 255, 255, 0.95)';
const FLARE_FOLLOW = 0.06; // deel van de afstand tot de muis per frame: de lichtvlek loopt zichtbaar achter de muis aan

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

// Is een element volledig opgebouwd (IX3 heeft de schaal op 1 gezet)? Echte maat t.o.v. de layoutmaat;
// offsetWidth/-Height zijn afgerond op hele pixels, dus 1,5 px speling (vierkantjes zijn ±10 px).
function grown(el) {
  if (!el || !el.offsetWidth) return false;
  const r = el.getBoundingClientRect();
  return r.width >= el.offsetWidth - 1.5 && r.height >= el.offsetHeight - 1.5;
}

function setupPulse(frame) {
  const squares = [...frame.querySelectorAll('.network-map_dot-square')];
  if (!squares.length || !('animate' in squares[0])) return null;
  const busy = new Set();
  let timer = 0;
  let running = false;

  function pulseOne() {
    const free = squares.filter((s) => !busy.has(s) && grown(s.parentElement));
    if (!free.length) return;
    const sq = free[Math.floor(Math.random() * free.length)];
    busy.add(sq);
    const anim = sq.animate(
      [
        { scale: '1' },
        { scale: '1.9', offset: 0.45 },
        { scale: '1' },
      ],
      { duration: PULSE_MS * (0.85 + Math.random() * 0.3), easing: 'cubic-bezier(0.5, 0, 0.5, 1)' }
    );
    anim.onfinish = anim.oncancel = () => busy.delete(sq);
  }

  function tick() {
    if (!running) return;
    const n = Math.random() < 0.25 ? 3 : Math.random() < 0.6 ? 2 : 1;
    for (let i = 0; i < n; i++) pulseOne();
    timer = window.setTimeout(tick, 450 + Math.random() * 550);
  }

  return {
    start() { if (running) return; running = true; timer = window.setTimeout(tick, 300); },
    stop() { running = false; window.clearTimeout(timer); },
  };
}

function setupFlare(frame) {
  const visual = frame.querySelector('[data-network-map-visual]');
  if (!visual) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  Object.assign(svg.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none',
    opacity: '0', transition: 'opacity 400ms cubic-bezier(0.5, 0, 0.5, 1)', zIndex: '1',
  });
  visual.appendChild(svg);

  // Lijnposities uit de layout (offsets negeren transforms, dus ook tijdens de IX3-opbouw juist).
  function offsetIn(el, root) {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y };
  }
  function draw() {
    const w = visual.clientWidth, h = visual.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.textContent = '';
    const add = (x1, y1, x2, y2) => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('stroke', LINE_COLOR); l.setAttribute('stroke-width', '1');
      l.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(l);
    };
    visual.querySelectorAll('.network-map_line-v').forEach((el) => {
      const { x } = offsetIn(el, visual);
      if (x > 0 && x < w) add(x + 0.5, 0, x + 0.5, h);
    });
    visual.querySelectorAll('.network-map_line-h').forEach((el) => {
      const { y } = offsetIn(el, visual);
      if (y > 0 && y < h) add(0, y + 0.5, w, y + 0.5);
    });
  }
  draw();
  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(visual);

  const firstLine = visual.querySelector('.network-map_line-v');
  // De lichtvlek volgt de muis met vertraging (zachte inhaal per frame), zodat hij opvalt.
  let raf = 0, mx = 0, my = 0, cx = 0, cy = 0, inside = false, placed = false;
  function paint() {
    raf = 0;
    const r = visual.getBoundingClientRect();
    const tx = mx - r.left, ty = my - r.top;
    const over = inside && tx >= 0 && ty >= 0 && tx <= r.width && ty <= r.height;
    // Pas na de opbouw (lijnen gegroeid) en alleen boven de kaart.
    if (!over || !grown(firstLine)) { svg.style.opacity = '0'; placed = false; return; }
    if (!placed) { cx = tx; cy = ty; placed = true; }
    cx += (tx - cx) * FLARE_FOLLOW; cy += (ty - cy) * FLARE_FOLLOW;
    const mask = `radial-gradient(circle ${FLARE_RADIUS} at ${cx}px ${cy}px, #000 0%, rgba(0, 0, 0, 0.5) 35%, transparent 100%)`;
    svg.style.maskImage = mask;
    svg.style.webkitMaskImage = mask;
    svg.style.opacity = '1';
    if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) raf = requestAnimationFrame(paint);
  }
  frame.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    inside = true; mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
  });
  frame.addEventListener('pointerleave', () => { inside = false; placed = false; svg.style.opacity = '0'; });
}

function init() {
  if (reduce.matches) return;
  document.querySelectorAll('[data-network-map]').forEach((frame) => {
    if (frame.dataset.networkMapReady) return;
    frame.dataset.networkMapReady = 'true';
    const pulse = setupPulse(frame);
    if (finePointer.matches) setupFlare(frame);
    if (!pulse) return;
    let visible = false;
    const sync = () => (visible && !document.hidden ? pulse.start() : pulse.stop());
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.15 }).observe(frame);
    document.addEventListener('visibilitychange', sync);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
