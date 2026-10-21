// Readout: formules, kwaliteiten en coördinaten "lezen uit" als een meetapparaat. Op het moment dat zo'n
// tekst verschijnt (de inlaadanimatie van Webflow laat hem infaden, een slide wordt actief, een kaart bouwt
// op) rollen de letters en cijfers kort door willekeurige tekens en vallen ze van links naar rechts op hun
// plek. Gebruikt de GSAP die Webflow laadt; laadt zelf niets.
//
// Webflow-markup:
//   [data-readout]            het element met de tekst (ook een wrapper: alle tekst erin doet mee), of een
//                             SVG-<text>. data-readout="off" zet het uit.
//
// - Speelt alleen bij de overgang onzichtbaar → zichtbaar terwijl het element in beeld is. Zo valt het samen
//   met de bestaande inlaadanimatie, speelt het opnieuw als een slide weer actief wordt, en niet als een
//   tekst al zichtbaar was (bv. kaarten die buiten beeld al ingeladen zijn, terug via de paginaovergang).
//   Verscheen de tekst net buiten beeld en komt hij binnen 2 s in beeld, dan speelt het alsnog.
// - Alleen A–Z, a–z en 0–9 rollen (hoofdletter blijft hoofdletter, cijfer blijft cijfer); al het andere
//   (₂, °, ′, spaties, leestekens) blijft op zijn plek staan.
// - Niets verspringt: elk teken krijgt tijdens het rollen de breedte van zijn echte teken (SVG: textLength).
//   Daarna staat de oorspronkelijke tekst er weer precies zoals Webflow hem schreef.
// - Wat in een paginaovergang meevliegt (formule kaart → productpagina) leest niet uit.
// - Schermlezers horen alleen de echte tekst (visueel verborgen kopie, de rollende tekens zijn aria-hidden).
// - Zonder GSAP of met prefers-reduced-motion gebeurt er niets: de echte tekst staat er meteen.
// Waarom een script: Webflow Interactions kunnen geen tekst veranderen. De ScrambleText-plugin wordt niet
// gebruikt: die laat bijzondere tekens niet staan en houdt de breedte per teken niet vast.

(() => {
  const LEAD = 0.3;    // deel van de tijd waarin alles rolt voordat het eerste teken vastvalt
  const STEP = 0.055;  // s tussen twee willekeurige tekens per plek
  const LATE = 2;      // s: naloop voor tekst die net buiten beeld verscheen
  const POOLS = [
    [/[A-Z]/, 'ABCDEFGHKNOPRSTUVXZ'],
    [/[a-z]/, 'abcdeghknopqrsuvxyz'],
    [/[0-9]/, '0123456789'],
  ];
  const SR_ONLY = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0';

  const poolOf = (c) => { for (const [re, pool] of POOLS) if (re.test(c)) return pool; return null; };
  const pick = (pool, not) => { let c; do c = pool[(Math.random() * pool.length) | 0]; while (c === not); return c; };
  // Kort en strak: 1 teken ± 0,5 s, een lange kwaliteit of coördinaat 0,75 s.
  const durationFor = (n) => Math.min(0.75, Math.max(0.45, 0.45 + 0.025 * n));

  const shown = (el) => {
    if (!el.isConnected) return false;
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    if (getComputedStyle(el).visibility === 'hidden') return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (c.display === 'none' || parseFloat(c.opacity) === 0) return false;
    }
    return true;
  };

  // Vliegt mee in een paginaovergang (View Transitions, page-transition.js): niet uitlezen, de tekst staat al vast.
  const inTransition = (el) => {
    if (!('viewTransitionName' in document.documentElement.style)) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) if (getComputedStyle(e).viewTransitionName !== 'none') return true;
    return false;
  };

  // ---------- HTML: elke rollende plek een inline-block met de breedte van het echte teken ----------
  function prepareHtml(el) {
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) if (n.nodeValue.trim()) nodes.push(n);
    const box = el.getBoundingClientRect();
    const scale = el.offsetWidth ? box.width / el.offsetWidth || 1 : 1; // IX3/slide-transforms
    const range = document.createRange();
    const slots = [];
    const swaps = nodes.map((node) => {
      const text = node.nodeValue;
      // Breedtes eerst meten (de tekst staat er nog), dan pas vervangen.
      // Breedte = afstand tot het volgende teken op dezelfde regel (met kerning), anders het teken zelf.
      let at = 0;
      const rects = [...text].map((c) => {
        range.setStart(node, at); range.setEnd(node, (at += c.length));
        return range.getBoundingClientRect();
      });
      const widths = rects.map((r, i) => {
        const next = rects[i + 1];
        const w = next && Math.abs(next.top - r.top) < 1 ? next.left - r.left : r.width;
        return w / scale;
      });
      const wrap = document.createElement('span');
      wrap.setAttribute('aria-hidden', 'true');
      // Per woord een nowrap-groep: regels breken op dezelfde plekken als de echte tekst.
      let i = 0;
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { wrap.append(part); i += [...part].length; return; }
        const word = document.createElement('span');
        word.style.whiteSpace = 'nowrap';
        // Ook vaste tekens een eigen vak met hun gemeten breedte, zodat de som exact de echte breedte is.
        for (const c of part) {
          const s = document.createElement('span');
          s.style.cssText = `display:inline-block;width:${widths[i]}px;text-align:center`;
          s.textContent = c;
          word.append(s);
          const pool = poolOf(c);
          if (pool) slots.push({ real: c, pool, set: (v) => { s.textContent = v; } });
          i++;
        }
        wrap.append(word);
      });
      return { node, wrap };
    });
    if (!slots.length) return null;
    const sr = document.createElement('span');
    sr.setAttribute('style', SR_ONLY);
    sr.textContent = el.textContent;
    swaps.forEach(({ node, wrap }) => node.replaceWith(wrap));
    el.append(sr);
    return {
      slots,
      alive: () => swaps.every(({ wrap }) => wrap.isConnected),
      restore: () => {
        swaps.forEach(({ node, wrap }) => { if (wrap.isConnected) wrap.replaceWith(node); });
        sr.remove();
      },
    };
  }

  // ---------- SVG-<text>: tekst vervangen, lengte vast met textLength ----------
  function prepareSvg(el) {
    const real = el.textContent;
    const chars = [...real];
    const slots = [];
    const out = chars.slice();
    chars.forEach((c, i) => {
      const pool = poolOf(c);
      if (pool) slots.push({ real: c, pool, set: (v) => { out[i] = v; } });
    });
    if (!slots.length) return null;
    const had = { len: el.getAttribute('textLength'), adj: el.getAttribute('lengthAdjust') };
    if (had.len === null) {
      el.setAttribute('textLength', el.getComputedTextLength());
      el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
    let written = real;
    const unlock = () => {
      if (had.len !== null) return;
      el.removeAttribute('textLength');
      el.removeAttribute('lengthAdjust');
    };
    return {
      slots,
      // Een ander script (story-map: coördinaten lopen met het vizier mee) schreef ertussen: dan stoppen.
      alive: () => el.textContent === written,
      flush: () => { written = out.join(''); el.textContent = written; },
      restore: () => { if (el.textContent === written) el.textContent = real; unlock(); },
    };
  }

  function init() {
    const gsap = window.gsap;
    if (!gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const items = new Map(); // el → { armed, inView, run }

    const play = (el, item) => {
      if (inTransition(el)) return;
      const prep = el instanceof SVGElement ? prepareSvg(el) : prepareHtml(el);
      if (!prep) return;
      const n = prep.slots.length;
      prep.slots.forEach((s, k) => {
        s.lock = LEAD + (1 - LEAD) * ((k + 1) / n); // van links naar rechts; de laatste precies aan het eind
        s.phase = Math.random() * STEP;
        s.tick = -1;
      });
      const T = durationFor(n);
      const state = { p: 0 };
      const step = () => {
        if (!prep.alive()) { stop(false); return; }
        const t = state.p * T;
        prep.slots.forEach((s) => {
          if (state.p >= s.lock) { if (s.tick !== -2) { s.set(s.real); s.tick = -2; } return; }
          const tick = Math.floor((t + s.phase) / STEP);
          if (tick !== s.tick) { s.tick = tick; s.set(pick(s.pool, s.real)); }
        });
        if (prep.flush) prep.flush();
      };
      const stop = (done) => {
        tween.kill();
        prep.restore();
        item.run = null;
        if (!done) item.armed = false;
      };
      const tween = gsap.to(state, { p: 1, duration: T, ease: 'none', onUpdate: step, onComplete: () => stop(true) });
      step();
      item.run = { stop };
    };

    // Nalopen: elementen in beeld elke 2 frames, wachtende (onzichtbare) elementen buiten beeld elke 6 frames.
    // Onzichtbaar = klaar om te spelen; zichtbaar worden in beeld = spelen. Wordt een wachtend element buiten
    // beeld zichtbaar (zijn inlaadanimatie speelde net onder de rand, bv. de onderste rij labels van een kaart
    // of de hoektekst onderin een dia), dan speelt het alsnog als het binnen LATE s in beeld komt; daarna niet
    // meer, zodat het geen losse animatie wordt bij tekst die er al lang staat.
    let raf = 0, frame = 0;
    const check = (all) => {
      const now = performance.now();
      items.forEach((item, el) => {
        if (!item.inView && !(all && (item.armed || item.late))) return;
        if (!shown(el)) {
          if (item.run) item.run.stop(false);
          item.armed = true;
          item.late = 0;
        } else if (item.armed && !item.run) {
          item.armed = false;
          if (item.inView) play(el, item); else item.late = now + LATE * 1000;
        } else if (item.late && (item.inView || now >= item.late)) {
          if (item.inView && now < item.late) play(el, item);
          item.late = 0;
        }
      });
    };
    const busy = () => { for (const item of items.values()) if (item.inView || item.armed || item.late) return true; return false; };
    const onFrame = () => {
      raf = 0;
      frame++;
      if (frame % 2 === 0) check(frame % 6 === 0);
      if (busy()) loop();
    };
    const loop = () => { if (!raf) raf = requestAnimationFrame(onFrame); };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const item = items.get(e.target); if (item) item.inView = e.isIntersecting; });
      check(false);
      loop();
    });

    // Opnieuw zoeken na het laden: Swiper (Lumos Slider) maakt kopieën van slides voor de loop.
    const scan = () => {
      document.querySelectorAll('[data-readout]').forEach((el) => {
        if (items.has(el) || /^(off|false|0)$/i.test(el.getAttribute('data-readout').trim())) return;
        items.set(el, { armed: !shown(el), inView: false, late: 0, run: null });
        io.observe(el);
      });
      loop();
    };
    scan();
    window.addEventListener('load', () => { scan(); setTimeout(scan, 1500); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
