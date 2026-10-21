// Quote Slider (Contact): de offerte hoort bij het mineraal dat in de slider in beeld is.
// Markup (Webflow-component Quote Slider):
//   [data-quote-title="Request a quote for"]   kop; wordt "Request a quote for <mineraal>"
//   [data-quote-slider]                         kaart met de Lumos Slider (Swiper) en Mineral Slides
//     .mineral-slide_wrap[data-name][data-slug] één mineraal (Name / Slug uit het CMS)
//     [data-quote-link] a                       "View product" → /minerals/<slug>
//   input[data-quote-product]                   verborgen veld "Product" in de Quote Form
// Zonder data-name valt het script terug op titel + graad uit de kaart. Zonder script: kop
// "Request a quote for our minerals", knop naar /minerals, Product leeg.

(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function nameOf(slide) {
    if (!slide) return '';
    const n = slide.getAttribute('data-name');
    if (n) return n.trim();
    const title = slide.querySelector('.mineral-slide_name h3, .mineral-slide_name h2');
    const grade = slide.querySelector('.mineral-slide_name > :not(h2):not(h3)');
    return [title && title.textContent.trim(), grade && grade.textContent.trim()].filter(Boolean).join(' ');
  }

  function setup(section) {
    const card = section.querySelector('[data-quote-slider]');
    const title = section.querySelector('[data-quote-title]');
    const input = section.querySelector('input[data-quote-product]');
    const link = section.querySelector('[data-quote-link] a');
    const swiperEl = card && card.querySelector('.swiper');
    if (!card || !swiperEl) return;
    const prefix = title ? title.getAttribute('data-quote-title') || 'Request a quote for' : '';
    let last = '';

    function update(swiper) {
      const slide = swiper.slides[swiper.activeIndex];
      const wrap = slide && (slide.matches('.mineral-slide_wrap') ? slide : slide.querySelector('.mineral-slide_wrap'));
      const name = nameOf(wrap);
      const slug = wrap ? wrap.getAttribute('data-slug') : '';
      if (input) input.value = name;
      if (link) {
        link.setAttribute('href', slug ? `/minerals/${slug}` : '/minerals');
        if (name) link.setAttribute('aria-label', `View product: ${name}`);
      }
      if (!title || !name || name === last) return;
      const text = `${prefix} ${name}`;
      if (last && !reduce.matches && 'animate' in title) {
        title.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'cubic-bezier(0.5, 0, 0.5, 1)' })
          .finished.then(() => {
            title.textContent = text;
            title.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'cubic-bezier(0.5, 0, 0.5, 1)' });
          }).catch(() => { title.textContent = text; });
      } else {
        title.textContent = text;
      }
      last = name;
    }

    // Meteen (vóór Webflow de titel in letters splitst voor de inlaadanimatie) de kop zetten op het
    // eerste mineraal; daarna volgt hij de slider.
    const first = card.querySelector('.mineral-slide_wrap');
    const firstName = nameOf(first);
    if (firstName) {
      if (title) title.textContent = `${prefix} ${firstName}`;
      if (input) input.value = firstName;
      const slug = first.getAttribute('data-slug');
      if (link && slug) link.setAttribute('href', `/minerals/${slug}`);
      last = firstName;
    }

    // De Lumos Slider maakt Swiper aan na het laden; wacht tot hij er is.
    let tries = 0;
    (function wait() {
      const swiper = swiperEl.swiper;
      if (swiper) {
        update(swiper);
        swiper.on('slideChange', () => update(swiper));
        // 15 streepjes zijn 15 tabstops vóór "View product"; pijlen en pijltoetsen blijven de bediening.
        const quiet = () => card.querySelectorAll('.slider_bullet_item').forEach((el) => el.setAttribute('tabindex', '-1'));
        quiet();
        swiper.on('paginationRender', quiet);
        swiper.on('paginationUpdate', quiet);
        return;
      }
      if (tries++ < 100) window.setTimeout(wait, 100);
    })();
  }

  function init() { document.querySelectorAll('[data-quote-slider]').forEach((card) => setup(card.closest('section') || card.parentElement)); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
