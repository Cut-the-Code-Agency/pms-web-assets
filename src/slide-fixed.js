// Slide fixed: teksten in een slide die niet meeschuiven met de slider, maar op de plek van de
// actieve slide blijven staan. Zo is een wissel alleen een fade en een kleine beweging omhoog
// (die staat in de CSS), zonder dat de tekst van links naar rechts mee schuift.
//
// Webflow-markup:
//   [data-slide-fixed]   een element in een Swiper-slide (Lumos Slider). Alleen als het absoluut
//                        gepositioneerd is (bv. de hoekteksten op desktop); in de gewone flow
//                        (mobiel onder de foto) schuift het gewoon mee.
//
// Hoe: tijdens het schuiven en slepen zet het script per frame de CSS-property `translate`
// (niet `transform`, die is van de fade-beweging) op het verschil tussen de slide en de plek
// van de actieve slide. Geen GSAP nodig.

(() => {
  const SEL = '[data-slide-fixed]';

  const hook = (swiper) => {
    if (swiper.__pmsFixed) return;
    swiper.__pmsFixed = true;
    const root = swiper.el;
    let raf = 0;
    let moving = false;
    let touching = false;

    const update = () => {
      const anchor = root.getBoundingClientRect().left;
      swiper.slides.forEach((slide) => {
        const els = slide.querySelectorAll(SEL);
        if (!els.length) return;
        const dx = anchor - slide.getBoundingClientRect().left;
        els.forEach((el) => {
          el.style.translate = getComputedStyle(el).position === 'absolute' ? `${dx}px 0` : '';
        });
      });
    };
    const loop = () => {
      update();
      raf = moving || touching ? requestAnimationFrame(loop) : 0;
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };

    swiper.on('touchStart', () => { touching = true; start(); });
    swiper.on('touchEnd', () => { touching = false; start(); });
    swiper.on('sliderMove', start);
    swiper.on('transitionStart', () => { moving = true; start(); });
    swiper.on('transitionEnd', () => { moving = false; update(); });
    swiper.on('slideChange', start);
    swiper.on('resize', update);
    window.addEventListener('resize', update);
    update();
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
