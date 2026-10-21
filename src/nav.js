// Nav (PMS): taalvenster open/dicht, ingeklapte stand na scrollen, balkkleur per onderdeel uit wat eronder
// ligt, en de ouderlink actief op detailpagina's. Geladen in Site settings › Custom code › Footer; de CSS die
// erbij hoort staat in de site-head (wf-pms: references/nav-custom-code.html, decisions/components/nav.md).
//
// Webflow-markup (staat al in de Nav):
//   [data-nav="component"]   de nav; krijgt data-nav-scrolled en data-region-open
//   [data-nav="bar"]         de balk
//   [data-nav="logo" | "links" | "menu-button"]   krijgen elk data-nav-tone="dark|light": de toon van wat
//                            eronder ligt (dark = lichte tekst, via de head-CSS). Contact niet: die knop heeft
//                            een eigen vlak en verandert niet mee.
//   [data-nav="region"], [data-nav="region-pop"], [data-nav="region-close"]   taalvenster
//
// Vangnet op een sectie (gaat altijd voor op de meting):
//   data-section="dark|light"          de sectie is donker/licht (dus lichte/donkere balktekst)
//   data-nav-color="Light|Dark"        de balktekst is licht/donker (prop Nav Color op Story Slide en
//                                      Page Hero; hoofdletters en spaties maken niet uit; "Automatic",
//                                      leeg of iets anders = meten)
//
// Meting: per onderdeel kolommen van ~2,5 rem met elk 3 vakjes. Per vakje de lagen onder de balk van boven naar
// beneden: foto's (een kleine verkleinde kopie per foto op een canvas, met object-fit en object-position),
// achtergrondkleuren, linear-gradients en gevulde SVG-vlakken, elk met hun dekking, ook lagen met
// pointer-events: none (verlopen, kaartbeelden); gemengd tot het eerste dekkende vlak.
// Video en een nog niet geladen foto tellen als donker (zoals vóór de meting). Uitzondering bij het laden: zolang
// de foto onder een onderdeel nog niet klaar is, krijgt het nog geen toon (hooguit 2 s), zodat de balk boven een
// lichte hero niet even licht wordt. Hysterese en een korte wachttijd (150 ms) tegen flikkeren.
// Bij scroll (en nog 3 keer tot 1,6 s erna, voor foto's die na het stoppen wisselen), resize, load en als een
// kopie klaar is, hooguit één keer per animatieframe.

(function () {
  // Tekstkleuren van de balk: light-150 (licht) en dark-800 (donker). Gelijk contrast bij L ≈ 0,21;
  // wisselen pas buiten 0,18–0,24, zodat beide randen nog ≥ 3,2:1 halen.
  const TO_DARK = 0.18; // onder deze luminantie: donkere ondergrond → lichte tekst
  const TO_LIGHT = 0.24; // boven deze luminantie: lichte ondergrond → donkere tekst
  const MID = 0.21;
  const HOLD = 150; // ms dat een nieuwe toon moet blijven staan voordat het onderdeel wisselt
  const SHADE = { dark: [16, 38, 65], light: [240, 242, 244] }; // waarde van een vast "donker"/"licht" punt
  const SAMPLE_WIDTH = 160;
  const OVERRIDE = '[data-section="dark"],[data-section="light"],[data-nav-color]';
  const FIRST_WAIT = 2000; // ms dat de eerste meting op een foto mag wachten
  const SETTLE = [300, 800, 1600]; // ms na de laatste scroll: nog eens meten
  const SHAPES = /^(rect|path|circle|ellipse|polygon)$/i;

  function init() {
    const nav = document.querySelector('[data-nav="component"]');
    if (!nav) return;
    regionDropdown(nav);
    activeParent(nav);
    barColour(nav);
  }

  // Taalvenster. Webflow's navbar sluit het menu bij elke klik buiten het paneel, en Popovers staan niet aan
  // op deze site, dus de knop stopt die klik en zet data-region-open zelf.
  function regionDropdown(nav) {
    const toggle = nav.querySelector('[data-nav="region"]');
    const menuButton = nav.querySelector('[data-nav="menu-button"]');
    const pop = nav.querySelector('[data-nav="region-pop"]');
    function setOpen(open) {
      nav.toggleAttribute('data-region-open', open);
      if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (toggle) toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!nav.hasAttribute('data-region-open'));
    });
    // Het kruisje is een link in het navbar-menu; Webflow sluit dan het hele menu, dus de klik stoppen op de
    // weg naar beneden (capture) en alleen het venster sluiten.
    if (pop) pop.addEventListener('click', (e) => {
      if (!e.target.closest('[data-nav="region-close"]')) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      if (toggle) toggle.focus();
    }, true);
    document.addEventListener('click', (e) => {
      if (nav.hasAttribute('data-region-open') && !e.target.closest('[data-nav="region-pop"]')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.hasAttribute('data-region-open')) setOpen(false);
    });
    if (menuButton) new MutationObserver(() => {
      if (!menuButton.classList.contains('w--open')) setOpen(false);
    }).observe(menuButton, { attributes: true, attributeFilter: ['class'] });
  }

  // Webflow markeert alleen de link naar de pagina zelf (w--current, aria-current="page"). Op een detailpagina
  // (/minerals/zircon) wordt de ouderlink (/minerals) actief: data-nav-current (de head-CSS kijkt naar beide) en
  // aria-current="true". Niet w--current zelf: webflow.js haalt die bij het starten weer weg.
  function activeParent(nav) {
    const path = location.pathname.replace(/\/+$/, '');
    nav.querySelectorAll('a[href^="/"]').forEach((a) => {
      const p = a.getAttribute('href').replace(/[?#].*$/, '').replace(/\/+$/, '');
      if (!p || path.indexOf(p + '/') !== 0) return;
      a.setAttribute('data-nav-current', '');
      a.setAttribute('aria-current', 'true');
    });
  }

  function barColour(nav) {
    const bar = nav.querySelector('[data-nav="bar"]');
    if (!bar) return;
    const parts = ['logo', 'links', 'menu-button']
      .map((k) => nav.querySelector(`[data-nav="${k}"]`)).filter(Boolean);
    const tones = new Map();
    const pending = new Map();
    const samplers = new Map();
    const colourCache = new Map();
    let opacityCache = new Map();
    let rectCache = new Map();
    let forcedCache = new Map();
    let ghosts = [];
    let waiting = false; // de laatste tone() stuitte op een foto die nog niet klaar is
    const born = performance.now();
    let candidates = null;
    // Alles met pointer-events: none dat iets tekent (foto, video, SVG-beeld, achtergrond). Eén keer bij laden en
    // na resize, niet per frame (getComputedStyle over de hele pagina).
    function scan() {
      candidates = [];
      document.querySelectorAll('body *').forEach((el) => {
        if (nav.contains(el) || el.tagName === 'CANVAS') return;
        const cs = getComputedStyle(el);
        if (cs.pointerEvents !== 'none' || cs.display === 'none') return;
        const tag = el.tagName.toLowerCase();
        if (tag === 'img' || tag === 'video' || (tag === 'image' && el instanceof SVGElement) ||
          (!(el instanceof SVGElement) && (cs.backgroundImage !== 'none' || colour(cs.backgroundColor)))) candidates.push(el);
      });
    }
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    probe.canvas.width = probe.canvas.height = 1;

    // Elke CSS-kleur (ook lab()/oklab(), die Webflow schrijft) naar [r, g, b, a] via een 1 × 1-canvas.
    // Geen kleur (fill: none, url(#verloop)) geeft null.
    function colour(str) {
      if (!str || str === 'transparent' || str === 'none') return null;
      let c = colourCache.get(str);
      if (c === undefined) {
        const m = str.match(/^rgba?\(([^)]+)\)$/);
        if (!m && !CSS.supports('color', str)) c = null;
        else if (m) {
          const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
          c = [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
        } else {
          probe.clearRect(0, 0, 1, 1);
          probe.fillStyle = '#000';
          probe.fillStyle = str;
          probe.fillRect(0, 0, 1, 1);
          const d = probe.getImageData(0, 0, 1, 1).data;
          c = [d[0], d[1], d[2], d[3] / 255];
        }
        colourCache.set(str, c);
      }
      return c && c[3] > 0 ? c : null;
    }

    function rect(el) {
      let r = rectCache.get(el);
      if (!r) { r = el.getBoundingClientRect(); rectCache.set(el, r); }
      return r;
    }

    // Vangnet boven el: true = donker (lichte tekst), false = licht, null = meten.
    function forced(el) {
      let f = forcedCache.get(el);
      if (f !== undefined) return f;
      f = null;
      for (let m = el.closest(OVERRIDE); m && f === null; m = m.parentElement && m.parentElement.closest(OVERRIDE)) {
        const sec = m.getAttribute('data-section');
        const col = (m.getAttribute('data-nav-color') || '').trim().toLowerCase();
        if (sec === 'dark' || sec === 'light') f = sec === 'dark';
        else if (col === 'light' || col === 'dark') f = col === 'light';
      }
      forcedCache.set(el, f);
      return f;
    }

    function luminance(c) {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    }

    // Dekking van een element inclusief zijn ouders (een foto in een dia met opacity 0,7 laat de laag eronder door).
    function opacity(el) {
      if (!el || el.nodeType !== 1) return 1;
      let o = opacityCache.get(el);
      if (o === undefined) {
        o = parseFloat(getComputedStyle(el).opacity) * opacity(el.parentElement);
        opacityCache.set(el, o);
      }
      return o;
    }

    // Kleinste maat uit de srcset (Webflow: -p-500), anders de geladen bron.
    function smallest(img) {
      let best = null;
      (img.getAttribute('srcset') || '').split(',').forEach((s) => {
        const [url, w] = s.trim().split(/\s+/);
        const n = parseInt(w, 10);
        if (url && n && (!best || n < best.n)) best = { url, n };
      });
      return best ? best.url : img.currentSrc || img.src;
    }

    // Eén verkleinde kopie per foto. Apart Image-object met crossOrigin, zodat het canvas leesbaar blijft
    // (Webflow-CDN stuurt access-control-allow-origin: *). Mislukt dat, dan blijft de foto "donker".
    function sampler(url) {
      let s = samplers.get(url);
      if (s) return s;
      s = { ready: false };
      samplers.set(url, s);
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.decoding = 'async';
      im.onload = () => {
        try {
          const w = Math.min(SAMPLE_WIDTH, im.naturalWidth);
          const h = Math.max(1, Math.round(im.naturalHeight * w / im.naturalWidth));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const cx = cv.getContext('2d', { willReadFrequently: true });
          cx.drawImage(im, 0, 0, w, h);
          s.data = cx.getImageData(0, 0, w, h).data;
          s.w = w; s.h = h; s.ready = true;
        } catch (e) { s.failed = true; }
        request();
      };
      im.onerror = () => { s.failed = true; request(); };
      im.src = url;
      return s;
    }

    // "50% 30%", "left top", "12px 0" → [x, y] als fractie of pixels.
    function position(str) {
      const words = { left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' };
      const p = (str || '50% 50%').split(/\s+/).map((v) => words[v] || v);
      if (p.length === 1) p.push('50%');
      if (/^(top|bottom)$/.test((str || '').split(/\s+/)[0])) p.reverse();
      return p.map((v) => (v.endsWith('%') ? { f: parseFloat(v) / 100 } : { px: parseFloat(v) || 0 }));
    }

    // Gemiddelde kleur van een deel van een foto. box = getekend vlak (viewport), fit = object-fit /
    // background-size, cell = te meten vlak (viewport). null als het vlak buiten de foto valt.
    function photo(s, box, fit, pos, cell) {
      const bw = box.width, bh = box.height;
      let sx = bw / s.w, sy = bh / s.h;
      if (fit === 'cover') sx = sy = Math.max(sx, sy);
      else if (fit === 'contain') sx = sy = Math.min(sx, sy);
      else if (fit === 'none') sx = sy = 1;
      else if (fit === 'scale-down') sx = sy = Math.min(1, sx, sy);
      const rw = s.w * sx, rh = s.h * sy;
      const [px, py] = position(pos);
      const ox = box.left + (px.f !== undefined ? (bw - rw) * px.f : px.px);
      const oy = box.top + (py.f !== undefined ? (bh - rh) * py.f : py.px);
      const x0 = Math.max(0, Math.floor((cell.left - ox) / sx)), x1 = Math.min(s.w, Math.ceil((cell.right - ox) / sx));
      const y0 = Math.max(0, Math.floor((cell.top - oy) / sy)), y1 = Math.min(s.h, Math.ceil((cell.bottom - oy) / sy));
      if (x1 <= x0 || y1 <= y0) return null;
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * s.w + x) * 4, a = s.data[i + 3] / 255;
        r += s.data[i] * a; g += s.data[i + 1] * a; b += s.data[i + 2] * a; n += a;
      }
      return n ? [r / n, g / n, b / n, n / ((x1 - x0) * (y1 - y0))] : null;
    }

    // Kleur van een linear-gradient op punt (x, y) van een vlak (CSS-hoek: 0deg = naar boven, met de klok mee).
    function gradient(str, box, x, y) {
      const parts = []; let depth = 0, cur = '';
      for (const ch of str) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
      }
      parts.push(cur.trim());
      let angle = 180;
      const first = parts[0];
      const sides = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270, 'to top right': 45, 'to right top': 45,
        'to bottom right': 135, 'to right bottom': 135, 'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315 };
      if (/^-?[\d.]+(deg|turn|rad|grad)$/.test(first)) {
        const v = parseFloat(first);
        angle = first.endsWith('turn') ? v * 360 : first.endsWith('grad') ? v * 0.9 : first.endsWith('rad') ? v * 180 / Math.PI : v;
        parts.shift();
      } else if (first in sides) { angle = sides[first]; parts.shift(); }
      const stops = parts.map((p) => {
        const m = p.match(/^(.*?\))\s*(-?[\d.]+%)?$/) || p.match(/^(\S+)\s*(-?[\d.]+%)?$/);
        return m ? { c: colour(m[1]) || [0, 0, 0, 0], t: m[2] ? parseFloat(m[2]) / 100 : null } : null;
      }).filter(Boolean);
      if (!stops.length) return null;
      if (stops[0].t === null) stops[0].t = 0;
      if (stops[stops.length - 1].t === null) stops[stops.length - 1].t = 1;
      for (let i = 1; i < stops.length - 1; i++) if (stops[i].t === null) {
        let j = i; while (stops[j].t === null) j++;
        for (let k = i; k < j; k++) stops[k].t = stops[i - 1].t + (stops[j].t - stops[i - 1].t) * (k - i + 1) / (j - i + 1);
      }
      const a = angle * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
      const len = Math.abs(box.width * dx) + Math.abs(box.height * dy) || 1;
      const t = ((x - box.left - box.width / 2) * dx + (y - box.top - box.height / 2) * dy) / len + 0.5;
      if (t <= stops[0].t) return stops[0].c;
      for (let i = 1; i < stops.length; i++) if (t <= stops[i].t) {
        const s0 = stops[i - 1], s1 = stops[i], f = (t - s0.t) / ((s1.t - s0.t) || 1);
        return s0.c.map((v, k) => v + (s1.c[k] - v) * f);
      }
      return stops[stops.length - 1].c;
    }

    // Kleur die je op punt (x, y) ziet, met stack = elementsFromPoint van zijn kolom, hidden = de lagen met
    // pointer-events: none op datzelfde punt (de middenlijn) en cell = het vlak waarvoor dit punt staat.
    // Lagen tellen alleen waar ze het punt ook echt bedekken (een rij boven de bovenrand van een kaart ziet die
    // kaart niet). Geeft [r, g, b]; een vangnet of iets wat niet te meten is geeft de vaste kleur SHADE.dark/light.
    function seen(stack, hidden, x, y, cell) {
      const layers = [];
      let base = null;
      const add = (c, a) => { if (a >= 0.99) base = c.slice(0, 3); else if (a > 0.01) layers.push([c[0], c[1], c[2], a]); };
      // Eén element als laag; zet base als het dekkend is (dan stopt het meten).
      // Foto nog niet klaar: telt als donker, en bij de eerste meting wacht het onderdeel erop.
      const notYet = () => { base = SHADE.dark; waiting = true; };
      function layer(el) {
        const o = opacity(el);
        if (o <= 0.01) return;
        const box = rect(el);
        const tag = el.tagName;
        if (tag === 'IMG') {
          if (cell.bottom < box.top || cell.top > box.bottom) return;
          if (!el.complete || !el.naturalWidth) { notYet(); return; }
          const s = sampler(smallest(el));
          if (s.failed) { base = SHADE.dark; return; }
          if (!s.ready) { notYet(); return; }
          const cs = getComputedStyle(el);
          const c = photo(s, box, cs.objectFit, cs.objectPosition, cell);
          if (c) add(c, c[3] * o);
          return;
        }
        if (tag.toLowerCase() === 'image' && el instanceof SVGElement) {
          if (cell.bottom < box.top || cell.top > box.bottom) return;
          const s = sampler(el.href.baseVal);
          if (s.failed) { base = SHADE.dark; return; }
          if (!s.ready) { notYet(); return; }
          const par = el.getAttribute('preserveAspectRatio') || '';
          const c = photo(s, box, /slice/.test(par) ? 'cover' : par === 'none' ? 'fill' : 'contain', '50% 50%', cell);
          if (c) add(c, c[3] * o);
          return;
        }
        if (box.top > y || box.bottom < y || box.left > x || box.right < x) return;
        if (tag === 'VIDEO' || tag === 'CANVAS') { base = SHADE.dark; return; }
        if (el instanceof SVGElement && tag.toLowerCase() !== 'svg') {
          if (!SHAPES.test(tag)) return;
          const cs = getComputedStyle(el), c = colour(cs.fill);
          if (c) add(c, c[3] * parseFloat(cs.fillOpacity) * o);
          return;
        }
        const cs = getComputedStyle(el);
        const bg = cs.backgroundImage;
        if (bg && bg !== 'none') {
          // Lagen staan van boven naar beneden in de lijst.
          const list = bg.split(/,(?![^(]*\))(?=\s*(?:linear-gradient|radial-gradient|conic-gradient|repeating-|url|image-set))/);
          for (let i = 0; i < list.length && !base; i++) {
            const l = list[i].trim();
            if (l.startsWith('linear-gradient(')) {
              const c = gradient(l.slice(16, -1), box, x, y);
              if (c) add(c, c[3] * o);
            } else if (l.startsWith('url(')) {
              const s = sampler(l.slice(4, -1).replace(/^["']|["']$/g, ''));
              if (s.failed) { base = SHADE.dark; return; }
              if (!s.ready) { notYet(); return; }
              const c = photo(s, box, cs.backgroundSize === 'contain' ? 'contain' : 'cover', cs.backgroundPosition, cell);
              if (c) add(c, c[3] * o);
            }
          }
          if (base) return;
        }
        const c = colour(cs.backgroundColor);
        if (c) add(c, c[3] * o);
      }
      // Lagen met pointer-events: none (verlopen over een foto, kaartbeeld, steen) vindt elementsFromPoint niet.
      // Ze liggen boven een geraakt element als ze erin zitten of verderop in de pagina staan (zelfde volgorde als
      // de browser tekent, z-index buiten beschouwing), dus daar worden ze ingevoegd, de bovenste eerst.
      hidden = hidden.slice();
      for (let i = 0; i < stack.length && !base; i++) {
        const el = stack[i];
        if (nav.contains(el)) continue;
        const f = forced(el);
        if (f !== null) {
          base = SHADE[f ? 'dark' : 'light'];
          break;
        }
        for (let j = hidden.length - 1; j >= 0 && !base; j--) {
          if (el.compareDocumentPosition(hidden[j].el) & Node.DOCUMENT_POSITION_FOLLOWING) layer(hidden.splice(j, 1)[0].el);
        }
        if (!base) layer(el);
      }
      for (let j = hidden.length - 1; j >= 0 && !base; j--) layer(hidden[j].el);
      let out = base || [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i];
        out = out.map((v, k) => v + (l[k] - v) * l[3]);
      }
      return out;
    }

    // Toon van wat onder één onderdeel ligt: kolommen van ~2,5 rem (3–8) over zijn breedte, elk met één
    // elementsFromPoint op de middenlijn van de balk (dat is het dure deel), en per kolom 3 vakjes boven elkaar.
    // null = nog geen toon (eerste meting, foto nog niet klaar).
    function tone(el, band) {
      const r = el.getBoundingClientRect();
      if (!r.width) return tones.get(el) || 'light';
      const top = Math.max(r.top, band.top), bottom = Math.min(r.bottom, band.bottom);
      const h = bottom > top ? bottom - top : band.bottom - band.top, y0 = bottom > top ? top : band.top;
      const cols = Math.min(8, Math.max(3, Math.round(r.width / 40))), rows = 3;
      const sum = [0, 0, 0];
      waiting = false;
      for (let col = 0; col < cols; col++) {
        const left = r.left + r.width * col / cols, right = r.left + r.width * (col + 1) / cols, x = (left + right) / 2;
        const sy = y0 + h / 2;
        const stack = document.elementsFromPoint(x, sy);
        const hidden = ghosts.filter((g) => g.r.left <= x && g.r.right >= x && g.r.top <= sy && g.r.bottom >= sy);
        for (let row = 0; row < rows; row++) {
          const cell = { left, right, top: y0 + h * row / rows, bottom: y0 + h * (row + 1) / rows };
          const c = seen(stack, hidden, x, (cell.top + cell.bottom) / 2, cell);
          sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
        }
      }
      const L = luminance(sum.map((v) => v / (rows * cols)));
      if (window.PMS_NAV_DEBUG) el.setAttribute('data-nav-luminance', L.toFixed(3));
      const was = tones.get(el);
      if (!was && waiting && performance.now() - born < FIRST_WAIT) return null;
      if (!was) return L < MID ? 'dark' : 'light';
      if (was === 'light' && L < TO_DARK) return 'dark';
      if (was === 'dark' && L > TO_LIGHT) return 'light';
      return was;
    }

    let ticking = false;
    function update() {
      ticking = false;
      const t0 = window.PMS_NAV_DEBUG && performance.now();
      opacityCache = new Map();
      rectCache = new Map();
      forcedCache = new Map();
      // Voorbij de balkhoogte gescrold: de head-CSS klapt de links in (en bovenaan weer uit).
      const scrolled = window.scrollY > bar.offsetHeight;
      if (nav.hasAttribute('data-nav-scrolled') !== scrolled) nav.toggleAttribute('data-nav-scrolled', scrolled);
      const b = bar.getBoundingClientRect();
      const band = { top: b.top + b.height / 2 - 16, bottom: b.top + b.height / 2 + 16 };
      if (!candidates) scan();
      ghosts = [];
      candidates.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < band.top || r.top > band.bottom || !r.width || !el.isConnected) return;
        if (getComputedStyle(el).visibility !== 'hidden') ghosts.push({ el, r });
        rectCache.set(el, r);
      });
      const now = performance.now();
      let later = false;
      parts.forEach((el) => {
        const raw = tone(el, band), was = tones.get(el);
        if (raw === null) { later = true; return; }
        let t = raw;
        // Een nieuwe toon moet even blijven staan (HOLD ms), zodat een smalle rand of lijn die onder het onderdeel
        // door schuift geen knipper geeft. De eerste meting geldt meteen.
        if (was && t !== was) {
          const p = pending.get(el);
          if (!p || p.t !== t) { pending.set(el, { t, since: now }); setTimeout(request, HOLD + 20); t = was; }
          else if (now - p.since < HOLD) t = was;
        }
        if (raw === was || t === raw) pending.delete(el);
        tones.set(el, t);
        if (el.getAttribute('data-nav-tone') !== t) el.setAttribute('data-nav-tone', t);
      });
      // Vangnet als een kopie nooit klaar meldt: na FIRST_WAIT krijgt elk onderdeel toch een toon.
      if (later) setTimeout(request, 250);
      if (t0) (window.PMS_NAV_TIMES = window.PMS_NAV_TIMES || []).push(performance.now() - t0);
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    // Na het stoppen kan er nog iets wisselen onder de balk (Services-foto's wisselen 250 ms na stilstand en
    // vloeien 1,2 s over), dus nog een paar keer meten.
    let settle = [];
    window.addEventListener('scroll', () => {
      request();
      settle.forEach(clearTimeout);
      settle = SETTLE.map((d) => setTimeout(request, d));
    }, { passive: true });
    window.addEventListener('resize', () => { candidates = null; request(); });
    window.addEventListener('load', () => { candidates = null; request(); setTimeout(() => { candidates = null; request(); }, 2000); });
    // Een foto die onder de balk ligt en net geladen is (lazy): opnieuw meten.
    document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') request(); }, true);
    // Kopieën alvast maken voor foto's die binnen een schermhoogte komen, zodat ze klaar zijn als ze onder de balk
    // schuiven (anders geldt even "donker").
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const img = e.target;
        const go = () => { sampler(smallest(img)); io.unobserve(img); };
        if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
      }), { rootMargin: '100% 0px' });
      document.querySelectorAll('img').forEach((img) => { if (!nav.contains(img)) io.observe(img); });
    }
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
