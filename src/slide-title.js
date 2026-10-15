// Slide title: bij elke slidewissel komt de titel van de nieuwe slide letter voor letter omhoog
// (zelfde beweging als de titels die inladen: decisions/motion.md).
// Gebruikt de GSAP + SplitText + CustomEase die Webflow laadt; laadt zelf niets.
//
// Webflow-markup:
//   [data-slide-split]   een titel in een Swiper-slide (Lumos Slider). Alle elementen met dit
//                        attribuut in de nieuwe actieve slide splitsen in letters en bewegen samen,
//                        zodat een blauwe titel en zijn lichte kopie gelijk blijven lopen.
//
// Waarom een script: Webflow Interactions kennen geen "slide gewisseld"-trigger, en een interaction
// op de class laat de stagger door de titels van alle slides heen lopen.

(() => {
  const DURATION = 0.75;
  const STAGGER = 0.025;

  const init = () => {
    const gsap = window.gsap;
    if (!gsap || !window.SplitText) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(window.SplitText);
    let ease = 'power3.inOut';
    if (window.CustomEase) {
      gsap.registerPlugin(window.CustomEase);
      ease = window.CustomEase.create('pmsSlideTitle', '0.75,0,0.5,1');
    }

    const play = (slide) => {
      slide.querySelectorAll('[data-slide-split]').forEach((el) => {
        if (!el._pmsSplit) el._pmsSplit = new window.SplitText(el, { type: 'chars', mask: 'chars' });
        gsap.fromTo(el._pmsSplit.chars, { yPercent: 110 }, { yPercent: 0, duration: DURATION, ease, stagger: STAGGER, overwrite: true });
      });
    };

    const hook = (swiper) => {
      if (swiper.__pmsSlideTitle) return;
      swiper.__pmsSlideTitle = true;
      swiper.on('slideChangeTransitionStart', () => {
        const slide = swiper.slides[swiper.activeIndex];
        if (slide) play(slide);
      });
    };

    // Swiper zet el.swiper bij het opstarten; het Lumos-script kan na dit script draaien.
    let tries = 0;
    const scan = () => {
      let pending = false;
      document.querySelectorAll('.swiper').forEach((el) => {
        if (!el.querySelector('[data-slide-split]')) return;
        if (el.swiper) hook(el.swiper); else pending = true;
      });
      if (pending && tries++ < 40) setTimeout(scan, 100);
    };
    scan();
  };

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
