// Link preview: lijst met links waarbij een foto meekomt (Services Overview op Home).
// Gebruikt de GSAP die Webflow zelf laadt (Site settings › GSAP); laadt zelf niets.
//
// Webflow-markup:
//   [data-link-preview="section"]   de sectie (wrapper)
//   [data-link-preview="list"]      de lijst met items
//   [data-link-preview="item"]      één link (component Service Link)
//   [data-link-preview="image"]     verborgen houder met de foto van het item (<img>)
//   [data-link-preview="preview"]   desktop: het vlak dat de muis volgt
//   [data-link-preview="stage"]     mobiel: het vaste (sticky) vlak achter de lijst
//   .service-link_number            krijgt is-active als het item actief is (kleur in de class)
//
// Desktop (muis, ≥ 992 px): bij hover over een item schaalt de foto in vanuit linksboven op de
// cursor, volgt de muis met easing en schuift naar de foto van een ander item. Mobiel en tablet:
// het item in het midden van het scherm is actief (nummer blauw); pas als het scrollen stilstaat
// vloeit de foto van dat item langzaam over, zodat snel scrollen niet alle foto's langs laat flitsen.
// Timing: decisions/motion.md (hover 450/250 ms).

const IN = 0.45;
const OUT = 0.25;
const SWAP = 0.45; // foto wisselen in het kleine vlak
const FADE = 1.2; // foto wisselen schermvullend (mobiel), langzaam overvloeien
const SETTLE = 250; // ms stilstand na het scrollen voordat de foto wisselt
const FOLLOW = 0.6; // naijlen van de foto achter de muis
const OFFSET = 24; // px tussen cursor en linkerbovenhoek van de foto

function init() {
  const gsap = window.gsap;
  if (!gsap) return;

  const ease = { in: 'power2.inOut', out: 'power2.inOut', fade: 'sine.inOut', follow: 'power3.out' };
  if (window.CustomEase) {
    gsap.registerPlugin(window.CustomEase);
    ease.in = window.CustomEase.create('pmsHoverIn', '0.75,0,0.5,1');
    ease.out = window.CustomEase.create('pmsHoverOut', '0.5,0,0.75,1');
    ease.fade = window.CustomEase.create('pmsFade', '0.5,0,0.5,1');
  }

  const desktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 992px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const t = (d) => (reduce.matches ? 0 : d);

  document.querySelectorAll('[data-link-preview="section"]').forEach((section) => {
    const list = section.querySelector('[data-link-preview="list"]');
    const items = [...section.querySelectorAll('[data-link-preview="item"]')];
    const preview = section.querySelector('[data-link-preview="preview"]');
    const stage = section.querySelector('[data-link-preview="stage"]');
    if (!list || !items.length) return;

    const numbers = items.map((item) => item.querySelector('.service-link_number'));
    const sources = items.map((item) => item.querySelector('[data-link-preview="image"] img'));

    // Eén laag per item; de nieuwe laag schuift over de vorige heen.
    const makeLayers = (holder, before) =>
      sources.map((src) => {
        const img = document.createElement('img');
        img.className = 'services-overview_media';
        img.alt = '';
        img.decoding = 'async';
        if (src) {
          if (src.srcset) img.srcset = src.srcset;
          if (src.sizes) img.sizes = holder === stage ? '100vw' : '28rem';
          img.src = src.currentSrc || src.src;
        }
        holder.insertBefore(img, before || null);
        gsap.set(img, holder === stage ? { opacity: 0, zIndex: 0 } : { clipPath: 'inset(0% 0% 100% 0%)', zIndex: 0 });
        return img;
      });

    const small = preview ? makeLayers(preview) : [];
    const large = stage ? makeLayers(stage, stage.firstChild) : [];

    let active = -1;

    const mark = (index) => {
      numbers.forEach((n, i) => n && n.classList.toggle('is-active', i === index));
    };

    // Nieuwe foto schuift in vanuit de scrollrichting: naar beneden = van onder, omhoog = van boven.
    const swap = (layers, index, from, duration) => {
      const img = layers[index];
      if (!img) return;
      const start = from > index ? 'inset(0% 0% 100% 0%)' : 'inset(100% 0% 0% 0%)';
      gsap.killTweensOf(img);
      // Vorige foto blijft eronder liggen, de nieuwe komt erover; de rest zakt weg.
      layers.forEach((other, i) => gsap.set(other, { zIndex: i === index ? 2 : i === from ? 1 : 0 }));
      if (from < 0 || !duration) {
        gsap.set(img, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1 });
        return;
      }
      gsap.fromTo(img, { clipPath: start, scale: 1.15 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration, ease: ease.in });
    };

    const activate = (index, layers, duration) => {
      if (index === active) return;
      const from = active;
      active = index;
      mark(index);
      swap(layers, index, from, duration);
    };

    // ---- Desktop: foto volgt de muis ----
    let shown = false;
    // quickTo opnieuw na elke reset: killTweensOf beëindigt ook de quickTo-tweens.
    let xTo;
    let yTo;
    const follow = () => {
      if (!preview) return;
      xTo = gsap.quickTo(preview, 'x', { duration: FOLLOW, ease: ease.follow });
      yTo = gsap.quickTo(preview, 'y', { duration: FOLLOW, ease: ease.follow });
    };

    const place = (x, y, instant) => {
      if (!preview) return;
      if (instant || reduce.matches) {
        gsap.set(preview, { x, y });
        xTo(x);
        yTo(y);
      } else {
        xTo(x);
        yTo(y);
      }
    };

    const show = (on) => {
      if (!preview || shown === on) return;
      shown = on;
      gsap.to(preview, {
        opacity: on ? 1 : 0,
        scale: on ? 1 : 0,
        transformOrigin: '0% 0%',
        duration: t(on ? IN : OUT),
        ease: on ? ease.in : ease.out,
        overwrite: 'auto',
      });
      if (!on) {
        active = -1;
        mark(-1);
      }
    };

    const pointer = (e) => {
      const box = section.getBoundingClientRect();
      return { x: e.clientX - box.left + OFFSET, y: e.clientY - box.top + OFFSET };
    };

    list.addEventListener('mousemove', (e) => {
      if (!desktop.matches || !shown) return;
      const p = pointer(e);
      place(p.x, p.y);
    });

    items.forEach((item, index) => {
      item.addEventListener('mouseenter', (e) => {
        if (!desktop.matches) return;
        const p = pointer(e);
        if (!shown) place(p.x, p.y, true);
        show(true);
        activate(index, small, t(SWAP));
      });
      // Toetsenbord: foto naast het gefocuste item, zonder meebewegen.
      item.addEventListener('focusin', (e) => {
        if (!desktop.matches || !e.target.matches(':focus-visible')) return;
        const box = section.getBoundingClientRect();
        const row = item.getBoundingClientRect();
        place(row.left - box.left + row.width * 0.6, row.top - box.top, !shown);
        show(true);
        activate(index, small, t(SWAP));
      });
      item.addEventListener('focusout', (e) => {
        if (desktop.matches && !list.contains(e.relatedTarget)) show(false);
      });
    });

    list.addEventListener('mouseleave', () => {
      if (desktop.matches) show(false);
    });

    // ---- Mobiel en tablet: actief item = het item in het midden van het scherm ----
    // De foto volgt pas als het scrollen SETTLE ms stilstaat, en vloeit dan over (opacity).
    let photo = -1;
    let settle = 0;
    const fade = (index, instant) => {
      if (index === photo || !large[index]) return;
      const from = photo;
      photo = index;
      const img = large[index];
      gsap.killTweensOf(large); // een lopende overgang blijft staan; de nieuwe foto komt eroverheen
      large.forEach((other, i) => gsap.set(other, { zIndex: i === index ? 2 : i === from ? 1 : 0 }));
      if (instant || from < 0 || reduce.matches) {
        large.forEach((other, i) => gsap.set(other, { opacity: i === index ? 1 : 0, scale: 1 }));
        return;
      }
      gsap.fromTo(img, { opacity: 0, scale: 1.04 }, {
        opacity: 1,
        scale: 1,
        duration: FADE,
        ease: ease.fade,
        onComplete: () => large.forEach((other, i) => i !== index && gsap.set(other, { opacity: 0 })),
      });
    };

    let ticking = false;
    const pick = (instant) => {
      ticking = false;
      if (desktop.matches || !stage) return;
      const middle = window.innerHeight / 2;
      let best = 0;
      let distance = Infinity;
      items.forEach((item, index) => {
        const box = item.getBoundingClientRect();
        const d = Math.abs(box.top + box.height / 2 - middle);
        if (d < distance) {
          distance = d;
          best = index;
        }
      });
      if (best !== active) {
        active = best;
        mark(best);
      }
      clearTimeout(settle);
      if (instant === true) fade(best, true);
      else settle = setTimeout(() => fade(best), SETTLE);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(pick);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // Wisselen tussen desktop en mobiel: alles terug naar rust.
    const reset = () => {
      gsap.killTweensOf([preview, ...small, ...large].filter(Boolean));
      small.forEach((img) => gsap.set(img, { clipPath: 'inset(0% 0% 100% 0%)', scale: 1, zIndex: 0 }));
      large.forEach((img) => gsap.set(img, { opacity: 0, scale: 1, zIndex: 0 }));
      clearTimeout(settle);
      photo = -1;
      if (preview) gsap.set(preview, { opacity: 0, scale: 0 });
      follow();
      shown = false;
      active = -1;
      mark(-1);
      if (!desktop.matches) pick(true);
    };
    desktop.addEventListener('change', reset);
    reset();
  });
}

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
