// Minerals-raster: filteren op industrie (pagina /minerals).
// Laadt niets; werkt op attributen, zodat classes en componenten vrij kunnen veranderen.
//
// Webflow-markup:
//   [data-minerals-filters]           de rij met filterknoppen
//     button[data-filter="all"]       "View all"
//     button[data-filter="<slug>"]    één per industrie (CMS Industries, slug)
//   [data-filter-list]                de lijst met kaarten (CMS Minerals)
//     [data-filter-item]              één item per mineraal
//       [data-industry="<slug>"]      verborgen, één per gekoppelde industrie (geneste lijst)
//
// Knoppen zonder mineralen: disabled + class is-disabled (niet klikbaar).
// Actieve knop: class is-active + aria-pressed. Lijst krijgt is-filtered zolang er een
// industrie gekozen is (de trap in het raster geldt alleen bij "View all", zie de page-CSS).
// Keuze in de URL (?industry=<slug>) zodat een gefilterde lijst te delen is.

function init() {
  const bar = document.querySelector('[data-minerals-filters]');
  const list = document.querySelector('[data-filter-list]');
  if (!bar || !list) return;

  const buttons = [...bar.querySelectorAll('[data-filter]')];
  const items = [...list.querySelectorAll('[data-filter-item]')];
  const tags = new Map(items.map((item) => [
    item,
    new Set([...item.querySelectorAll('[data-industry]')].map((el) => el.getAttribute('data-industry'))),
  ]));

  // Industrieën zonder mineralen uitschakelen.
  buttons.forEach((btn) => {
    const slug = btn.getAttribute('data-filter');
    if (slug === 'all') return;
    const empty = !items.some((item) => tags.get(item).has(slug));
    btn.disabled = empty;
    btn.classList.toggle('is-disabled', empty);
    if (empty) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
  });

  const apply = (slug, push) => {
    const all = !slug || slug === 'all';
    buttons.forEach((btn) => {
      const on = btn.getAttribute('data-filter') === (all ? 'all' : slug);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    items.forEach((item) => {
      // style i.p.v. hidden: de class zet display: flex en wint van [hidden].
      item.style.display = !all && !tags.get(item).has(slug) ? 'none' : '';
    });
    list.classList.toggle('is-filtered', !all);
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

  const start = new URLSearchParams(window.location.search).get('industry');
  if (start && buttons.some((btn) => btn.getAttribute('data-filter') === start && !btn.disabled)) apply(start, false);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
