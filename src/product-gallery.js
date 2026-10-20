// Product gallery (Product Hero op de mineraalpagina): foto's in een strook met scroll-snap
// (vegen op touch werkt vanzelf), twee thumbnails als bediening.
// Laadt niets; werkt op attributen, zodat classes en componenten vrij kunnen veranderen.
//
// Webflow-markup:
//   [data-gallery]                 het kader
//     [data-gallery-track]         de strook (overflow-x auto + scroll-snap in de class)
//       [data-gallery-slide]       één per foto; slide zonder class is-stone = donkere foto
//     [data-gallery-meta]          formule/nummer; krijgt is-light op een donkere foto
//     button[data-gallery-thumb="0|1"]  thumbnails; actieve krijgt is-active + aria-pressed
//
// Minder beweging: springt zonder schuifanimatie.

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function init(root) {
    const track = root.querySelector('[data-gallery-track]');
    if (!track || track.dataset.galleryReady) return;
    track.dataset.galleryReady = 'true';
    const slides = [...track.querySelectorAll('[data-gallery-slide]')];
    const thumbs = [...root.querySelectorAll('[data-gallery-thumb]')];
    const meta = root.querySelector('[data-gallery-meta]');
    if (slides.length < 2) {
      thumbs.forEach((t) => (t.hidden = true));
      return;
    }
    let current = -1;
    // Beginpunt van een dia in de strook. De dia's zijn op hele pixels afgerond (Webflow-stijl
    // round(up, 100%, 1px)); i * clientWidth kon een halve pixel te kort zijn en liet dan een
    // streepje van de vorige dia zien.
    const offset = (i) => slides[i].offsetLeft - slides[0].offsetLeft;

    const set = (i) => {
      if (i === current) return;
      current = i;
      thumbs.forEach((t) => {
        const on = Number(t.getAttribute('data-gallery-thumb')) === i;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      slides.forEach((s, j) => s.setAttribute('aria-hidden', j === i ? 'false' : 'true'));
      if (meta) meta.classList.toggle('is-light', !slides[i].classList.contains('is-stone'));
    };

    const indexFromScroll = () => {
      const w = track.clientWidth || 1;
      return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / w)));
    };

    let raf = 0;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => set(indexFromScroll()));
    }, { passive: true });

    thumbs.forEach((t) => {
      t.addEventListener('click', () => {
        const i = Number(t.getAttribute('data-gallery-thumb')) || 0;
        set(i);
        track.scrollTo({ left: offset(i), behavior: reduce.matches ? 'auto' : 'smooth' });
      });
    });

    // Bij een andere breedte op dezelfde foto blijven staan.
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        if (current >= 0) track.scrollLeft = offset(current);
      }).observe(track);
    }

    set(0);
  }

  function boot() {
    document.querySelectorAll('[data-gallery]').forEach(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
