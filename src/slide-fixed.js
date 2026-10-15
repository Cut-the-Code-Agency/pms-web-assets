// Slide fixed: teksten in een slide die niet meeschuiven met de slider, maar op de plek van de
// actieve slide blijven staan. Zo is een wissel alleen een fade en een kleine beweging omhoog
// (die staat in de CSS), zonder dat de tekst van links naar rechts mee schuift.
//
// Webflow-markup:
//   [data-slide-fixed]   een element in een Swiper-slide (Lumos Slider). Alleen als het absoluut
//                        gepositioneerd is (bv. de hoekteksten op desktop); in de gewone flow
//                        (mobiel onder de foto) schuift het gewoon mee.
//
// Hoe: Swiper verschuift de slides met een CSS-transition op de wrapper. Het script luistert naar
// dezelfde Swiper-events (setTransition, setTranslate) en zet op hetzelfde moment de tegenbeweging
// op de CSS-property `translate` (niet `transform`, die is van de fade-beweging): bij slepen direct,
// bij een wissel als animatie met dezelfde duur en curve als de slider. Zo lopen ze gelijk zonder
// per frame te meten. Geen GSAP nodig.

(() => {
  const SEL = '[data-slide-fixed]';

  const hook = (swiper) => {
    if (swiper.__pmsFixed) return;
    swiper.__pmsFixed = true;
    const easing = getComputedStyle(swiper.wrapperEl).transitionTimingFunction || 'ease';
    let duration = 0;

    const apply = (translate) => {
      const rootLeft = swiper.el.getBoundingClientRect().left;
      const now = swiper.getTranslate();
      swiper.slides.forEach((slide) => {
        const els = slide.querySelectorAll(SEL);
        if (!els.length) return;
        // Plek van de slide zonder de verschuiving van de wrapper.
        const base = slide.getBoundingClientRect().left - rootLeft - now;
        const to = `${-(base + translate)}px 0`;
        els.forEach((el) => {
          const cs = getComputedStyle(el);
          const from = cs.translate === 'none' ? '0px 0' : cs.translate; // ook midden in een animatie
          el._pmsFixedAnim?.cancel();
          if (cs.position !== 'absolute') { el.style.translate = ''; return; }
          el.style.translate = to;
          if (duration > 0) el._pmsFixedAnim = el.animate([{ translate: from }, { translate: to }], { duration, easing });
        });
      });
    };

    swiper.on('setTransition', (s, d) => { duration = d; });
    swiper.on('setTranslate', (s, t) => apply(t));
    window.addEventListener('resize', () => { duration = 0; apply(swiper.translate); });
    apply(swiper.translate);
  };

  const init = () => {
    let tries = 0;
    const scan = () => {
      let pending = false;
      document.querySelectorAll('.swiper').forEach((el) => {
        if (!el.querySelector(SEL)) return;
        if (el.swiper) hook(el.swiper); else pending = true;
      });
      if (pending && tries++ < 40) setTimeout(scan, 100);
    };
    scan();
  };

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
