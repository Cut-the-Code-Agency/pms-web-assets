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
// Knoppen/opties zonder mineralen: disabled (knop ook class is-disabled, niet klikbaar).
// Actieve knop: class is-active + aria-pressed. Lijst krijgt is-filtered zolang er een
// industrie gekozen is (de trap in het raster geldt alleen bij "View all", zie de page-CSS).
// Keuze in de URL (?industry=<slug>) zodat een gefilterde lijst te delen is.

(function () {
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
        if (present.has(slug)) return;
        const option = new Option(name, slug);
        option.disabled = !hasMinerals(slug);
        select.add(option);
      });
    }

    const valid = (slug) => slug === 'all'
      || buttons.some((btn) => btn.getAttribute('data-filter') === slug && !btn.disabled)
      || (select && [...select.options].some((o) => o.value === slug && !o.disabled));

    const apply = (slug, push) => {
      const all = !slug || slug === 'all';
      buttons.forEach((btn) => {
        const on = btn.getAttribute('data-filter') === (all ? 'all' : slug);
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (select) select.value = all ? 'all' : slug;
      items.forEach((item) => {
        // style i.p.v. hidden: de class zet display: flex en wint van [hidden].
        item.style.display = !all && !tags.get(item).has(slug) ? 'none' : '';
      });
      list.classList.toggle('is-filtered', !all);
      if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') window.ScrollTrigger.refresh();
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
