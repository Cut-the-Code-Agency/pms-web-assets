// Chromite-steen: 3D-model dat meedraait met de scroll.
//
// Webflow-markup:
//   <div data-chromite>                          ← plek voor het canvas (bv. class chromite_wrap)
//     <img data-chromite-fallback src="…">        ← stilstaande afbeelding tot het model geladen is
//   </div>
//
// Optionele attributen op [data-chromite]:
//   data-chromite-mode="inline"     "inline": steen draait in zijn eigen vlak (standaard)
//                                   "hero":   laag over de hero en de sectie erna. De steen draait vanzelf,
//                                             schuift tijdens de hero kleiner naar de rechterrand, blijft daar
//                                             tijdens de volgende sectie en scrolt daarna mee weg.
//                                             Zet het vlak als eerste element vóór de hero.
//   data-chromite-trigger="#hero"   inline: scrollbereik (standaard dichtstbijzijnde <section>)
//                                   hero:   de hero (standaard het element direct na het vlak)
//   data-chromite-end="#next"       hero: tot waar de laag loopt (standaard het element na de hero)
//   data-chromite-turns="1"         extra keer rond over het scrollbereik
//   data-chromite-material="stone"  "stone" (niet-metaal) of "metal" (zoals aangeleverd)
//   data-chromite-tilt="90"         kanteling in het beeld in graden (0 = rechtop, 90 = liggend)
//   data-chromite-land=".slider_list > :first-child .card_primary_visual"
//                                   hero: element waarin de steen landt (bv. de beeldplek van de eerste
//                                   slide). De steen vliegt erheen als die sectie in beeld komt, volgt het
//                                   daarna (ook als de slider schuift) en wordt afgeknipt aan de randen van
//                                   de slider. Afbeeldingen in het landingsvlak worden verborgen.
//   data-chromite-clip=".slider_element"  hero + land: waaraan de steen wordt afgeknipt
//                                   (standaard de dichtstbijzijnde .swiper rond het landingsvlak)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MODEL_URL = new URL('../model/chromite.glb', import.meta.url).href;
const GSAP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/';
const IDLE_SPEED = 0.35; // radialen per seconde
const HERO_END_SCALE = 0.6;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// GSAP uit Webflow gebruiken als het er al is, anders zelf laden
async function ensureGsap() {
  if (!window.gsap) await loadScript(GSAP_CDN + 'gsap.min.js');
  if (!window.ScrollTrigger) await loadScript(GSAP_CDN + 'ScrollTrigger.min.js');
  window.gsap.registerPlugin(window.ScrollTrigger);
  return window.gsap;
}

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function pick(selector, fallback) {
  return (selector && document.querySelector(selector)) || fallback;
}

// Hero-modus: het vlak wordt een laag over hero + volgende sectie, met daarin een
// canvas dat vast in beeld blijft (sticky) tot de laag ophoudt
function setupHeroLayer(wrap, landing) {
  const hero = pick(wrap.dataset.chromiteTrigger, wrap.nextElementSibling);
  const end = pick(wrap.dataset.chromiteEnd, hero && hero.nextElementSibling) || hero;

  // Met een landingsvlak blijft de laag de hele pagina vast in beeld; de steen volgt dat vlak
  if (landing) {
    Object.assign(wrap.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100vh', maxWidth: 'none',
      margin: '0', aspectRatio: 'auto', zIndex: '1', pointerEvents: 'none',
    });
    return { stage: wrap, hero };
  }

  Object.assign(wrap.style, {
    position: 'absolute', left: '0', width: '100%', maxWidth: 'none', margin: '0',
    aspectRatio: 'auto', zIndex: '1', pointerEvents: 'none',
  });
  const stage = document.createElement('div');
  Object.assign(stage.style, { position: 'sticky', top: '0', width: '100%', height: '100vh' });
  wrap.appendChild(stage);

  function fit() {
    const top = wrap.getBoundingClientRect().top;
    const bottom = end.getBoundingClientRect().bottom;
    wrap.style.height = Math.max(bottom - top, window.innerHeight) + 'px';
  }
  new ResizeObserver(fit).observe(document.body);
  fit();

  return { stage, hero };
}

async function mount(wrap) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroMode = wrap.dataset.chromiteMode === 'hero';
  const turns = parseFloat(wrap.dataset.chromiteTurns || '1');
  const asStone = (wrap.dataset.chromiteMaterial || 'stone') !== 'metal';
  const tilt = THREE.MathUtils.degToRad(parseFloat(wrap.dataset.chromiteTilt || '0'));

  const landing = heroMode ? pick(wrap.dataset.chromiteLand, null) : null;
  const clipEl = landing && (pick(wrap.dataset.chromiteClip, null) || landing.closest('.swiper') || landing.parentElement);

  let stage = wrap;
  let trigger;
  if (heroMode) {
    ({ stage, hero: trigger } = setupHeroLayer(wrap, landing));
  } else {
    trigger = pick(wrap.dataset.chromiteTrigger, wrap.closest('section') || wrap);
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', opacity: '0', transition: 'opacity .6s' });
  stage.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const DIST = 6;

  // Omgevingslicht: zonder dit wordt een metaal-materiaal vrijwel zwart
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  // mover: positie en schaal (scroll) › scroller: draaiing door scroll › spinner: draait vanzelf
  const mover = new THREE.Group();
  const scroller = new THREE.Group();
  const spinner = new THREE.Group();
  scene.add(mover);
  mover.add(scroller);
  scroller.add(spinner);

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Inline en smal vlak: verder weg, zodat de steen in de breedte past
    const dist = !heroMode && camera.aspect < 1 ? DIST / camera.aspect * 0.75 : DIST;
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Rechterrand in scene-eenheden: de steen eindigt met zijn midden net binnen de rand
  function rightEdgeX() {
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    return halfW * (camera.aspect < 1 ? 0.7 : 0.92);
  }

  // Schermrechthoek → positie en schaal in de scene (vlak z = 0)
  function poseFor(rect) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const x = ((rect.left + rect.width / 2) / vw - 0.5) * 2 * halfW;
    const y = (0.5 - (rect.top + rect.height / 2) / vh) * 2 * halfH;
    // Lengte van de steen ≈ 75% van de breedte van het vlak, maar niet hoger dan het vlak
    const size = Math.min(rect.width / vw * 2 * halfW * 0.75, rect.height / vh * 2 * halfH * 1.4);
    return { x, y, s: size / 2.2 };
  }

  const [gltf, gsap] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL_URL),
    reduceMotion ? null : ensureGsap(),
  ]);

  // Centreren, lange as rechtop, schalen naar vaste grootte
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(box.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.x = Math.PI / 2;
  holder.scale.setScalar(2.2 / Math.max(size.x, size.y, size.z));
  const tilter = new THREE.Group();
  tilter.rotation.z = tilt;
  tilter.add(holder);
  spinner.add(tilter);

  model.traverse(o => {
    if (o.isMesh && asStone) {
      o.material.metalness = 0;
      o.material.roughness = 0.85;
    }
  });

  // hero: 0 → 1 tijdens de hero (midden → rechts); land: 0 → 1 als de landingssectie in beeld komt
  const progress = { hero: 0, land: 0 };
  if (landing) landing.querySelectorAll('img').forEach(img => { img.style.opacity = '0'; });

  function updatePose() {
    const right = rightEdgeX();
    let x = right * progress.hero;
    let y = 0;
    let s = 1 + (HERO_END_SCALE - 1) * progress.hero;
    canvas.style.clipPath = '';
    if (landing && progress.land > 0) {
      const t = poseFor(landing.getBoundingClientRect());
      x += (t.x - x) * progress.land;
      y += (t.y - y) * progress.land;
      s += (t.s - s) * progress.land;
      // Geland: afknippen aan de slider, zodat de steen er niet buiten uitsteekt bij het schuiven
      if (progress.land > 0.98 && clipEl) {
        const c = clipEl.getBoundingClientRect();
        const vw = stage.clientWidth, vh = stage.clientHeight;
        canvas.style.clipPath = `inset(${Math.max(c.top, 0)}px ${Math.max(vw - c.right, 0)}px ${Math.max(vh - c.bottom, 0)}px ${Math.max(c.left, 0)}px)`;
      }
    }
    mover.position.set(x, y, 0);
    mover.scale.setScalar(s);
  }

  if (gsap) {
    const tl = gsap.timeline({
      scrollTrigger: { trigger, start: 'top top', end: 'bottom top', scrub: 1, invalidateOnRefresh: true },
    });
    tl.to(scroller.rotation, { y: Math.PI * 2 * turns, ease: 'none', duration: 1 }, 0)
      .to(scroller.rotation, { x: 0.35, ease: 'sine.inOut', yoyo: true, repeat: 1, duration: 0.5 }, 0);
    if (heroMode) tl.to(progress, { hero: 1, ease: 'power1.inOut', duration: 1 }, 0);
    if (landing) {
      gsap.to(progress, {
        land: 1, ease: 'power2.inOut',
        scrollTrigger: { trigger: landing.closest('section') || landing, start: 'top bottom', end: 'center center', scrub: 1 },
      });
    }
  } else {
    scroller.rotation.set(0.2, 0.6, 0);
  }

  // Alleen renderen als de steen in beeld is; vanzelf draaien behalve bij "minder beweging"
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wrap);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible || document.hidden) return;
    if (heroMode && !reduceMotion) spinner.rotation.y += dt * IDLE_SPEED;
    if (heroMode) updatePose();
    renderer.render(scene, camera);
  });

  canvas.style.opacity = '1';
  const fallback = wrap.querySelector('[data-chromite-fallback]');
  if (fallback) {
    fallback.style.transition = 'opacity .6s';
    fallback.style.opacity = '0';
  }
  wrap.classList.add('is-ready');
}

function init() {
  if (!hasWebGL()) return; // fallback-afbeelding blijft staan
  document.querySelectorAll('[data-chromite]').forEach(wrap => {
    mount(wrap).catch(err => console.error('[chromite]', err));
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
