// Chromite-steen in de home hero: 3D-model dat meedraait met de scroll.
//
// Webflow-markup:
//   <div data-chromite>                          ← plek voor het canvas (bv. class chromite_wrap)
//     <img data-chromite-fallback src="…">        ← stilstaande afbeelding tot het model geladen is
//   </div>
//
// Optionele attributen op [data-chromite]:
//   data-chromite-trigger="#hero"   element waarover de draaiing loopt (standaard: dichtstbijzijnde <section>)
//   data-chromite-turns="1"         aantal keer rond over dat bereik
//   data-chromite-material="stone"  "stone" (niet-metaal) of "metal" (zoals aangeleverd)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MODEL_URL = new URL('../model/chromite.glb', import.meta.url).href;
const GSAP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/';

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

async function mount(wrap) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const triggerSelector = wrap.dataset.chromiteTrigger;
  const trigger = (triggerSelector && document.querySelector(triggerSelector)) || wrap.closest('section') || wrap;
  const turns = parseFloat(wrap.dataset.chromiteTurns || '1');
  const asStone = (wrap.dataset.chromiteMaterial || 'stone') !== 'metal';

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', opacity: '0', transition: 'opacity .6s' });
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  wrap.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);

  // Omgevingslicht: zonder dit wordt een metaal-materiaal vrijwel zwart
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  const pivot = new THREE.Group();
  scene.add(pivot);

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Smal vlak: verder weg, zodat de steen in de breedte past
    camera.position.set(0, 0, camera.aspect < 1 ? 6 / camera.aspect * 0.75 : 6);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

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
  pivot.add(holder);

  model.traverse(o => {
    if (o.isMesh && asStone) {
      o.material.metalness = 0;
      o.material.roughness = 0.85;
    }
  });

  if (gsap) {
    gsap.timeline({ scrollTrigger: { trigger, start: 'top top', end: 'bottom top', scrub: 1 } })
      .to(pivot.rotation, { y: Math.PI * 2 * turns, ease: 'none', duration: 1 }, 0)
      .to(pivot.rotation, { x: 0.35, ease: 'sine.inOut', yoyo: true, repeat: 1, duration: 0.5 }, 0);
  } else {
    pivot.rotation.set(0.2, 0.6, 0);
  }

  // Alleen renderen als de steen in beeld is
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wrap);
  renderer.setAnimationLoop(() => {
    if (visible && !document.hidden) renderer.render(scene, camera);
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
