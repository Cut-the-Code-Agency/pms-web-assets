// Minerals-raster: filteren op industrie (pagina /minerals en de mineraalpagina).
// Laadt niets van buiten de site; werkt op attributen, zodat classes en componenten vrij kunnen veranderen.
//
// Webflow-markup:
//   [data-minerals-filters]           de rij met filterknoppen of het keuzemenu
//     button[data-filter="all"]       "View all"
//     button[data-filter="<slug>"]    één per industrie (CMS Industries, slug)
//     select[data-minerals-filter-select]   (optioneel, i.p.v. knoppen) keuzemenu; option value="all"
//                                     staat er al, de industrieën vult dit script
//   [data-filter-list]                de lijst met kaarten (CMS Minerals)
//     [data-filter-item="<slug>"]     één item per mineraal (slug van het mineraal)
//   [data-minerals-industries]        verborgen gegevenslijst buiten de kaartenlijst (CMS Minerals)
//     [data-mineral="<slug>"]         één per mineraal
//       [data-industry="<slug>"]      één per gekoppelde industrie (geneste lijst, multi-reference)
//
// Staat de gegevenslijst niet op de pagina (mineraalpagina: een geneste lijst op het huidige item
// kan via de API niet), dan haalt het script hem op van de pagina in data-minerals-source
// (bv. "/minerals") en leest daar ook de namen van de industrieën uit de filterknoppen.
//
// De industrieën staan in een aparte lijst omdat een component met een geneste CMS-lijst
// in Webflow niet kan; de kaartenlijst is een component (Minerals Grid List).
// Oude opbouw (data-industry binnen het item) werkt ook nog.
//
// Knoppen zonder mineralen: disabled (class is-disabled, niet klikbaar; Minerals verbergt ze via de page-CSS).
// Keuzemenu: industrieën zonder mineralen krijgen geen optie (een verborgen option werkt niet op iOS).
// Actieve knop: class is-active + aria-pressed. Lijst krijgt is-filtered zolang er een
// industrie gekozen is (de trap in het raster geldt alleen bij "View all", zie de page-CSS).
// Keuze in de URL (?industry=<slug>) zodat een gefilterde lijst te delen is.
//
// Overgang bij filteren: kaarten die weggaan faden uit en krimpen iets, kaarten die blijven
// schuiven naar hun nieuwe plek (FLIP), nieuwe kaarten komen met de site-fade-up na elkaar binnen.
// Opnieuw klikken tijdens een overgang gaat verder vanaf waar de kaarten op dat moment staan.
// Minder beweging: direct de eindstand.

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE_IN = 'cubic-bezier(.5, 0, .75, 1)';
  const EASE_MOVE = 'cubic-bezier(.75, 0, .5, 1)';
  const EASE_OUT = 'cubic-bezier(.25, 1, .5, 1)';
  const OUT_MS = 250;
  const MOVE_MS = 700;
  const IN_MS = 750;
  const IN_DELAY_MS = 200;
  const IN_STAGGER_MS = 60;

  const slugsIn = (el) => [...el.querySelectorAll('[data-industry]')].map((tag) => tag.getAttribute('data-industry'));

  function readData(doc) {
    const byMineral = new Map();
    doc.querySelectorAll('[data-minerals-industries] [data-mineral]').forEach((el) => {
      byMineral.set(el.getAttribute('data-mineral'), slugsIn(el));
    });
    const names = [];
    doc.querySelectorAll('[data-minerals-filters] [data-filter]').forEach((btn) => {
      const slug = btn.getAttribute('data-filter');
      if (slug && slug !== 'all') names.push([slug, btn.textContent.trim()]);
    });
    return { byMineral, names };
  }

  function setup(bar, list, data) {
    const buttons = [...bar.querySelectorAll('[data-filter]')];
    const select = bar.querySelector('select[data-minerals-filter-select]');
    const items = [...list.querySelectorAll('[data-filter-item]')];
    const tags = new Map(items.map((item) => [
      item,
      new Set([...(data.byMineral.get(item.getAttribute('data-filter-item')) || []), ...slugsIn(item)]),
    ]));
    const hasMinerals = (slug) => items.some((item) => tags.get(item).has(slug));

    // Industrieën zonder mineralen uitschakelen.
    buttons.forEach((btn) => {
      const slug = btn.getAttribute('data-filter');
      if (slug === 'all') return;
      const empty = !hasMinerals(slug);
      btn.disabled = empty;
      btn.classList.toggle('is-disabled', empty);
      if (empty) btn.setAttribute('aria-disabled', 'true');
      else btn.removeAttribute('aria-disabled');
    });

    if (select) {
      const present = new Set([...select.options].map((o) => o.value));
      data.names.forEach(([slug, name]) => {
        if (present.has(slug) || !hasMinerals(slug)) return;
        select.add(new Option(name, slug));
      });
    }

    const valid = (slug) => slug === 'all'
      || buttons.some((btn) => btn.getAttribute('data-filter') === slug && !btn.disabled)
      || (select && [...select.options].some((o) => o.value === slug && !o.disabled));

    const wanted = (item, all, slug) => all || tags.get(item).has(slug);

    const layout = (all, slug) => {
      items.forEach((item) => {
        // style i.p.v. hidden: de class zet display: flex en wint van [hidden].
        item.style.display = wanted(item, all, slug) ? '' : 'none';
      });
      list.classList.toggle('is-filtered', !all);
      if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') window.ScrollTrigger.refresh();
    };

    let generation = 0;
    let running = [];
    const play = (el, frames, options) => {
      const anim = el.animate(frames, options);
      running.push(anim);
      return anim;
    };
    const stopAll = () => {
      running.forEach((anim) => anim.cancel());
      running = [];
    };
    const shift = (from, to) => `translate(${from.left - to.left}px, ${from.top - to.top}px)`;

    const transition = (all, slug) => {
      if (reduce.matches || typeof list.animate !== 'function') {
        stopAll();
        layout(all, slug);
        return;
      }
      const id = ++generation;

      // Waar staat elke zichtbare kaart nu echt (ook midden in een vorige overgang)?
      const before = new Map();
      items.forEach((item) => {
        if (item.style.display === 'none') return;
        before.set(item, { rect: item.getBoundingClientRect(), opacity: parseFloat(getComputedStyle(item).opacity) || 0 });
      });
      stopAll();

      // Fase 1: weggaande kaarten uit; de rest blijft staan waar hij nu staat.
      const outs = [];
      const holds = [];
      before.forEach((b, item) => {
        const from = { transform: shift(b.rect, item.getBoundingClientRect()), opacity: b.opacity };
        if (wanted(item, all, slug)) {
          holds.push(play(item, [from, from], { duration: OUT_MS, fill: 'forwards' }));
        } else {
          outs.push(play(item, [from, { transform: `${from.transform} scale(.96)`, opacity: 0 }], { duration: OUT_MS, easing: EASE_IN, fill: 'forwards' }));
        }
      });

      const settle = () => {
        if (id !== generation) return;
        layout(all, slug);
        holds.concat(outs).forEach((anim) => anim.cancel());
        running = running.filter((anim) => !holds.includes(anim) && !outs.includes(anim));

        // Fase 2: blijvers schuiven naar hun nieuwe plek, nieuwkomers komen na elkaar binnen.
        let n = 0;
        items.forEach((item) => {
          if (!wanted(item, all, slug)) return;
          const b = before.get(item);
          if (b) {
            const now = item.getBoundingClientRect();
            if (Math.abs(b.rect.left - now.left) < 0.5 && Math.abs(b.rect.top - now.top) < 0.5 && b.opacity > 0.99) return;
            play(item, [{ transform: shift(b.rect, now), opacity: b.opacity }, { transform: 'none', opacity: 1 }], { duration: MOVE_MS, easing: EASE_MOVE });
          } else {
            play(item, [{ transform: 'translateY(1.25rem)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
              duration: IN_MS,
              delay: IN_DELAY_MS + n++ * IN_STAGGER_MS,
              easing: EASE_OUT,
              fill: 'backwards',
            });
          }
        });
      };

      if (!outs.length) settle();
      else Promise.all(outs.map((anim) => anim.finished)).then(settle, () => {});
    };

    const apply = (slug, push) => {
      const all = !slug || slug === 'all';
      buttons.forEach((btn) => {
        const on = btn.getAttribute('data-filter') === (all ? 'all' : slug);
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (select) select.value = all ? 'all' : slug;
      if (push) transition(all, slug);
      else layout(all, slug);
      if (push) {
        const url = new URL(window.location.href);
        if (all) url.searchParams.delete('industry');
        else url.searchParams.set('industry', slug);
        window.history.replaceState(null, '', url);
      }
    };

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => apply(btn.getAttribute('data-filter'), true));
    });
    if (select) select.addEventListener('change', () => apply(select.value, true));

    const start = new URLSearchParams(window.location.search).get('industry');
    if (start && valid(start)) apply(start, false);
  }

  function init() {
    const bar = document.querySelector('[data-minerals-filters]');
    const list = document.querySelector('[data-filter-list]');
    if (!bar || !list) return;

    const local = readData(document);
    const source = bar.getAttribute('data-minerals-source');
    if (local.byMineral.size || !source) {
      setup(bar, list, local);
      return;
    }
    fetch(source, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
      .then((html) => setup(bar, list, readData(new DOMParser().parseFromString(html, 'text/html'))))
      .catch(() => {
        // Geen gegevens: keuzemenu verbergen, het raster blijft compleet.
        const select = bar.querySelector('select[data-minerals-filter-select]');
        if (select) bar.hidden = true;
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
