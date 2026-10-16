// Count-up: een getal telt op van 0 naar de waarde die in Webflow staat ("30%", "1.200+", "€ 4,5 mln").
// Gebruikt de GSAP (+ CustomEase) die Webflow zelf laadt; laadt zelf niets.
//
// Webflow-markup:
//   [data-count-up]          het blok met het getal; het eerste stuk tekst met cijfers telt op
//   data-count-up="0.65"     wachttijd in seconden vóór het tellen begint (leeg = 0)
//   data-count-up-marks="stat_mark"   (optioneel) elk teken dat geen cijfer is (scheidingstekens,
//                            voor- en achtervoegsel) komt in een <span> met deze class, ook tijdens
//                            het tellen en bij reduced motion. Zo kan Webflow ze apart opmaken.
//
// Begint als het blok in beeld komt én zichtbaar is (een Webflow-interaction die het blok laat
// infaden bepaalt zo het startmoment), één keer. Na 4 s telt het hoe dan ook.
// Voor- en achtervoegsel blijven staan; het aantal decimalen en de scheidingstekens van de
// Webflow-tekst worden aangehouden. Met prefers-reduced-motion blijft de eindwaarde staan.
// Waarom geen Webflow Interactions: die kunnen geen tekst of getal animeren.

const DURATION = 1.6;

function parse(text) {
  const m = text.match(/^(\D*?)(\d[\d.,]*)(.*)$/s);
  if (!m) return null;
  const raw = m[2];
  // Laatste scheidingsteken met 1–2 cijfers erachter = decimaalteken, de rest is duizendtallen.
  const dec = raw.match(/[.,](\d{1,2})$/);
  const decimals = dec ? dec[1].length : 0;
  const decimalMark = dec ? raw[raw.length - decimals - 1] : '';
  const groupMark = (raw.slice(0, dec ? raw.length - decimals - 1 : raw.length).match(/[.,]/) || [''])[0];
  const digits = raw.replace(/[.,]/g, '');
  const value = Number(digits) / Math.pow(10, decimals);
  return { prefix: m[1], suffix: m[3], value, decimals, decimalMark, groupMark };
}

function format(n, p) {
  const fixed = n.toFixed(p.decimals);
  let [int, frac] = fixed.split('.');
  if (p.groupMark) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, p.groupMark);
  return p.prefix + int + (frac ? p.decimalMark + frac : '') + p.suffix;
}

const escapeHtml = (c) => c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Schrijft de tekst; met marks als HTML in de ouder van de tekstnode (een Webflow <p>/<div>).
function write(item, text) {
  if (!item.marks) { item.node.nodeValue = text; return; }
  item.host.innerHTML = text.replace(/\D/g, (c) => `<span class="${item.marks}">${escapeHtml(c)}</span>`);
}

function textNodeWithDigits(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) if (/\d/.test(node.nodeValue)) return node;
  return null;
}

function init() {
  const gsap = window.gsap;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const items = [];
  document.querySelectorAll('[data-count-up]').forEach((el) => {
    const node = textNodeWithDigits(el);
    if (!node) return;
    const p = parse(node.nodeValue.trim());
    if (!p) return;
    const marks = (el.getAttribute('data-count-up-marks') || '').trim();
    const item = { el, node, host: node.parentElement, marks, p, delay: parseFloat(el.getAttribute('data-count-up')) || 0 };
    // Zonder GSAP of met reduced motion: alleen de eindwaarde (met marks) neerzetten.
    write(item, format(gsap && !reduce ? 0 : p.value, p));
    items.push(item);
  });
  if (!items.length || !gsap || reduce) return;

  let ease = 'power3.out';
  if (window.CustomEase) {
    gsap.registerPlugin(window.CustomEase);
    ease = window.CustomEase.create('pmsCount', '0.25,0,0.25,1');
  }

  const run = (item) => {
    // Breedte van de eindwaarde vasthouden, zodat een label ernaast niet meeschuift tijdens het tellen
    // (gemeten bij de start: dan staat het webfont er).
    write(item, format(item.p.value, item.p));
    item.host.style.minWidth = `${item.host.getBoundingClientRect().width}px`;
    write(item, format(0, item.p));
    const state = { n: 0 };
    gsap.to(state, {
      n: item.p.value,
      duration: DURATION,
      delay: item.delay,
      ease,
      onUpdate: () => { write(item, format(state.n, item.p)); },
      onComplete: () => { write(item, format(item.p.value, item.p)); item.host.style.minWidth = ''; },
    });
  };

  // Zichtbaar = niet visibility: hidden en (met voorouders) duidelijk niet doorzichtig.
  const visible = (el) => {
    if (getComputedStyle(el).visibility === 'hidden') return false;
    let o = 1;
    for (let e = el; e && e !== document.body; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o > 0.05;
  };
  const whenVisible = (item) => {
    const start = performance.now();
    const tick = () => {
      if (visible(item.el) || performance.now() - start > 4000) run(item);
      else requestAnimationFrame(tick);
    };
    tick();
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const item = items.find((i) => i.el === entry.target);
      if (item) whenVisible(item);
    });
  }, { threshold: 0.2 });
  items.forEach((i) => io.observe(i.el));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
