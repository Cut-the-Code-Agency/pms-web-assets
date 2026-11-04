// Stone spin: draaiende steen als beeldreeks (AI-video → 48 vrijstaande WebP's per mineraal, map spin/<slug>/).
// De stilstaande steen (CMS Stone Image, zelfde uitsnede als beeld 0) blijft staan tot alle beelden binnen zijn,
// daarna vervaagt hij naar een canvas dat vanzelf rondjes draait. Minder beweging: blijft de foto.
// Doelen: de steen in Product Hero (slug uit de URL) en steenafbeeldingen in een link naar /minerals/<slug>.
(() => {
  const script = document.currentScript;
  const base = new URL('../spin/', script.src).href;
  const N = 48, TURN = 8000; // beelden per rondje, ms per rondje
  const SLUGS = (script.dataset.slugs || 'chromite-foundry-grade,bauxite-guyanese').split(',');
  const TARGETS = script.dataset.targets || '.product-hero_stone';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const slugFromPath = p => (p.match(/\/minerals\/([^/?#]+)/) || [])[1];
  const sets = {};
  const load = slug => sets[slug] || (sets[slug] = Promise.all(Array.from({ length: N }, (_, i) => {
    const im = new Image();
    im.src = `${base}${slug}/f${String(i).padStart(3, '0')}.webp`;
    return im.decode().then(() => im);
  })));

  function attach(img, frames) {
    const parent = img.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.className = 'stone-spin_canvas';
    Object.assign(cv.style, { position: 'absolute', pointerEvents: 'none', opacity: '0', transition: 'opacity 600ms ease' });
    img.after(cv);
    const ctx = cv.getContext('2d');
    let w = 0, h = 0;
    const fit = () => {
      // canvas exact over het beeldvlak van de img (object-fit: contain op een vierkant beeld)
      const s = getComputedStyle(img), dpr = Math.min(devicePixelRatio || 1, 2);
      const bw = img.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      const bh = img.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
      const side = Math.min(bw, bh);
      Object.assign(cv.style, {
        width: side + 'px', height: side + 'px',
        left: img.offsetLeft + parseFloat(s.paddingLeft) + (bw - side) / 2 + 'px',
        top: img.offsetTop + parseFloat(s.paddingTop) + (bh - side) / 2 + 'px',
      });
      w = h = Math.round(side * dpr);
      if (cv.width !== w) { cv.width = w; cv.height = h; }
    };
    fit();
    new ResizeObserver(fit).observe(img);

    let visible = true, start = performance.now(), last = -1;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
    const tick = t => {
      if (visible && !document.hidden) {
        const i = Math.floor(((t - start) % TURN) / TURN * N);
        if (i !== last) { ctx.clearRect(0, 0, w, h); ctx.drawImage(frames[i], 0, 0, w, h); last = i; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(t => {
      start = t; tick(t);
      cv.style.opacity = '1';
      img.style.transition = 'opacity 600ms ease';
      img.style.opacity = '0';
    });
  }

  function init() {
    document.querySelectorAll(TARGETS).forEach(img => {
      if (img.dataset.stoneSpin) return;
      const link = img.closest('a[href*="/minerals/"]');
      const slug = link ? slugFromPath(link.getAttribute('href')) : slugFromPath(location.pathname);
      if (!SLUGS.includes(slug)) return;
      img.dataset.stoneSpin = slug;
      load(slug).then(frames => attach(img, frames)).catch(() => {});
    });
  }
  // na het laden van de pagina, zodat de beeldreeks niet concurreert met de rest
  if (document.readyState === 'complete') setTimeout(init, 200);
  else addEventListener('load', () => setTimeout(init, 200));
})();
