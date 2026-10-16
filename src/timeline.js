// Timeline: de blauwe lijn van de tijdlijn (About us "Timeline", Mineral # "Supply Chain").
// Gebruikt de GSAP (+ CustomEase) die Webflow laadt; laadt zelf niets. Zonder GSAP springt de lijn.
//
// Webflow-markup (component Timeline Item in de Lumos Slider, variant Timeline):
//   [data-timeline="root"]    de sectie
//   [data-timeline="item"]    één stap (slide)                   → class is-passed (stap vóór de actieve, desktop)
//   [data-timeline="point"]   jaartal / vierkantje op de lijn     → class is-reached
//   [data-timeline="card"]    het kaartje                         → class is-reached
//   [data-timeline="fill"]    het blauwe stuk lijn naar de volgende stap (transform)
//
// Desktop (≥ 992 px): voortgang p = actieve slide + inscroll-voortgang (0 → 1 terwijl de lijn zelf van
// 85 % naar 50 % van het scherm komt). Na een klik loopt het actieve deel in 750 ms naar de nieuwe slide.
// Lijnstuk k vult clamp(p − k, 0, 1); stap k is bereikt bij p ≥ k. Swiper krijgt ruimte achter de
// laatste slide, zodat elke stap links kan staan (en elk streepje een stap is). Die ruimte wordt opnieuw
// berekend bij elke maatwijziging: lettertype geladen, slides of slider van maat, smal → breed.
// Stappen vóór de actieve krijgen is-passed (Webflow fadet het kaartje uit), zodat er links niets
// half afgesneden blijft staan.
// Mobiel: Swiper uit, stappen onder elkaar; de lijn vult mee met scrollen tot 60 % van het scherm.
// prefers-reduced-motion: geen tween; desktop direct tot de volgende stap, mobiel alles bereikt.

(function () {
  const DESKTOP = window.matchMedia('(min-width: 992px)');
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
  const START = 0.85; // inscrollen begint als de baan hier is (fractie van de schermhoogte)
  const END = 0.5;    // en is klaar als de baan hier is
  const MOBILE_LINE = 0.6;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function easeFor(gsap) {
    if (window.CustomEase) {
      gsap.registerPlugin(window.CustomEase);
      return window.CustomEase.create('pmsTimeline', '0.75,0,0.5,1');
    }
    return 'power2.inOut';
  }

  function setup(root) {
    const items = Array.from(root.querySelectorAll('[data-timeline="item"]'));
    // De Swiper van de Lumos Slider is de .swiper rond de stappen van deze tijdlijn.
    const swiperEl = items.length ? items[0].closest('.swiper') : null;
    if (!swiperEl) return;

    const parts = items.map((item) => ({
      item,
      points: item.querySelectorAll('[data-timeline="point"]'),
      card: item.querySelector('[data-timeline="card"]'),
      fill: item.querySelector('[data-timeline="fill"]'),
    }));
    // Inscrollen meten vanaf de lijn zelf (niet vanaf de bovenkant van de slider).
    const firstFill = parts.find((part) => part.fill);
    const lineEl = firstFill ? firstFill.fill.parentElement : swiperEl;
    const gsap = window.gsap;
    const ease = gsap ? easeFor(gsap) : null;
    const state = { active: 0 };
    let swiper = null;
    let queued = false;
    let fitQueued = false;

    function mark(part, reached) {
      part.points.forEach((p) => p.classList.toggle('is-reached', reached));
      if (part.card) part.card.classList.toggle('is-reached', reached);
    }

    function markPassed() {
      const on = !!swiper && swiper.enabled && DESKTOP.matches;
      const active = on ? swiper.activeIndex : 0;
      parts.forEach((part, k) => part.item.classList.toggle('is-passed', on && k < active));
    }

    function renderDesktop() {
      const vh = window.innerHeight;
      const top = lineEl.getBoundingClientRect().top;
      const scroll = REDUCE.matches ? 1 : clamp((vh * START - top) / (vh * (START - END)), 0, 1);
      const p = clamp(state.active + scroll, 0, parts.length - 1);
      parts.forEach((part, k) => {
        if (part.fill) part.fill.style.transform = 'scaleX(' + clamp(p - k, 0, 1) + ')';
        mark(part, p >= k - 0.001);
      });
    }

    function renderMobile() {
      const line = window.innerHeight * MOBILE_LINE;
      parts.forEach((part) => {
        if (REDUCE.matches) {
          if (part.fill) part.fill.style.transform = 'scaleY(1)';
          mark(part, true);
          return;
        }
        if (part.fill) {
          const r = part.fill.parentElement.getBoundingClientRect();
          part.fill.style.transform = 'scaleY(' + (r.height ? clamp((line - r.top) / r.height, 0, 1) : 0) + ')';
        }
        const point = Array.from(part.points).find((p) => p.offsetParent !== null) || part.item;
        mark(part, point.getBoundingClientRect().top < line);
      });
    }

    function render() {
      queued = false;
      if (DESKTOP.matches) renderDesktop();
      else renderMobile();
    }

    function queue() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(render);
    }

    // Ruimte achter de laatste slide: precies zoveel dat de laatste stap links kan staan.
    // Swiper maakt een streepje per stap zolang (virtualSize − breedte) gelijk is aan de positie van de
    // laatste slide (+ 0,5 px marge tegen afrondfouten; een extra snap komt pas bij > 1 px verschil).
    function fitSwiper() {
      fitQueued = false;
      if (!swiper || swiper.destroyed) return;
      if (DESKTOP.matches) {
        const index = swiper.enabled ? swiper.activeIndex : 0;
        if (!swiper.enabled) swiper.enable();
        swiper.updateSize();
        swiper.updateSlides(); // verse maten, nog zonder te verschuiven
        const grid = swiper.slidesGrid;
        const last = grid[grid.length - 1] || 0;
        const current = Number(swiper.params.slidesOffsetAfter) || 0;
        const after = Math.max(0, current + last + 0.5 - (swiper.virtualSize - swiper.size));
        if (Math.abs(after - current) > 0.1) swiper.params.slidesOffsetAfter = after;
        swiper.update();
        const keep = Math.min(index, swiper.slides.length - 1);
        if (swiper.activeIndex !== keep) swiper.slideTo(keep, 0, false, true);
        if (swiper.pagination && swiper.pagination.el) {
          swiper.pagination.render();
          swiper.pagination.update();
        }
      } else if (swiper.enabled) {
        swiper.slideTo(0, 0);
        swiper.disable();
        swiper.wrapperEl.style.transform = '';
      }
      if (!gsap || !gsap.isTweening(state)) state.active = DESKTOP.matches ? swiper.activeIndex : 0;
      markPassed();
      queue();
    }

    function queueFit() {
      if (fitQueued) return;
      fitQueued = true;
      requestAnimationFrame(fitSwiper);
    }

    function onSlide() {
      const to = swiper.activeIndex;
      markPassed();
      if (gsap && !REDUCE.matches) {
        gsap.to(state, { active: to, duration: 0.75, ease, overwrite: true, onUpdate: queue });
      } else {
        state.active = to;
        queue();
      }
    }

    function attach(sw) {
      swiper = sw;
      swiper.on('slideChange', onSlide);
      swiper.on('resize', queueFit); // Swipers eigen herberekening (gebruikt anders een oude ruimte)
      if (window.ResizeObserver) {
        // Slides worden breder als het lettertype binnen is; de slider bij smal → breed.
        const ro = new ResizeObserver(queueFit);
        ro.observe(swiperEl);
        items.forEach((item) => ro.observe(item));
      }
      if (document.fonts) {
        document.fonts.ready.then(queueFit);
        document.fonts.addEventListener('loadingdone', queueFit);
      }
      fitSwiper();
    }

    // Het Lumos-script maakt de Swiper bij DOMContentLoaded; wacht tot hij er is.
    let tries = 0;
    (function wait() {
      if (swiperEl.swiper) return attach(swiperEl.swiper);
      if (++tries < 120) requestAnimationFrame(wait);
      else queue(); // geen Swiper: alleen de scroll-weergave
    })();

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', () => { queueFit(); queue(); });
    DESKTOP.addEventListener('change', queueFit);
    window.addEventListener('load', queueFit);
    queue();
  }

  function init() {
    document.querySelectorAll('[data-timeline="root"]').forEach(setup);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
