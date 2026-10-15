// Reis-modus: de steen begint op de plek van een element (bv. de foto in de hero), schuift tijdens het
// scrollen kleiner naar de rechterrand, blijft daar tot de landingssectie in beeld komt en landt dan in een
// ander element (bv. de beeldplek van een slide), dat hij daarna volgt, ook als de slider schuift.
//
// Instellen op de script-tag (geen markup in Webflow nodig):
//   <script type="module" src=".../chromite.js"
//     data-chromite-start=".home-hero_visual"                               ← startvlak (daarin staat de foto als fallback)
//     data-chromite-land="[data-swiper-slide-index='0'] .mineral-slide_visual" ← landingsvlak; alle kopieën van de slide
//     data-chromite-light=".home-hero_title.is-light, .mineral-slide_title.is-light"
//                                                                           ← lichte titels: alleen zichtbaar waar de steen is
//     data-chromite-size="1.1"                                              ← lengte van de steen t.o.v. de breedte van het vlak
//     data-chromite-tilt="35"></script>                                     ← kanteling in het beeld, graden
//
// De lichte titels tekent het script zelf, letter voor letter op de plek van de DOM-letters (dus ook tijdens
// de inlaadanimatie), en knipt ze af op de vorm van de steen. De DOM-kopie wordt doorzichtig.
// Zonder WebGL of met een fout blijft alles zoals Webflow het toont (foto + CSS-mask).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const IDLE_SPEED = 0.35; // radialen per seconde
const PARK_SCALE = 0.6; // grootte aan de rechterrand t.o.v. het startvlak
const PARK_INSIDE = 0.65; // deel van de steen dat aan de rechterrand in beeld blijft
const PARK_INSIDE_MOBILE = -0.1; // mobiel: net buiten beeld
const DAMP = 8; // naloop van de scroll (hoger = strakker)
const FOV = 30;
const DIST = 6;
const MODEL_SIZE = 2.2; // lange as van het model in scene-eenheden

// Merkcurve "Position" (decisions/motion.md): cubic-bezier(0.75, 0, 0.5, 1)
function bezier(x1, y1, x2, y2) {
  const f = (u, a, b) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  return t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1, u = t;
    for (let i = 0; i < 24; i++) {
      u = (lo + hi) / 2;
      if (f(u, x1, x2) < t) lo = u; else hi = u;
    }
    return f(u, y1, y2);
  };
}
const ease = bezier(0.75, 0, 0.5, 1);
const clamp01 = v => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPose = (a, b, t) => ({ cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), size: lerp(a.size, b.size, t) });

// Lichte titel: elke letter op de plek van de DOM-letter tekenen, met de afknipping van maskers
// (SplitText-lettermaskers) en de zichtbaarheid van de inlaadanimatie
function makeLightPainter() {
  const range = document.createRange();
  let styleCache = new Map();
  const style = el => {
    let s = styleCache.get(el);
    if (!s) { s = getComputedStyle(el); styleCache.set(el, s); }
    return s;
  };

  // Ondoorzichtigheid en afknipping van de letter: alle voorouders tot <body>
  function context(el) {
    let opacity = 1;
    let clip = null;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = style(n);
      if (s.visibility === 'hidden' && n === el) return null;
      if (s.display === 'none') return null;
      opacity *= parseFloat(s.opacity);
      if (opacity < 0.01) return null;
      const ox = s.overflowX !== 'visible', oy = s.overflowY !== 'visible';
      if (ox || oy) {
        const r = n.getBoundingClientRect();
        const c = { l: ox ? r.left : -1e5, t: oy ? r.top : -1e5, r: ox ? r.right : 1e5, b: oy ? r.bottom : 1e5 };
        clip = clip ? { l: Math.max(clip.l, c.l), t: Math.max(clip.t, c.t), r: Math.min(clip.r, c.r), b: Math.min(clip.b, c.b) } : c;
      }
    }
    return { opacity, clip };
  }

  function paint(ctx, item) {
    const walker = document.createTreeWalker(item.el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.data;
      if (!text.trim()) continue;
      const parent = node.parentElement;
      const ctxInfo = context(parent);
      if (!ctxInfo) continue;
      const s = style(parent);
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      ctx.globalAlpha = ctxInfo.opacity;
      const upper = s.textTransform === 'uppercase';
      const lower = s.textTransform === 'lowercase';
      for (let i = 0; i < text.length; i++) {
        let ch = text[i];
        if (/\s/.test(ch)) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getClientRects()[0];
        if (!r || !r.width) continue;
        if (upper) ch = ch.toUpperCase(); else if (lower) ch = ch.toLowerCase();
        const ascent = ctx.measureText(ch).fontBoundingBoxAscent;
        const c = ctxInfo.clip;
        if (c) {
          if (c.r <= c.l || c.b <= c.t) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(c.l, c.t, c.r - c.l, c.b - c.t);
          ctx.clip();
        }
        ctx.fillText(ch, r.left, r.top + ascent);
        if (c) ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  return {
    begin() { styleCache = new Map(); },
    paint,
  };
}

export async function mountTravel(cfg, loadModel) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = document.querySelector(cfg.start);
  if (!start) return;
  const heroSection = start.closest('section') || start.parentElement;
  const sizeFactor = parseFloat(cfg.size || '1');
  const tilt = THREE.MathUtils.degToRad(parseFloat(cfg.tilt || '0'));
  const turns = parseFloat(cfg.turns || '1');
  const landing = !reduceMotion && cfg.land ? cfg.land : null;

  // Laag over de hele pagina, onder de navigatie (z-index 1000); klikken gaan erdoorheen
  const stage = document.createElement('div');
  stage.className = 'chromite_stage';
  stage.setAttribute('aria-hidden', 'true');
  Object.assign(stage.style, { position: 'fixed', inset: '0', zIndex: '999', pointerEvents: 'none', opacity: '0', transition: 'opacity .6s' });
  document.body.appendChild(stage);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  const overlay = document.createElement('canvas');
  for (const c of [canvas, overlay]) Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  stage.append(canvas, overlay);
  const octx = overlay.getContext('2d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);
  camera.position.set(0, 0, DIST);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  // mover: positie en schaal › scroller: draaiing door scroll › spinner: draait vanzelf
  const mover = new THREE.Group();
  const scroller = new THREE.Group();
  const spinner = new THREE.Group();
  scene.add(mover);
  mover.add(scroller);
  scroller.add(spinner);

  let vw = 0, vh = 0, dpr = 1;
  function resize() {
    vw = stage.clientWidth;
    vh = stage.clientHeight;
    if (!vw || !vh) return;
    dpr = Math.min(window.devicePixelRatio || 1, vw * vh > 1.2e6 ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(vw, vh, false);
    overlay.width = Math.round(vw * dpr);
    overlay.height = Math.round(vh * dpr);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  const model = await loadModel();
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(box.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.x = Math.PI / 2; // lange as rechtop
  holder.scale.setScalar(MODEL_SIZE / Math.max(size.x, size.y, size.z));
  const tilter = new THREE.Group();
  tilter.rotation.z = tilt;
  tilter.add(holder);
  spinner.add(tilter);
  if ((cfg.material || 'stone') !== 'metal') {
    model.traverse(o => {
      if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.85; }
    });
  }

  // Landingsvlakken (de slider maakt kopieën van de slide) en lichte titels; opnieuw zoeken als de DOM verandert
  let targets = [];
  let lights = [];
  function collect() {
    targets = landing ? [...document.querySelectorAll(landing)] : [];
    const slides = targets.map(t => t.closest('.swiper-slide') || t);
    const known = new Set(lights.map(l => l.el));
    if (cfg.light) {
      for (const el of document.querySelectorAll(cfg.light)) {
        if (known.has(el)) continue;
        const inHero = heroSection.contains(el);
        if (!inHero && !slides.some(s => s.contains(el))) continue;
        lights.push({ el, color: getComputedStyle(el).color });
      }
    }
    if (ready) hideDom();
  }
  let ready = false;
  function hideDom() {
    for (const l of lights) l.el.style.setProperty('color', 'transparent', 'important');
    for (const t of targets) t.querySelectorAll('img').forEach(img => { img.style.opacity = '0'; });
  }
  collect();
  let collectQueued = false;
  new MutationObserver(() => {
    if (collectQueued) return;
    collectQueued = true;
    requestAnimationFrame(() => { collectQueued = false; collect(); });
  }).observe(document.body, { childList: true, subtree: true });

  // Poses in schermpixels: midden + lengte van de steen
  const rectPose = r => ({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: r.width * sizeFactor });

  // Landingsvlak dat het dichtst bij het midden van zijn slider staat (de echte slide of een kopie)
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

  const progress = { hero: 0, land: 0 };
  let first = true;
  function targetsNow() {
    const hr = heroSection.getBoundingClientRect();
    const hero = reduceMotion ? 0 : clamp01(-hr.top / hr.height);
    let land = 0, target = null;
    if (landing) {
      target = currentTarget();
      if (target) {
        const sec = (target.el.closest('section') || target.el).getBoundingClientRect();
        const cy = target.r.top + target.r.height / 2;
        land = clamp01((vh - sec.top) / (vh / 2 + cy - sec.top));
      }
    }
    return { hero, land, target, hr };
  }

  function updatePose(dt) {
    const now = targetsNow();
    const k = first ? 1 : 1 - Math.exp(-dt * DAMP);
    first = false;
    progress.hero += (now.hero - progress.hero) * k;
    progress.land += (now.land - progress.land) * k;

    // Start: het startvlak. Desktop: vastgezet op zijn plek in beeld zolang de hero scrolt. Mobiel (en bij
    // minder beweging) scrolt hij mee, en wacht hij net buiten beeld rechts, zodat hij geen tekst bedekt.
    const mobile = vw < 768;
    const sr = start.getBoundingClientRect();
    const startPose = rectPose(sr);
    if (!reduceMotion && !mobile) startPose.cy -= now.hr.top;
    const park = { size: startPose.size * PARK_SCALE, cy: vh / 2, cx: 0 };
    park.cx = vw + park.size * (0.5 - (mobile ? PARK_INSIDE_MOBILE : PARK_INSIDE));
    let pose = lerpPose(startPose, park, ease(progress.hero));
    if (now.target && progress.land > 0) pose = lerpPose(pose, rectPose(now.target.r), ease(progress.land));

    // Schermpixels → scene (vlak z = 0)
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * DIST;
    const upp = (2 * halfH) / vh;
    mover.position.set((pose.cx - vw / 2) * upp, (vh / 2 - pose.cy) * upp, 0);
    mover.scale.setScalar((pose.size * upp) / MODEL_SIZE);

    if (!reduceMotion) {
      scroller.rotation.y = Math.PI * 2 * turns * (progress.hero + progress.land) / 2;
      scroller.rotation.x = 0.35 * Math.sin(Math.PI * progress.hero);
    }
    return pose;
  }

  const painter = makeLightPainter();
  function paintLights(pose) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const half = pose.size * 0.6;
    const sb = { l: pose.cx - half, t: pose.cy - half, r: pose.cx + half, b: pose.cy + half };
    const hits = lights.filter(l => {
      const r = l.el.getBoundingClientRect();
      return r.right > sb.l && r.left < sb.r && r.bottom > sb.t && r.top < sb.b;
    });
    if (!hits.length) return;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.textBaseline = 'alphabetic';
    painter.begin();
    for (const l of hits) {
      octx.fillStyle = l.color;
      painter.paint(octx, l);
    }
    // Alleen houden waar de steen is
    octx.globalCompositeOperation = 'destination-in';
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.drawImage(canvas, 0, 0);
    octx.globalCompositeOperation = 'source-over';
  }

  if (reduceMotion) scroller.rotation.set(0.2, 0.6, 0);
  await document.fonts.ready;

  const clock = new THREE.Clock();
  let drawn = true;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (document.hidden || !vw) return;
    if (!reduceMotion) spinner.rotation.y += dt * IDLE_SPEED;
    const pose = updatePose(dt);
    // Buiten beeld: niet tekenen
    const half = pose.size * 0.6;
    const onScreen = pose.cy + half > 0 && pose.cy - half < vh && pose.cx + half > 0 && pose.cx - half < vw;
    if (!onScreen) {
      if (drawn) { renderer.clear(); octx.clearRect(0, 0, overlay.width, overlay.height); drawn = false; }
      return;
    }
    drawn = true;
    renderer.render(scene, camera);
    paintLights(pose);
  });

  // Klaar: canvas zichtbaar, foto en DOM-kopieën weg
  requestAnimationFrame(() => {
    ready = true;
    hideDom();
    stage.style.opacity = '1';
    const fallback = start.querySelector('[data-chromite-fallback]') || start.querySelector('img');
    if (fallback) {
      fallback.style.transition = 'opacity .6s';
      fallback.style.opacity = '0';
    }
    start.classList.add('is-chromite-ready');
  });
}
