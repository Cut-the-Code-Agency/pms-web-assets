// Mask image: een element krijgt de foto uit zijn blok als CSS-mask.
// Gebruik: lichte titel boven een steen. De titel is alleen te zien waar de (transparante) foto
// niet doorzichtig is, dus wit op de steen en onzichtbaar ernaast; daaronder staat de blauwe titel.
//
// Webflow-markup:
//   [data-mask-source]   het blok met de foto (bv. mineral-slide_visual)
//   [data-mask-image]    het element dat de mask krijgt; staat even groot als het blok
//                        (in de class: mask-size 100% 100%, mask-repeat no-repeat, en als
//                        beginwaarde een lege mask, zodat het zonder script onzichtbaar blijft)
//
// Waarom een script: de foto komt uit het CMS (per slide anders) en Webflow kan een CMS-foto
// niet aan mask-image koppelen. Werkt ook voor de kopieën die Swiper voor de lus maakt.

(() => {
  const apply = () => {
    document.querySelectorAll('[data-mask-image]').forEach((el) => {
      const img = el.closest('[data-mask-source]')?.querySelector('img');
      if (!img) return;
      const url = img.currentSrc || img.getAttribute('src');
      if (!url || el.dataset.maskUrl === url) return;
      el.dataset.maskUrl = url;
      const value = `url("${url}")`;
      el.style.webkitMaskImage = value;
      el.style.maskImage = value;
    });
  };

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  };

  const start = () => {
    apply();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') schedule(); }, true);
    window.addEventListener('load', schedule);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
