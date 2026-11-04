// Stone spin: draaiende steen uit een AI-video (Veo 3.1), vrijstaand. Map spin/<slug>/:
//   spin.webm (VP9 met alpha, Chrome/Firefox) en spin.mp4 (HEVC met alpha, Safari): 184 beelden, 24 per seconde, één rondje.
//   f000–f047.webp: beeldreeks (48 beelden) als terugval met data-mode="frames".
// De stilstaande steen (CMS Stone Image, zelfde uitsnede als beeld 0) blijft staan tot de steen echt draait,
// daarna vervaagt hij (600 ms). Pauzeert buiten beeld. Minder beweging: blijft de foto.
// Doelen: de steen in Product Hero (slug uit de URL /products/<slug>) en steenafbeeldingen in een link naar /products/<slug>.
(() => {
  const script = document.currentScript;
  const base = new URL('../spin/', script.src).href;
  const MODE = script.dataset.mode || 'video';
  const N = +(script.dataset.frames || 48), TURN = 8000; // beeldreeks: beelden en ms per rondje
  const SLUGS = (script.dataset.slugs || 'foundry-grade-chromite-sand,guyanese-bauxite').split(',');
  const TARGETS = script.dataset.targets || '.product-hero_stone';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const slugFromPath = p => (p.match(/\/(?:products|minerals)\/([^/?#]+)/) || [])[1];
  // Safari speelt alpha alleen in HEVC; Chrome speelt HEVC wel maar zonder alpha, dus op de browser kiezen
  const safari = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent);

  // Laag exact over het beeldvlak van de img leggen (object-fit: contain op een vierkant beeld)
  function overlay(img, el, onSize) {
    const parent = img.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { position: 'absolute', pointerEvents: 'none', opacity: '0', transition: 'opacity 600ms ease' });
    img.after(el);
    const fit = () => {
      const s = getComputedStyle(img);
      const bw = img.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      const bh = img.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
      const side = Math.min(bw, bh);
      Object.assign(el.style, {
        width: side + 'px', height: side + 'px',
        left: img.offsetLeft + parseFloat(s.paddingLeft) + (bw - side) / 2 + 'px',
        top: img.offsetTop + parseFloat(s.paddingTop) + (bh - side) / 2 + 'px',
      });
      onSize && onSize(side);
    };
    fit();
    new ResizeObserver(fit).observe(img);
  }
  function show(img, el) {
    el.style.opacity = '1';
    img.style.transition = 'opacity 600ms ease';
    img.style.opacity = '0';
  }

  function attachVideo(img, slug) {
    const v = document.createElement('video');
    v.className = 'stone-spin_video';
    v.muted = v.loop = v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.src = `${base}${slug}/spin.${safari ? 'mp4' : 'webm'}`;
    overlay(img, v);
    v.addEventListener('playing', () => show(img, v), { once: true });
    v.addEventListener('error', () => v.remove(), { once: true });
    // alleen afspelen als hij in beeld is en het tabblad zichtbaar is; geweigerd afspelen = foto blijft
    let visible = true;
    const sync = () => (visible && !document.hidden ? v.play().catch(() => {}) : v.pause());
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(img);
    document.addEventListener('visibilitychange', sync);
  }

  const sets = {};
  const loadFrames = slug => sets[slug] || (sets[slug] = Promise.all(Array.from({ length: N }, (_, i) => {
    const im = new Image();
    im.src = `${base}${slug}/f${String(i).padStart(3, '0')}.webp`;
    return im.decode().then(() => im);
  })));
  function attachFrames(img, frames) {
    const cv = document.createElement('canvas');
    cv.className = 'stone-spin_canvas';
    const ctx = cv.getContext('2d');
    let w = 0;
    overlay(img, cv, side => {
      w = Math.round(side * Math.min(devicePixelRatio || 1, 2));
      if (cv.width !== w) cv.width = cv.height = w;
    });
    let visible = true, start = 0;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
    // tussen twee beelden overvloeien ('lighter' telt A·(1−f) + B·f op, ook in de alpha)
    const tick = t => {
      if (visible && !document.hidden) {
        const p = ((t - start) % TURN) / TURN * N, i = Math.floor(p), f = p - i;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, w);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - f; ctx.drawImage(frames[i], 0, 0, w, w);
        ctx.globalAlpha = f; ctx.drawImage(frames[(i + 1) % N], 0, 0, w, w);
        ctx.globalAlpha = 1;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(t => { start = t; tick(t); show(img, cv); });
  }

  function init() {
    document.querySelectorAll(TARGETS).forEach(img => {
      if (img.dataset.stoneSpin) return;
      const link = img.closest('a[href*="/products/"], a[href*="/minerals/"]');
      const slug = link ? slugFromPath(link.getAttribute('href')) : slugFromPath(location.pathname);
      if (!SLUGS.includes(slug)) return;
      img.dataset.stoneSpin = slug;
      if (MODE === 'frames') loadFrames(slug).then(frames => attachFrames(img, frames)).catch(() => {});
      else attachVideo(img, slug);
    });
  }
  // na het laden van de pagina, zodat de steen niet concurreert met de rest
  if (document.readyState === 'complete') setTimeout(init, 200);
  else addEventListener('load', () => setTimeout(init, 200));
})();
