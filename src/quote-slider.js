// Quote Slider (Contact): de offerte hoort bij het mineraal dat in de slider in beeld is.
// Markup (Webflow-component Quote Slider):
//   [data-quote-title="Request a quote for"]   kop; wordt "Request a quote for <mineraal>". Vanaf 992 px staat
//                                               de naam op een eigen regel en is de kop zo hoog als de hoogste
//                                               naam (formulier verspringt niet); ≤ 991 groeit of krimpt de kop
//                                               zacht mee met de naam (300 ms), de kaart schuift mee.
//   [data-quote-form-title="Request a quote for"] kleine herhaling boven het formulier (≤ 991): prefix + naam in
//                                               een span.quote-slider_form_name; wisselt met een korte fade.
//   [data-quote-slider]                         kaart met de Lumos Slider (Swiper) en Mineral Slides
//     .mineral-slide_wrap[data-name][data-slug] één mineraal (Name / Slug uit het CMS)
//     [data-quote-link] a                       "View product" → /products/<slug>
//   input[data-quote-product]                   verborgen veld "Product" in de Quote Form
// Zonder data-name valt het script terug op titel + graad uit de kaart. Zonder script: kop
// "Request a quote for our minerals", knop naar /products, Product leeg.

(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 992px)');
  // Kop: op desktop de naam op een eigen regel, kleiner gewoon erachter.
  const head = (prefix, ...name) => (wide.matches ? [prefix, document.createElement('br'), ...name] : [`${prefix} `, ...name]);

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
    const formTitle = section.querySelector('[data-quote-form-title]');
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
        link.setAttribute('href', slug ? `/products/${slug}` : '/products');
        if (name) link.setAttribute('aria-label', `View product: ${name}`);
      }
      if (!name || name === last) return;
      last = name;
      setFormTitle(name);
      if (!title) return;
      if (reduce.matches || !('animate' in title)) { title.replaceChildren(...head(prefix, name)); return; }
      swap(name);
    }

    // Wissel van mineraal: de letters van de oude naam gaan omhoog uit hun masker, die van de nieuwe
    // komen er letter voor letter in (zoals de titels in de slider op Home: 750 ms, 0.75,0,0.5,1, 25 ms).
    // "Request a quote for" blijft staan. Schermlezers lezen de naam uit een sr-only kopie.
    const IN = 'cubic-bezier(0.75, 0, 0.5, 1)', OUT = 'cubic-bezier(0.5, 0, 0.75, 1)';
    let run = 0;

    // Kleine herhaling boven het formulier (≤ 991 zichtbaar, CSS): "Request a quote for <naam>".
    function formTitleContent(name) {
      const span = document.createElement('span');
      span.className = 'quote-slider_form_name';
      span.textContent = name;
      return [`${formTitle.getAttribute('data-quote-form-title') || prefix || 'Request a quote for'} `, span];
    }
    let formRun = 0;
    async function setFormTitle(name) {
      if (!formTitle) return;
      if (reduce.matches || !('animate' in formTitle) || !formTitle.textContent.trim()) { formTitle.replaceChildren(...formTitleContent(name)); return; }
      const me = ++formRun;
      const out = formTitle.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: OUT, fill: 'forwards' });
      await out.finished.catch(() => {});
      if (me !== formRun) return;
      formTitle.replaceChildren(...formTitleContent(name));
      out.cancel(); // anders blijft de vulling (opacity 0) van de uitfade staan na de infade
      formTitle.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
    }

    // ≤ 991: de kop is zo hoog als de naam; bij een wissel loopt de hoogte in 300 ms naar de nieuwe stand
    // (zelfde duur als de letters die weggaan), zodat de kaart eronder niet springt maar meeschuift.
    function growTo(from) {
      if (wide.matches || reduce.matches) return;
      title.style.height = '';
      const to = title.offsetHeight;
      if (Math.abs(to - from) < 1) return;
      title.style.height = `${from}px`;
      title.style.overflow = 'hidden';
      void title.offsetHeight;
      title.style.transition = `height 300ms ${OUT}`;
      title.style.height = `${to}px`;
      const done = (e) => { if (e && e.target !== title) return; title.style.height = ''; title.style.overflow = ''; title.style.transition = ''; title.removeEventListener('transitionend', done); };
      title.addEventListener('transitionend', done);
      setTimeout(done, 400);
    }
    function letters(name) {
      const wrap = document.createElement('span');
      wrap.setAttribute('aria-hidden', 'true');
      name.split(' ').forEach((word, i) => {
        if (i) wrap.append(' ');
        const w = document.createElement('span');
        w.style.cssText = 'display:inline-block;white-space:nowrap';
        for (const ch of word) {
          const mask = document.createElement('span');
          mask.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:0.12em;margin-bottom:-0.12em';
          const c = document.createElement('span');
          c.style.cssText = 'display:inline-block';
          c.setAttribute('data-quote-char', '');
          c.textContent = ch;
          mask.append(c);
          w.append(mask);
        }
        wrap.append(w);
      });
      return wrap;
    }
    async function swap(name) {
      const me = ++run;
      const old = [...title.querySelectorAll('[data-quote-char]')];
      if (old.length) {
        await Promise.all(old.map((c, i) => c.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-110%)' }],
          { duration: 300, delay: i * 10, easing: OUT, fill: 'forwards' }).finished.catch(() => {})));
        if (me !== run) return;
      }
      const sr = document.createElement('span');
      sr.className = 'u-sr-only';
      sr.textContent = name;
      const vis = letters(name);
      vis.setAttribute('data-quote-name', '');
      const before = title.offsetHeight;
      title.replaceChildren(...head(prefix, sr, vis));
      growTo(before);
      [...vis.querySelectorAll('[data-quote-char]')].forEach((c, i) => c.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }],
        { duration: 750, delay: i * 25, easing: IN, fill: 'backwards' }));
    }

    // Meteen (vóór Webflow de titel in letters splitst voor de inlaadanimatie) de kop zetten op het
    // eerste mineraal; daarna volgt hij de slider.
    const first = card.querySelector('.mineral-slide_wrap');
    const firstName = nameOf(first);
    if (firstName) {
      if (title) title.replaceChildren(...head(prefix, firstName));
      if (formTitle) formTitle.replaceChildren(...formTitleContent(firstName));
      if (input) input.value = firstName;
      const slug = first.getAttribute('data-slug');
      if (link && slug) link.setAttribute('href', `/products/${slug}`);
      last = firstName;
    }

    // Desktop: kophoogte vast op de hoogste variant, zodat het formulier niet verspringt bij korte en lange
    // namen. ≤ 991 geen vaste hoogte vanuit het script (daar gelden de min-heights uit de embed).
    if (title) {
      const names = [...new Set([...card.querySelectorAll('.mineral-slide_wrap')].map(nameOf).filter(Boolean))];
      const fit = () => {
        if (!wide.matches) { title.style.minHeight = ''; return; }
        const probe = title.cloneNode(false);
        probe.removeAttribute('aria-live');
        probe.setAttribute('aria-hidden', 'true');
        Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', minHeight: '0', width: `${title.clientWidth}px`, left: '0', top: '0' });
        title.parentNode.append(probe);
        let h = 0;
        for (const n of names) { probe.replaceChildren(prefix, document.createElement('br'), n); h = Math.max(h, probe.offsetHeight); }
        probe.remove();
        if (h) title.style.minHeight = `${Math.ceil(h)}px`;
      };
      fit();
      if (document.fonts) document.fonts.ready.then(fit);
      wide.addEventListener('change', () => {
        // Breedte wisselt over 992 px: kop opnieuw opbouwen in de juiste vorm (zonder animatie).
        if (last) title.replaceChildren(...head(prefix, last));
        fit();
      });
      let w = title.clientWidth;
      if ('ResizeObserver' in window) new ResizeObserver(() => { if (title.clientWidth !== w) { w = title.clientWidth; fit(); } }).observe(title);
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
