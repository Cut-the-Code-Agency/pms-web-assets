// Kostencalculator (Home, component Cost Calculator): indicatieve prijs voor een mineraal,
// een hoeveelheid in ton en een verpakking. Laadt niets van buiten de site; werkt op attributen.
//
// Webflow-markup:
//   [data-calculator]                   de sectie
//     select[data-calculator-mineral]   keuzelijst; de eerste option (value "") staat er al, de mineralen vult dit script
//     input[data-calculator-quantity]   hoeveelheid in ton (minimaal 1)
//     select[data-calculator-packaging] option value="bulk" | "paper-bags" | "big-bags"
//     [data-calculator-prompt]          tekst zolang er geen mineraal gekozen is
//     [data-calculator-price]           hier komt de prijsrange
//     [data-calculator-on-request]      tekst als het mineraal geen prijs heeft
//     [data-calculator-actions]         knoppenrij, onzichtbaar (wel ruimte) tot er een mineraal gekozen is
//       [data-calculator-link="quote"]  knop naar de mineraalpagina met het offertepaneel (#quote)
//       [data-calculator-link="view"]   knop naar de mineraalpagina
//   [data-calculator-data]              verborgen gegevenslijst buiten de sectie (CMS Minerals)
//     [data-calculator-item="<slug>"]   data-name, data-min, data-max (euro per ton),
//                                       data-paper-bags, data-big-bags (toeslag per ton, leeg = 0)
//
// Staat de gegevenslijst niet op de pagina (bv. /components), dan haalt het script hem van de
// homepage in dezelfde taal (of van data-calculator-source op de sectie).
// Rekenregel (plan ticket 1244r2tgcat): hoeveelheid × (min + toeslag) tot hoeveelheid × (max + toeslag),
// hele euro's, getallen in de taal van de pagina. Geen min of max = "Price on request".

(function () {
  const lang = (document.documentElement.lang || 'en').toLowerCase();
  const prefix = /^\/nl(\/|$)/.test(location.pathname) ? '/nl' : '';

  const num = (v) => {
    if (v == null || String(v).trim() === '') return null;
    // Hele euro's; spaties en komma's zijn duizendtallen ("1,650"), een punt is het decimaalteken.
    const n = Number(String(v).replace(/[\s,]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const euro = (n) => '€ ' + new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(Math.round(n));

  function readData(doc) {
    return [...doc.querySelectorAll('[data-calculator-data] [data-calculator-item]')]
      .map((el) => ({
        slug: el.getAttribute('data-calculator-item'),
        name: (el.getAttribute('data-name') || '').trim(),
        min: num(el.getAttribute('data-min')),
        max: num(el.getAttribute('data-max')),
        'paper-bags': num(el.getAttribute('data-paper-bags')) || 0,
        'big-bags': num(el.getAttribute('data-big-bags')) || 0,
      }))
      .filter((item) => item.slug && item.name);
  }

  const show = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };
  // Knoppenrij houdt haar ruimte vast, zodat het blok niet verspringt bij de eerste keuze.
  const reveal = (el, on) => {
    if (!el) return;
    el.style.visibility = on ? '' : 'hidden';
    if (on) el.removeAttribute('inert'); else el.setAttribute('inert', '');
  };

  function setup(root, items) {
    const select = root.querySelector('select[data-calculator-mineral]');
    const quantity = root.querySelector('[data-calculator-quantity]');
    const packaging = root.querySelector('select[data-calculator-packaging]');
    const prompt = root.querySelector('[data-calculator-prompt]');
    const price = root.querySelector('[data-calculator-price]');
    const onRequest = root.querySelector('[data-calculator-on-request]');
    const actions = root.querySelector('[data-calculator-actions]');
    if (!select || !quantity || !price) return;

    const bySlug = new Map(items.map((item) => [item.slug, item]));
    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.slug;
      option.textContent = item.name;
      select.appendChild(option);
    });

    const tonnes = () => {
      const n = Math.floor(num(quantity.value) || 0);
      return n >= 1 ? n : 1;
    };

    function update() {
      const item = bySlug.get(select.value);
      show(prompt, !item);
      reveal(actions, !!item);
      if (!item) { show(price, false); show(onRequest, false); return; }

      const base = `${prefix}/minerals/${item.slug}`;
      root.querySelectorAll('[data-calculator-link="quote"] a').forEach((a) => { a.href = `${base}#quote`; });
      root.querySelectorAll('[data-calculator-link="view"] a').forEach((a) => { a.href = base; });

      const hasPrice = item.min != null && item.max != null;
      show(price, hasPrice);
      show(onRequest, !hasPrice);
      if (!hasPrice) return;

      const q = tonnes();
      const surcharge = item[packaging && packaging.value] || 0;
      const low = q * (Math.min(item.min, item.max) + surcharge);
      const high = q * (Math.max(item.min, item.max) + surcharge);
      price.textContent = low === high ? euro(low) : `${euro(low)} – ${euro(high)}`;
    }

    select.addEventListener('change', update);
    if (packaging) packaging.addEventListener('change', update);
    quantity.addEventListener('input', update);
    // Lege of te kleine hoeveelheid na het verlaten van het veld terugzetten naar wat er gerekend wordt.
    quantity.addEventListener('change', () => { quantity.value = tonnes(); update(); });
    update();
  }

  function init() {
    const roots = [...document.querySelectorAll('[data-calculator]')];
    if (!roots.length) return;
    const local = readData(document);
    if (local.length) { roots.forEach((root) => setup(root, local)); return; }

    const source = roots[0].getAttribute('data-calculator-source') || `${prefix}/`;
    fetch(source, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((html) => {
        const items = readData(new DOMParser().parseFromString(html, 'text/html'));
        roots.forEach((root) => setup(root, items));
      })
      .catch(() => roots.forEach((root) => setup(root, [])));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
