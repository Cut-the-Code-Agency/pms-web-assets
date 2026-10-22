// Smooth scroll: na een draai aan het muiswiel loopt de pagina kort en zacht uit (Lenis), zoals op
// woordvankracht.nl: zelfde afstand per wielstap (hun berekening met wheelDeltaY) en de uitloop die je daar
// op een 120 Hz-scherm ziet (0,42 s, expo-out). Alleen met een muis of trackpad; op touch, met prefers-reduced-motion en in een iframe
// (Designer-voorbeeld) blijft het gewone scrollen van de browser.
//
// - De browser scrolt zelf (Lenis zet elke frame de echte scrollpositie). Daardoor werken position: sticky
//   (Story Slides), de IX3-scrolltriggers, nav.js, de paginaovergang en het terugzetten van de scrollplek
//   gewoon door; geen wrapper, geen transform op de pagina.
// - Staat het menu open (Webflow zet dan overflow: hidden op body) of zit html/body om een andere reden op
//   slot, dan laat het script het wiel met rust: de pagina erachter blijft stil, net als zonder script.
// - Een blok dat zelf scrolt (modal_scroll, een lange lijst) scrolt eerst zelf (allowNestedScroll). Een
//   element dat het wiel helemaal zelf moet houden krijgt in Webflow het attribuut data-lenis-prevent.
// - Een klik op een link naar een andere pagina stopt het uitlopen meteen (paginaovergang).
// - Webflow's ScrollTrigger (IX3) krijgt elke scrollstap in hetzelfde frame, zodat inlaadanimaties niet haperen.
// - window.pmsLenis is de instantie (stop()/start() voor andere scripts).

import Lenis from 'lenis';

(() => {
  if (window.pmsLenis) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce || window.self !== window.top) return;

  const html = document.documentElement;
  const shut = (el) => /^(hidden|clip)$/.test(getComputedStyle(el).overflowY);

  const style = document.createElement('style');
  style.textContent = '.lenis [data-lenis-prevent]{overscroll-behavior:contain}.lenis.lenis-smooth iframe{pointer-events:none}';
  document.head.appendChild(style);

  // Afstand per wielstap precies zoals woordvankracht.nl: hun Lenis uit 2023 neemt niet deltaY maar de oudere
  // wheelDeltaY van de browser, × 0,4 op een Mac en × 0,84 op Windows/Linux. Op een echte Mac (Chrome en Safari)
  // is wheelDeltaY 3 × deltaY, dus daar gaat 100 px wiel naar 120 px; op Windows (120 per klik, deltaY 100) ±100 px.
  // Zonder wheelDeltaY (oudere Firefox): deltaY × 1,2 op een Mac, × 1 elders, dezelfde uitkomst.
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const win = /win|linux/i.test(platform);
  const factor = win ? 0.84 : 0.4;
  const fallback = win ? 1 : 1.2;
  const wheel = (data) => {
    const e = data.event;
    if (e.type !== 'wheel') return;
    if (e.wheelDeltaY || e.wheelDeltaX) {
      data.deltaX = -(e.wheelDeltaX || 0) * factor;
      data.deltaY = -(e.wheelDeltaY || 0) * factor;
    } else {
      data.deltaX *= fallback;
      data.deltaY *= fallback;
    }
  };

  // Uitloop: woordvankracht.nl zet duration 0,5 maar telt 10 ms per beeldje (raf(time += 10)), dus de echte
  // uitloop hangt af van het scherm: 0,83 s op 60 Hz, 0,42 s op 120 Hz (MacBook Pro). Hier vast 0,42 s, het
  // lichte gevoel van hun site op een 120 Hz-scherm, op elk scherm gelijk.
  const lenis = new Lenis({
    duration: 0.42, // 50 % na ±40 ms, 90 % na ±140 ms, stil na ±280 ms
    virtualScroll: wheel,
    easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    autoRaf: true,
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,
    // body staat in elk wielpad; zit de pagina op slot, dan doet Lenis niets en houdt de browser haar stil
    prevent: (node) => node === document.body && (shut(node) || shut(html)),
  });
  window.pmsLenis = lenis;

  const hook = () => { if (window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
