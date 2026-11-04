// Hero stone: bij elk bezoek aan Home een van de uitgelichte mineralen in de hero, nooit dezelfde als de vorige keer.
// De gekozen steen staat in de hero en zijn slide staat vooraan in Featured Minerals. Heeft de steen een draaiende
// video (spin/<slug>/ in deze repo, lijst in data-spin), dan neemt stone-travel.js hem mee naar zijn slide;
// zonder video blijft het een stilstaande foto in de hero (zoals bij "minder beweging").
//
// Laden als gewoon script in de <head> van Home (niet defer/async): de keuze valt vóór het eerste beeld, en het
// wisselen van foto en slidevolgorde gebeurt zodra de pagina is ingelezen, vóór stone-travel.js (defer) en vóór de
// Swiper van de Lumos Slider (DOMContentLoaded).
//   <script src=".../hero-stone.js"
//     data-stones="foundry-grade-chromite-sand hematite guyanese-bauxite"   ← slugs waaruit gekozen wordt
//     data-default="foundry-grade-chromite-sand"                            ← de steen die Webflow zelf in de hero heeft
//     data-spin="foundry-grade-chromite-sand"></script>                     ← slugs met een draaiende video
// De foto voor een andere steen komt uit zijn slide (CMS-beeld van [data-slug='<slug>']), ook de mask van de lichte titel.
// Resultaat voor andere scripts: window.pmsHeroStone = { slug, spin } en <html data-hero-stone="<slug>">.

(() => {
  const cfg = document.currentScript.dataset;
  const list = (s) => (s || '').split(/[\s,]+/).filter(Boolean);
  const stones = list(cfg.stones);
  const fallback = cfg.default || stones[0];
  const spin = new Set(list(cfg.spin));
  const KEY = 'pms-hero-stone';
  if (!stones.length || !fallback) return;

  let last = null;
  try { last = localStorage.getItem(KEY); } catch {}
  const pool = stones.length > 1 ? stones.filter((s) => s !== last) : stones;
  let slug = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem(KEY, slug); } catch {}

  const html = document.documentElement;
  const state = (window.pmsHeroStone = { slug, spin: spin.has(slug) });
  html.setAttribute('data-hero-stone', slug);

  // Een andere steen dan die van Webflow: foto en lichte titel pas tonen als ze gewisseld zijn (nooit eerst chromiet)
  const release = () => html.setAttribute('data-hero-stone-ready', '');
  if (slug !== fallback) {
    const style = document.createElement('style');
    style.textContent = 'html:not([data-hero-stone-ready]) :is(.home-hero_visual .u-image-wrapper, .home-hero_mask) { visibility: hidden; }';
    document.head.appendChild(style);
    setTimeout(release, 3000); // vangnet
  } else release();

  function swapHero() {
    const visual = document.querySelector('.home-hero_visual');
    const img = visual?.querySelector('.u-image-wrapper img');
    const source = document.querySelector(`[data-slug='${CSS.escape(slug)}'] .mineral-slide_visual img, [data-slug='${CSS.escape(slug)}'] img`);
    const url = source && (source.getAttribute('src') || source.currentSrc);
    if (!img || !url) return false;
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.src = url;
    img.alt = source.alt || img.alt;
    // Webflow-foto is een uitsnede op de maat van het vlak; de CMS-foto is vierkant: heel tonen, in het midden
    img.style.objectFit = 'contain';
    const mask = document.querySelector('.home-hero_mask');
    if (mask) {
      const value = `url("${url}")`;
      Object.assign(mask.style, { webkitMaskImage: value, maskImage: value, webkitMaskSize: 'contain', maskSize: 'contain', webkitMaskPosition: '50% 50%', maskPosition: '50% 50%' });
    }
    return true;
  }

  // Slide van de gekozen steen vooraan, de rest in dezelfde rondgang erachter (chromiet → hematiet → bauxiet → …)
  function reorderSlides() {
    document.querySelectorAll('.w-dyn-items').forEach((items) => {
      const kids = [...items.children];
      const i = kids.findIndex((el) => el.querySelector(`[data-slug='${CSS.escape(slug)}']`) || el.matches(`[data-slug='${CSS.escape(slug)}']`));
      if (i > 0) items.append(...kids.slice(0, i));
    });
  }

  function apply() {
    try {
      if (slug !== fallback && !swapHero()) {
        // foto niet gevonden: de steen van Webflow houden
        slug = state.slug = fallback;
        state.spin = spin.has(fallback);
        html.setAttribute('data-hero-stone', slug);
        try { localStorage.setItem(KEY, slug); } catch {}
      }
      reorderSlides();
    } finally {
      release();
    }
  }

  // 'interactive' komt vóór de defer-scripts (stone-travel.js) en vóór DOMContentLoaded (Swiper)
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', function on() {
      if (document.readyState === 'loading') return;
      document.removeEventListener('readystatechange', on);
      apply();
    });
  } else apply();
})();
