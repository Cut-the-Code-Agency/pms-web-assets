// Stone travel: dezelfde reis als chromite-travel.js (hero → kleiner aan de rechterrand → landen in een slide),
// maar met de draaiende steen als doorzichtige video (AI-video, map spin/<slug>/) in plaats van een 3D-model.
// De video draait vanzelf; route, naloop, slidewissel, pijlknoppen en lichte titels werken zoals bij het 3D-model.
//
// Instellen op de script-tag (geen markup in Webflow nodig):
//   <script src=".../stone-travel.js" defer
//     data-stone-slug="foundry-grade-chromite-sand"                         ← video uit spin/<slug>/
//     data-stone-start=".home-hero_visual"                                  ← startvlak (daarin staat de foto als fallback)
//     data-stone-land="[data-slug='foundry-grade-chromite-sand'] .mineral-slide_visual" ← landingsvlak (alle kopieën)
//     data-stone-light=".home-hero_title.is-light, .mineral-slide_title.is-light"   ← lichte titels, alleen op de steen
//     data-stone-above=".slider_arrow_prev, .slider_arrow_next"             ← elementen die boven de steen blijven
//     data-stone-size="0.95"></script>                                      ← steen in het startvlak t.o.v. de kleinste zijde
// Landen: precies op de foto in het landingsvlak (object-fit: contain, vierkant beeld in dezelfde uitsnede).
// Minder beweging, geen video of geweigerd afspelen: alles blijft zoals Webflow het toont (foto + CSS-mask).

import { ease, clamp01, lerp, lerpPose, makeLightPainter } from './travel-common.js';

const PARK_SCALE = 0.6; // grootte aan de rechterrand t.o.v. het startvlak
const PARK_INSIDE = 0.65; // deel van de steen dat aan de rechterrand in beeld blijft
const PARK_INSIDE_MOBILE = -0.3; // mobiel/tablet: net buiten beeld
const LAND_START = 0.7; // desktop: landing begint als de landingssectie op deze hoogte van het scherm staat
const MOBILE_MAX = 991;
const DAMP = 8; // naloop van de scroll (hoger = strakker)

(() => {
  const script = document.currentScript;
  const cfg = script.dataset;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = document.querySelector(cfg.stoneStart);
  if (!start || !cfg.stoneSlug) return;
  const safari = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent);
  const src = new URL(`../spin/${cfg.stoneSlug}/spin.${safari ? 'mp4' : 'webm'}`, script.src).href;
  const heroSection = start.closest('section') || start.parentElement;
  const sizeFactor = parseFloat(cfg.stoneSize || '1');
  const landing = cfg.stoneLand || null;

  // Laag over de hele pagina, onder de navigatie (z-index 1000); klikken gaan erdoorheen
  const stage = document.createElement('div');
  stage.className = 'stone-travel_stage';
  stage.setAttribute('aria-hidden', 'true');
  Object.assign(stage.style, { position: 'fixed', inset: '0', zIndex: '999', pointerEvents: 'none', opacity: '0', transition: 'opacity .6s' });
  const canvas = document.createElement('canvas');
  const overlay = document.createElement('canvas');
  for (const c of [canvas, overlay]) Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  const video = document.createElement('video');
  video.muted = video.loop = video.playsInline = true;
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  video.preload = 'auto';
  video.src = src;
  // in de DOM houden (Safari decodeert anders niet), maar onzichtbaar
  Object.assign(video.style, { position: 'absolute', width: '2px', height: '2px', opacity: '0', left: '0', top: '0' });
  stage.append(video, canvas, overlay);
  const ctx = canvas.getContext('2d');
  const octx = overlay.getContext('2d');

  let vw = 0, vh = 0, dpr = 1;
  function resize() {
    vw = stage.clientWidth; vh = stage.clientHeight;
    if (!vw || !vh) return;
    dpr = Math.min(window.devicePixelRatio || 1, vw * vh > 1.2e6 ? 1.5 : 2);
    for (const c of [canvas, overlay]) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); }
  }

  // Landingsvlakken (de slider maakt kopieën van de slide) en lichte titels; opnieuw zoeken als de DOM verandert
  let targets = [], lights = [], ready = false;
  function collect() {
    targets = landing ? [...document.querySelectorAll(landing)] : [];
    const slides = targets.map(t => t.closest('.swiper-slide') || t);
    const known = new Set(lights.map(l => l.el));
    if (cfg.stoneLight) {
      for (const el of document.querySelectorAll(cfg.stoneLight)) {
        if (known.has(el)) continue;
        if (!heroSection.contains(el) && !slides.some(s => s.contains(el))) continue;
        lights.push({ el, color: getComputedStyle(el).color });
      }
    }
    if (ready) hideDom();
  }
  function hideDom() {
    for (const l of lights) l.el.style.setProperty('color', 'transparent', 'important');
    for (const t of targets) t.querySelectorAll('img').forEach(img => { img.style.opacity = '0'; });
  }

  // Poses in schermpixels: midden + zijde van het vierkante videobeeld
  const startPose = r => ({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: Math.min(r.width, r.height) * sizeFactor });
  function landPose(t) {
    // precies op de foto: vierkant beeld met object-fit: contain in de img
    const img = t.el.querySelector('img');
    const r = img ? img.getBoundingClientRect() : t.r;
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: Math.min(r.width, r.height) };
  }
  function currentTarget() {
    let best = null, bestD = Infinity;
    for (const t of targets) {
      const r = t.getBoundingClientRect();
      if (!r.width) continue;
      const sw = (t.closest('.swiper') || document.body).getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - (sw.left + sw.width / 2));
      if (d < bestD) { bestD = d; best = { el: t, r }; }
    }
    return best;
  }

  // Slidewissel: de laag krijgt dezelfde beweging als de Swiper-transition (zie chromite-travel.js)
  let slideAnim = null, lastCx = 0;
  const hooked = new WeakSet();
  const stageShift = () => {
    if (!slideAnim) return 0;
    const v = parseFloat(getComputedStyle(stage).translate);
    return Number.isFinite(v) ? v : 0;
  };
  function hookSwipers() {
    for (const t of targets) {
      const sw = t.closest('.swiper')?.swiper;
      if (!sw || hooked.has(sw)) continue;
      hooked.add(sw);
      let duration = 0;
      sw.on('setTransition', (s, d) => { duration = d; });
      sw.on('setTranslate', (s, translate) => {
        slideAnim?.cancel();
        slideAnim = null;
        if (!(duration > 0)) return;
        const m = new DOMMatrixReadOnly(getComputedStyle(s.wrapperEl).transform);
        const delta = (s.isHorizontal() ? translate - m.m41 : 0);
        if (!delta) return;
        const easing = getComputedStyle(s.wrapperEl).transitionTimingFunction || 'ease';
        const mid = vw / 2;
        const from = Math.abs(lastCx + delta - mid) < Math.abs(lastCx - mid) ? -delta : 0;
        slideAnim = stage.animate([{ translate: `${from}px 0` }, { translate: `${from + delta}px 0` }], { duration, easing, fill: 'forwards' });
      });
    }
  }

  const progress = { hero: 0, land: 0 };
  let first = true;
  const isMobile = () => vw <= MOBILE_MAX;
  function targetsNow() {
    const hr = heroSection.getBoundingClientRect();
    const hero = clamp01(-hr.top / hr.height);
    let land = 0, target = null;
    if (landing) {
      target = currentTarget();
      if (target) {
        const sec = (target.el.closest('section') || target.el).getBoundingClientRect();
        const cy = target.r.top + target.r.height / 2;
        const gap = Math.max(0, sec.top - hr.bottom);
        const from = Math.min(isMobile() ? vh : vh * LAND_START, gap);
        land = clamp01((from - sec.top) / Math.max(1, from - vh / 2 + cy - sec.top));
      }
    }
    return { hero, land, target, hr };
  }

  const aboveEls = cfg.stoneAbove ? [...document.querySelectorAll(cfg.stoneAbove)] : [];
  let lastClip = '', shift = 0;
  function clipAbove() {
    if (!aboveEls.length) return;
    let d = '';
    for (const el of aboveEls) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > vh || r.right - shift < 0 || r.left - shift > vw) continue;
      d += ` M${Math.round(r.left - shift)} ${Math.round(r.top)}h${Math.round(r.width)}v${Math.round(r.height)}h${-Math.round(r.width)}z`;
    }
    const clip = d ? `path(evenodd, "M${-vw} ${-vh}h${vw * 3}v${vh * 3}h${-vw * 3}z${d}")` : '';
    if (clip !== lastClip) { stage.style.clipPath = clip; lastClip = clip; }
  }

  function updatePose(dt) {
    const now = targetsNow();
    const k = first ? 1 : 1 - Math.exp(-dt * DAMP);
    first = false;
    for (const key of ['hero', 'land']) {
      progress[key] += (now[key] - progress[key]) * k;
      if (Math.abs(now[key] - progress[key]) < 1e-4) progress[key] = now[key];
    }
    // Desktop: vast op zijn plek in beeld zolang de hero scrolt, daarna kleiner aan de rechterrand.
    // Mobiel/tablet: scrolt mee met de hero en gaat naar net buiten beeld rechts.
    const mobile = isMobile();
    const sp = startPose(start.getBoundingClientRect());
    if (!mobile) sp.cy -= now.hr.top;
    const park = { size: sp.size * PARK_SCALE, cy: mobile ? sp.cy : vh / 2, cx: 0 };
    park.cx = vw + park.size * (0.5 - (mobile ? PARK_INSIDE_MOBILE : PARK_INSIDE));
    let pose = lerpPose(sp, park, ease(progress.hero));
    if (now.target && progress.land > 0) {
      const to = landPose(now.target);
      if (mobile) {
        const out = clamp01((pose.cx - pose.size * 0.5 - vw) / (pose.size * 0.2));
        pose = { ...pose, cy: lerp(pose.cy, to.cy, out) };
      }
      pose = lerpPose(pose, to, ease(progress.land));
    }
    // Geland in een vlak dat zelf doorzichtig is (niet-actieve kaart 0.7): steen even doorzichtig
    const landOp = now.target ? parseFloat(getComputedStyle(now.target.el).opacity) : 1;
    const op = String(+(1 - ease(progress.land) * (1 - landOp)).toFixed(3));
    if (canvas.style.opacity !== op) canvas.style.opacity = op;
    return pose;
  }

  const painter = makeLightPainter();
  function paintLights(pose) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const half = pose.size / 2;
    const sb = { l: pose.cx - half, t: pose.cy - half, r: pose.cx + half, b: pose.cy + half };
    const hits = lights.filter(l => {
      const r = l.el.getBoundingClientRect();
      return r.right > sb.l && r.left < sb.r && r.bottom > sb.t && r.top < sb.b;
    });
    if (!hits.length) return;
    octx.setTransform(dpr, 0, 0, dpr, -shift * dpr, 0);
    octx.textBaseline = 'alphabetic';
    painter.begin();
    for (const l of hits) { octx.fillStyle = l.color; painter.paint(octx, l); }
    // alleen houden waar de steen is
    octx.globalCompositeOperation = 'destination-in';
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.drawImage(canvas, 0, 0);
    octx.globalCompositeOperation = 'source-over';
  }

  let last = performance.now(), drawn = true;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000, 0.1);
    last = t;
    if (document.hidden || !vw) return;
    if (slideAnim && slideAnim.playState === 'finished') { slideAnim.cancel(); slideAnim = null; }
    hookSwipers();
    shift = stageShift();
    const pose = updatePose(dt);
    lastCx = pose.cx;
    const half = pose.size / 2, cx = pose.cx - shift;
    const onScreen = pose.cy + half > 0 && pose.cy - half < vh && cx + half > 0 && cx - half < vw;
    if (!onScreen) {
      if (drawn) { ctx.clearRect(0, 0, canvas.width, canvas.height); octx.clearRect(0, 0, overlay.width, overlay.height); drawn = false; }
      if (!video.paused) video.pause();
      return;
    }
    if (video.paused) video.play().catch(() => {});
    drawn = true;
    clipAbove();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(video, cx - half, pose.cy - half, pose.size, pose.size);
    paintLights(pose);
  }

  async function begin() {
    document.body.appendChild(stage);
    new ResizeObserver(resize).observe(stage);
    resize();
    collect();
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; collect(); });
    }).observe(document.body, { childList: true, subtree: true });
    // pas tonen als de video echt speelt; lukt dat niet, dan blijft alles zoals Webflow het toont
    const playing = new Promise((res, rej) => {
      video.addEventListener('playing', res, { once: true });
      video.addEventListener('error', rej, { once: true });
    });
    video.play().catch(() => {});
    try { await playing; } catch { stage.remove(); return; }
    await document.fonts.ready;
    requestAnimationFrame(frame);
    requestAnimationFrame(() => {
      ready = true;
      hideDom();
      stage.style.opacity = '1';
      const fallback = start.querySelector('img');
      if (fallback) { fallback.style.transition = 'opacity .6s'; fallback.style.opacity = '0'; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
