// Slide title: bij elke slidewissel komt de titel van de nieuwe slide letter voor letter omhoog
// (zelfde beweging als de titels die inladen: decisions/motion.md).
// Gebruikt de GSAP + SplitText + CustomEase die Webflow laadt; laadt zelf niets.
//
// Webflow-markup:
//   [data-slide-split]   een titel in een Swiper-slide (Lumos Slider). Alle elementen met dit
//                        attribuut in de nieuwe actieve slide splitsen in letters en bewegen samen,
//                        zodat een blauwe titel en zijn lichte kopie gelijk blijven lopen.
//   --slide-split: off   (CSS) op zo'n element: geen letteranimatie, bv. waar de titel al in beeld stond.
// Letters staan per woord bij elkaar (woorden breken niet), koppen houden hun tekst voor schermlezers (aria-label).
// In een lus-slider is de actieve slide altijd leesbaar, ook als het een Swiper-kopie is (zie expose).
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

    // Letters per woord: elk woord een inline-block dat niet breekt, zodat een lange naam ("Guyanese bauxite") op
    // een woordgrens naar de volgende regel gaat en niet midden in een woord.
    // Schermlezers: de stukjes zijn aria-hidden. Een kop krijgt zijn tekst als aria-label (een aria-label op een
    // gewone div of span lezen schermlezers niet voor); andere tekst (de graad) een onzichtbare kopie op zijn plek
    // vóór of na de kop, als los kind (niet in de graad zelf, zodat scripts die die tekst lezen, zoals
    // quote-slider.js, niets dubbel krijgen; wel binnen het element, zodat een verborgen weergave stil blijft).
    const HEADING = 'h1,h2,h3,h4,h5,h6,[role="heading"]';
    const SR = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
    const clean = (t) => t.replace(/\s+/g, ' ').trim();
    const srCopy = (texts, where, anchor) => {
      if (!texts.length) return;
      const sr = document.createElement('span');
      sr.textContent = texts.join(' ');
      sr.style.cssText = SR;
      anchor.insertAdjacentElement(where, sr);
    };
    const split = (el) => {
      // Stil als het element zelf (of iets tussen het element en zijn slide) aria-hidden is, zoals de lichte kopie;
      // de slide zelf telt niet mee, want de slider zet aria-hidden op slides buiten beeld en haalt het weer weg.
      let read = true;
      for (let n = el; n && !n.classList.contains('swiper-slide'); n = n.parentElement) {
        if (n.getAttribute('aria-hidden') === 'true') read = false;
      }
      const heads = !read ? [] : el.matches(HEADING) ? [el] : [...el.querySelectorAll(HEADING)];
      const before = [], after = [];
      if (read) {
        [el, ...el.querySelectorAll('*')].forEach((n) => {
          if (n.children.length || n.closest(HEADING) || !clean(n.textContent)) return;
          const behind = heads.length && heads[0].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING;
          (behind ? after : before).push(clean(n.textContent));
        });
        heads.forEach((h) => h.setAttribute('aria-label', clean(h.textContent)));
      }
      const s = new window.SplitText(el, { type: 'words,chars', mask: 'chars', aria: 'none' });
      s.words.forEach((w) => { w.style.whiteSpace = 'nowrap'; w.setAttribute('aria-hidden', 'true'); });
      if (heads.length) srCopy(before, 'beforebegin', heads[0]); else srCopy(before, 'beforeend', el);
      srCopy(after, 'beforeend', el);
      return s;
    };

    const play = (slide) => {
      slide.querySelectorAll('[data-slide-split]').forEach((el) => {
        // Uit te zetten per weergave met CSS: --slide-split: off (bv. Mineral Slide Card, waar de titel al zichtbaar is).
        if (getComputedStyle(el).getPropertyValue('--slide-split').trim() === 'off') return;
        if (!el._pmsSplit) el._pmsSplit = split(el);
        gsap.fromTo(el._pmsSplit.chars, { yPercent: 110 }, { yPercent: 0, duration: DURATION, ease, stagger: STAGGER, overwrite: true });
      });
    };

    // Lus (Slider met is-loop): de PMS-embed in de Slider maakt Swiper-kopieën aria-hidden + inert, zodat elk
    // mineraal één keer gelezen wordt. Na een rondje staat de actieve slide echter op een kopie en hoort een
    // schermlezer niets. Daarom: is de actieve slide een kopie, dan wordt die leesbaar en de echte slide met
    // dezelfde index (buiten beeld) stil; bij de volgende wissel gaat alles terug. Draait na de embed
    // (die luistert eerder op dezelfde events), de Lumos-sliderbron blijft ongewijzigd.
    const SHOWN = 'data-pms-copy-shown', STILL = 'data-pms-twin-still';
    const expose = (swiper) => {
      if (!swiper.params || !swiper.params.loop || !swiper.slides) return;
      const slides = Array.from(swiper.slides); // gewone array: Swiper 8 geeft een Dom7-lijst met een eigen find()
      const active = slides[swiper.activeIndex];
      const copy = active && active.classList.contains('swiper-slide-duplicate') ? active : null;
      const index = copy && copy.getAttribute('data-swiper-slide-index');
      const twin = copy && slides.find((s) => !s.classList.contains('swiper-slide-duplicate') && s.getAttribute('data-swiper-slide-index') === index);
      slides.forEach((s) => {
        if (s !== copy && s.hasAttribute(SHOWN)) { s.setAttribute('aria-hidden', 'true'); s.inert = true; s.removeAttribute(SHOWN); }
        if (s !== twin && s.hasAttribute(STILL)) { s.removeAttribute('aria-hidden'); s.inert = false; s.removeAttribute(STILL); }
      });
      if (copy && (copy.inert || copy.getAttribute('aria-hidden') === 'true')) { copy.removeAttribute('aria-hidden'); copy.inert = false; copy.setAttribute(SHOWN, ''); }
      if (twin && !twin.hasAttribute(STILL)) { twin.setAttribute('aria-hidden', 'true'); twin.inert = true; twin.setAttribute(STILL, ''); }
    };

    const hook = (swiper) => {
      if (swiper.__pmsSlideTitle) return;
      swiper.__pmsSlideTitle = true;
      swiper.on('slideChangeTransitionStart', () => {
        const slide = swiper.slides[swiper.activeIndex];
        if (slide) play(slide);
      });
      ['slideChange', 'loopFix', 'update', 'slidesLengthChange'].forEach((ev) => swiper.on(ev, () => expose(swiper)));
      expose(swiper);
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
