// Location Map (Mineral #, levertijd-leadmagnet): kaart met plaatszoeker.
// Wat IX3 niet kan, doet dit script:
//   1. De wereldkaart staat in een canvas (zelfde stock-kaart als Network Map) met een camera die kan schuiven en zoomen.
//   2. Zolang er geen plaats gekozen is, volgt de marker (vizier) de muis langzaam; zonder muis zweeft hij rustig rond.
//      Coördinaten rechtsonder lopen mee; de tijd linksonder is dan de zeetijd van die lengtegraad.
//   3. Zoeken naar steden, dorpen en buurtschappen via Geoapify Address Autocomplete (type=city).
//      Na een keuze schuift de kaart naar de plaats, landt de marker erop, verschijnt de echte lokale tijd,
//      worden de verborgen velden (Place, Country, Latitude, Longitude, Timezone) gevuld en gaat stap 2 open.
//   4. Zonder sleutel of als Geoapify faalt: de bezoeker typt de plaats zelf; stap 2 opent na Enter of het veld verlaten.
// Pauzeert buiten beeld. prefers-reduced-motion: marker staat stil, de kaart springt zonder beweging.
// Zonder JS: statische kaart (img), alle velden zichtbaar en gewoon te versturen.
//
// Webflow-markup (component Location Map): section[data-location-map][data-geoapify-key] › .location-map_frame
// › .location-map_visual (img .location-map_img, canvas .location-map_canvas, raster, p[data-location-map-time],
// p[data-location-map-coords]) en .location-map_panel met het formulier [data-location-form]:
// fieldset[data-location-step="1"] (veld in [data-location-combo], [data-location-dropdown] (zichtbaar met data-open) › ul[data-location-list]
// › li[data-location-option] als sjabloon, p[data-location-status]) en fieldset[data-location-step="2"].
// Instellingen op de section (optioneel): data-view (breedte van de uitsnede rond de plaats in graden, standaard 90),
// data-follow (hoe snel de marker de muis volgt, standaard 0.035).
// Gebruikt de GSAP die Webflow laadt als die er is; laadt niets zelf.

(() => {
  // Stock-kaart (equirectangular): linkerrand −174,9°, bovenrand 97,15° N, breedte 364,2° (kaart-leadmagnet.md).
  const MAP = { left: -174.9, top: 97.15, span: 364.2 };
  const LAT_TOP = 84;
  const LAT_BOTTOM = -62;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasMouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktop = matchMedia('(min-width: 992px)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const nearLng = (lng, ref) => lng + 360 * Math.round((ref - lng) / 360);
  const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

  function formatCoords(p) {
    const part = (v, pos, neg) => {
      const total = Math.round(Math.abs(v) * 60);
      return `${Math.floor(total / 60)}°${String(total % 60).padStart(2, '0')}' ${v >= 0 ? pos : neg}`;
    };
    return `${part(p.lat, 'N', 'S')}, ${part(wrapLng(p.lng), 'E', 'W')}`;
  }
  function tzOffset(tz) {
    if (!tz) return null;
    try {
      const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
        .formatToParts(new Date()).find((x) => x.type === 'timeZoneName').value;
      const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
      return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
    } catch (e) {
      return null;
    }
  }
  function formatTime(offset) {
    const d = new Date(Date.now() + offset * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    const o = Math.abs(offset);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
      `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` +
      `${offset < 0 ? '-' : '+'}${pad(Math.floor(o / 60))}:${pad(o % 60)}`;
  }
  // Grootste bron uit srcset (de kaart wordt ingezoomd), anders src
  function bestSrc(img) {
    const set = (img.getAttribute('srcset') || '').split(',').map((s) => s.trim().split(/\s+/))
      .filter((p) => p[0]).map((p) => ({ url: p[0], w: parseInt(p[1], 10) || 0 }));
    set.sort((a, b) => b.w - a.w);
    return set.length ? set[0].url : img.currentSrc || img.src;
  }

  // Geoapify Address Autocomplete, alleen woonplaatsen
  function geoapify(key) {
    let ctrl = null;
    return {
      async suggest(q) {
        if (ctrl) ctrl.abort();
        ctrl = new AbortController();
        const qs = new URLSearchParams({ text: q, type: 'city', lang: 'en', limit: 8, format: 'json', apiKey: key });
        const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${qs}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`Geoapify ${res.status}`);
        const { results = [] } = await res.json();
        const seen = new Set();
        return results
          .filter((r) => r.result_type === 'city')
          .map((r) => ({ name: r.city || r.name, meta: [r.state, r.country].filter(Boolean).join(', '), r }))
          .filter((it) => it.name && !seen.has(it.name + it.meta) && seen.add(it.name + it.meta))
          .slice(0, 6);
      },
      resolve(it) {
        const { r } = it;
        const tz = r.timezone && r.timezone.name;
        const offset = tzOffset(tz);
        return {
          name: it.name, country: r.country || '', lat: r.lat, lng: r.lon, tz: tz || '',
          offset: offset == null ? Math.round(r.lon / 15) * 60 : offset,
        };
      },
    };
  }

  function init(root) {
    const visual = root.querySelector('.location-map_visual');
    const canvas = root.querySelector('.location-map_canvas');
    const mapImg = root.querySelector('.location-map_img');
    const panel = root.querySelector('.location-map_panel');
    const form = root.querySelector('[data-location-form]');
    if (!visual || !canvas || !mapImg || !panel || !form) return;
    const ctx = canvas.getContext('2d');
    const timeEl = root.querySelector('[data-location-map-time]');
    const coordsEl = root.querySelector('[data-location-map-coords]');
    const combo = form.querySelector('[data-location-combo]');
    const input = combo && combo.querySelector('input');
    const dropdown = form.querySelector('[data-location-dropdown]');
    const list = form.querySelector('[data-location-list]');
    const template = list && list.querySelector('[data-location-option]');
    const statusEl = form.querySelector('[data-location-status]');
    const step2 = form.querySelector('[data-location-step="2"]');
    const fields = {};
    form.querySelectorAll('[data-location-field]').forEach((el) => { fields[el.dataset.locationField] = el; });
    if (!input || !dropdown || !list || !template || !step2) return;
    template.remove();

    const VIEW = +root.dataset.view || 90;
    // Teksten uit Webflow (vertaalbaar per taal); {q} = zoekterm, {n} = aantal
    const TEXT_NONE = root.dataset.textNoResult || 'No place found for "{q}"';
    const TEXT_RESULTS = root.dataset.textResults || '{n} places found';
    const FOLLOW = +root.dataset.follow || 0.035;
    const key = (root.dataset.geoapifyKey || '').trim();
    const gsap = window.gsap;
    const animate = !reduced && !!gsap;

    // ---------- Toestand ----------
    const img = new Image();
    const size = { W: 0, H: 0, dpr: 1 };
    const cam = { lng: 0, lat: 0, zoom: 1 };
    const marker = { lat: 20, lng: 0, alpha: 0, label: '', labelAlpha: 0 };
    let mode = 'follow'; // follow | travel | placed
    let place = null;
    let pointer = null;
    let lastPointer = null;
    let visible = false;
    let wanderT = 0;
    let tl = null;
    let colors = { ocean: '#102641', line: 'rgba(255,255,255,.8)', mark: '#fff', font: 'sans-serif' };

    // ---------- Camera ----------
    function freeArea() {
      const { W, H } = size;
      let pad;
      if (desktop.matches) {
        const v = visual.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        pad = { l: 64, r: Math.max(64, v.right - p.left + 64), t: 64, b: 64 };
      } else {
        pad = { l: 40, r: 32, t: 40, b: 48 };
      }
      const w = Math.max(40, W - pad.l - pad.r);
      const h = Math.max(40, H - pad.t - pad.b);
      return { w, h, cx: pad.l + w / 2, cy: pad.t + h / 2 };
    }
    // Kaart vult altijd de hoogte
    const minZoom = () => Math.max(1, (size.H * 360) / (size.W * (LAT_TOP - LAT_BOTTOM)));
    function clampLat(lat, zoom) {
      const half = size.H / 2 / ((size.W / 360) * zoom);
      return LAT_TOP - half < LAT_BOTTOM + half ? (LAT_TOP + LAT_BOTTOM) / 2 : clamp(lat, LAT_BOTTOM + half, LAT_TOP - half);
    }
    function startBox() {
      return desktop.matches ? { w: -150, e: 60, n: 72, s: -50 } : { w: -45, e: 75, n: 72, s: -40 };
    }
    function fitBox(box) {
      const A = freeArea();
      const base = size.W / 360;
      const zoom = Math.max(Math.min(A.w / (box.e - box.w), A.h / (box.n - box.s)) / base, minZoom());
      const s = base * zoom;
      return {
        lng: (box.w + box.e) / 2 - (A.cx - size.W / 2) / s,
        lat: clampLat((box.n + box.s) / 2 + (A.cy - size.H / 2) / s, zoom),
        zoom,
      };
    }
    function placeView(p) {
      const A = freeArea();
      // VIEW geldt voor de langste zijde (op een staande mobiele kaart dus de hoogte)
      const zoom = Math.max((360 / VIEW) * Math.max(1, size.H / size.W), minZoom());
      const s = (size.W / 360) * zoom;
      return { lng: p.lng - (A.cx - size.W / 2) / s, lat: clampLat(p.lat + (A.cy - size.H / 2) / s, zoom), zoom };
    }
    function toScreen(p) {
      const s = (size.W / 360) * cam.zoom;
      return { x: size.W / 2 + wrapLng(p.lng - cam.lng) * s, y: size.H / 2 + (cam.lat - p.lat) * s };
    }
    function fromScreen(pt) {
      const s = (size.W / 360) * cam.zoom;
      return { lng: cam.lng + (pt.x - size.W / 2) / s, lat: clamp(cam.lat - (pt.y - size.H / 2) / s, -60, 80) };
    }

    // ---------- Tijd en coördinaten ----------
    const currentOffset = () => (place && mode !== 'follow' ? place.offset : Math.round(wrapLng(marker.lng) / 15) * 60);
    function updateReadouts() {
      if (timeEl) {
        const t = formatTime(currentOffset());
        if (timeEl.textContent !== t) timeEl.textContent = t;
      }
      if (coordsEl) {
        const c = formatCoords(marker);
        if (coordsEl.textContent !== c) coordsEl.textContent = c;
      }
    }

    // ---------- Tekenen ----------
    function render() {
      const { W, H, dpr } = size;
      if (!W || !img.naturalWidth) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = (W / 360) * cam.zoom;

      // Kaart, links en rechts herhaald; boven en onder de oceaankleur
      const imgPerDeg = img.naturalWidth / MAP.span;
      const imgW = MAP.span * s;
      const imgH = (img.naturalHeight / imgPerDeg) * s;
      const y0 = H / 2 + (cam.lat - MAP.top) * s;
      ctx.fillStyle = colors.ocean;
      ctx.fillRect(0, 0, W, H);
      const per = 360 * s;
      let x0 = W / 2 + (MAP.left - cam.lng) * s;
      x0 = (((x0 % per) + per) % per) - per;
      for (let x = x0 - per; x < W; x += per) ctx.drawImage(img, x, y0, imgW, imgH);

      // Marker met kruislijnen
      if (marker.alpha > 0) {
        const p = toScreen(marker);
        const px = Math.round(p.x) + 0.5;
        const py = Math.round(p.y) + 0.5;
        ctx.globalAlpha = marker.alpha;
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, 0); ctx.lineTo(px, py - 9);
        ctx.moveTo(px, py + 9); ctx.lineTo(px, H);
        ctx.moveTo(0, py); ctx.lineTo(px - 9, py);
        ctx.moveTo(px + 9, py); ctx.lineTo(W, py);
        ctx.stroke();
        ctx.fillStyle = colors.mark; ctx.fillRect(px - 7.5, py - 7.5, 15, 15);
        ctx.fillStyle = colors.ocean; ctx.fillRect(px - 5.5, py - 5.5, 11, 11);
        ctx.fillStyle = colors.mark; ctx.fillRect(px - 3.5, py - 3.5, 7, 7);

        // Plaatsnaam naast de marker, aan de kant van het midden van het vrije deel
        if (marker.label && marker.labelAlpha > 0) {
          ctx.globalAlpha = marker.alpha * marker.labelAlpha;
          ctx.font = `400 ${desktop.matches ? 13 : 11}px ${colors.font}`;
          ctx.textBaseline = 'bottom';
          const left = p.x > freeArea().cx + 40;
          ctx.textAlign = left ? 'right' : 'left';
          ctx.fillStyle = colors.mark;
          ctx.fillText(marker.label.toUpperCase(), px + (left ? -14 : 14), py - 10);
          ctx.textAlign = 'left';
        }
        ctx.globalAlpha = 1;
      }
      updateReadouts();
    }

    function readColors() {
      const cs = getComputedStyle(visual);
      const ts = timeEl ? getComputedStyle(timeEl) : cs;
      colors = {
        ocean: cs.backgroundColor || colors.ocean,
        line: 'rgba(255, 255, 255, .8)',
        mark: cs.color || '#fff',
        font: ts.fontFamily || 'sans-serif',
      };
    }

    function resize() {
      const r = visual.getBoundingClientRect();
      if (!r.width || !r.height) return;
      size.W = r.width;
      size.H = r.height;
      size.dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * size.dpr);
      canvas.height = Math.round(r.height * size.dpr);
      if (!tl || !tl.isActive()) {
        const v = place && mode === 'placed' ? placeView(place) : fitBox(startBox());
        Object.assign(cam, v, { lng: nearLng(v.lng, cam.lng) });
        if (place && mode === 'placed') marker.lng = nearLng(place.lng, cam.lng);
      }
      render();
    }

    // ---------- Marker volgt de muis ----------
    function wanderPoint() {
      const A = freeArea();
      return { x: A.cx + A.w * 0.3 * Math.sin(wanderT * 0.21), y: A.cy + A.h * 0.25 * Math.sin(wanderT * 0.15 + 1.3) };
    }
    let last = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = last ? Math.min(now - last, 100) : 16.7;
      last = now;
      if (mode !== 'follow' || !visible || reduced || !size.W || document.hidden) return;
      const dr = dt / 16.667;
      wanderT += dt / 1000;
      const target = fromScreen(pointer || lastPointer || wanderPoint());
      const k = 1 - Math.pow(1 - FOLLOW, dr);
      marker.lng += (nearLng(target.lng, marker.lng) - marker.lng) * k;
      marker.lat += (target.lat - marker.lat) * k;
      render();
    }
    if (hasMouse) {
      visual.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = visual.getBoundingClientRect();
        pointer = lastPointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      });
      visual.addEventListener('pointerleave', () => { pointer = null; });
    }

    // ---------- Camera-vlucht ----------
    // Van Wijk & Nuij (zoals Mapbox flyTo): bij grote afstand eerst uitzoomen, dan schuiven, dan inzoomen.
    function flyTo(v, duration) {
      const rho = 1.42;
      const rho2 = rho * rho;
      const big = Math.max(size.W, size.H);
      const base = size.W / 360;
      const from = { ...cam };
      const w0 = big / (base * from.zoom);
      const w1 = big / (base * v.zoom);
      const dx = v.lng - from.lng;
      const dy = v.lat - from.lat;
      const u1 = Math.hypot(dx, dy);
      const r = (i) => {
        const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
        return Math.log(Math.sqrt(b * b + 1) - b);
      };
      const r0 = r(0);
      let S = (r(1) - r0) / rho;
      let w = (s) => Math.cosh(r0) / Math.cosh(r0 + rho * s);
      let u = (s) => (w0 * (Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2) / u1;
      if (u1 < 1e-6 || !isFinite(S)) {
        const k = w1 < w0 ? -1 : 1;
        S = Math.abs(Math.log(w1 / w0)) / rho;
        u = () => 0;
        w = (s) => Math.exp(k * rho * s);
      }
      const p = { t: 0 };
      return gsap.to(p, {
        t: 1, duration, ease: 'power2.inOut',
        onUpdate() {
          if (S === 0 || p.t === 1) { Object.assign(cam, v); return; }
          const s = p.t * S;
          const f = u(s);
          cam.lng = from.lng + dx * f;
          cam.lat = from.lat + dy * f;
          cam.zoom = from.zoom / w(s);
        },
      });
    }

    function travelTo(p) {
      if (tl) tl.kill();
      mode = 'travel';
      place = p;
      const v = placeView(p);
      v.lng = nearLng(v.lng, cam.lng);
      const to = { lat: p.lat, lng: nearLng(p.lng, v.lng) };
      if (!animate) {
        Object.assign(cam, v);
        Object.assign(marker, to, { alpha: 1, label: p.name, labelAlpha: 1 });
        mode = 'placed';
        render();
        return Promise.resolve();
      }
      marker.lng = nearLng(marker.lng, v.lng);
      return new Promise((resolve) => {
        tl = gsap.timeline({ onUpdate: render, onComplete: () => { mode = 'placed'; render(); resolve(); } })
          .to(marker, { alpha: 1, labelAlpha: 0, duration: 0.15 }, 0)
          .call(() => { marker.label = p.name; }, null, 0.15)
          .add(flyTo(v, 1.8), 0)
          .to(marker, { lat: to.lat, lng: to.lng, duration: 1.8, ease: 'power2.inOut' }, 0)
          .to(marker, { labelAlpha: 1, duration: 0.35 }, '>-0.15');
      });
    }

    // ---------- Formulier ----------
    const source = key ? geoapify(key) : null;
    let items = [];
    let active = -1;
    let reqId = 0;
    let pasted = false;
    let timer = 0;
    const listId = `location-search-${Math.random().toString(36).slice(2, 8)}`;
    list.id = listId;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listId);
    input.setAttribute('autocomplete', 'off');
    const live = document.createElement('p');
    live.className = 'u-sr-only';
    live.setAttribute('aria-live', 'polite');
    combo.append(live);
    const announce = (t) => { live.textContent = t; };

    function openStep2() {
      if (step2.hasAttribute('data-open')) return;
      step2.setAttribute('data-open', '');
      if (animate) gsap.fromTo(step2, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', clearProps: 'opacity,transform' }); // geen visibility: dan kan de focus er niet heen
    }
    // Zonder werkende zoekdienst typt de bezoeker de plaats zelf; stap 2 komt pas na een ingevulde plaats
    // (Enter of het veld verlaten), zodat het formulier ook dan in stappen blijft.
    let free = !source;
    function freeMode() {
      free = true;
      closeList();
    }
    function acceptTyped(moveFocus) {
      const v = input.value.trim();
      if (v.length < 2) return;
      if (fields.place) fields.place.value = v;
      const first = !step2.hasAttribute('data-open');
      openStep2();
      if (first && moveFocus) {
        const next = step2.querySelector('input:not([type="hidden"]), textarea, select');
        if (next) next.focus({ preventScroll: true });
      }
    }

    function setFields(p) {
      const set = (k, v) => { if (fields[k]) fields[k].value = v; };
      set('place', p ? p.name : '');
      set('country', p ? p.country : '');
      set('lat', p ? p.lat.toFixed(5) : '');
      set('lng', p ? p.lng.toFixed(5) : '');
      set('timezone', p ? p.tz : '');
    }
    function closeList() {
      dropdown.removeAttribute('data-open');
      items = [];
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function renderList(query) {
      list.replaceChildren();
      if (!items.length) {
        const li = template.cloneNode(true);
        li.removeAttribute('role');
        li.setAttribute('aria-disabled', 'true');
        li.querySelector('[data-location-option-name]').textContent = TEXT_NONE.replace('{q}', query);
        li.querySelector('[data-location-option-meta]').textContent = '';
        list.append(li);
      }
      items.forEach((it, i) => {
        const li = template.cloneNode(true);
        li.id = `${listId}-${i}`;
        li.setAttribute('aria-selected', String(i === active));
        li.querySelector('[data-location-option-name]').textContent = it.name;
        li.querySelector('[data-location-option-meta]').textContent = it.meta;
        li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
        list.append(li);
      });
      const wasOpen = dropdown.hasAttribute('data-open');
      dropdown.setAttribute('data-open', '');
      input.setAttribute('aria-expanded', 'true');
      if (!wasOpen) {
        announce(items.length ? TEXT_RESULTS.replace('{n}', items.length) : TEXT_NONE.replace('{q}', query));
        // Op een telefoon kan het veld onderin staan: lijst in beeld schuiven
        const r = dropdown.getBoundingClientRect();
        if (r.bottom > innerHeight) dropdown.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }
      if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
      else input.removeAttribute('aria-activedescendant');
    }
    async function lookup() {
      const q = input.value.trim();
      const id = ++reqId;
      if (free || q.length < 2) { closeList(); return; }
      let res;
      try {
        res = await source.suggest(q);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('location-map: zoeken mislukt', err);
        if (statusEl) statusEl.textContent = '';
        freeMode();
        return;
      }
      if (id !== reqId) return;
      items = res;
      active = items.length ? 0 : -1;
      if (pasted && items.length) { pasted = false; choose(0); return; }
      pasted = false;
      renderList(q);
    }
    async function choose(i) {
      const it = items[i];
      if (!it) return;
      closeList();
      const p = source.resolve(it);
      input.value = it.meta ? `${it.name}, ${it.meta}` : it.name;
      setFields(p);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Eerst stap 2 openen (het kader groeit), dan vliegen met de nieuwe maat: zo springt de kaart niet na de landing
      const first = !step2.hasAttribute('data-open');
      openStep2();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      resize();
      await travelTo(p);
      if (first) {
        const next = step2.querySelector('input:not([type="hidden"]), textarea, select');
        if (next) next.focus({ preventScroll: true });
      }
    }

    input.addEventListener('input', () => {
      setFields(null);
      clearTimeout(timer);
      // Geoapify telt elke aanvraag: pas zoeken als er even niet getypt wordt
      timer = setTimeout(lookup, pasted ? 0 : 250);
    });
    input.addEventListener('paste', () => { pasted = true; });
    input.addEventListener('change', () => { if (free) acceptTyped(false); });
    // Tab naar de links in de vermelding: lijst open laten zolang de focus in het zoekblok blijft
    const leaving = (e) => !(e.relatedTarget && combo.contains(e.relatedTarget));
    input.addEventListener('blur', (e) => { if (leaving(e)) setTimeout(closeList, 150); });
    dropdown.addEventListener('focusout', (e) => { if (leaving(e)) closeList(); });
    dropdown.addEventListener('mousedown', (e) => { if (!e.target.closest('a')) e.preventDefault(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) {
          if (!free && input.value.trim().length >= 2) { e.preventDefault(); lookup(); }
          return;
        }
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        renderList(input.value.trim());
        const el = list.children[active];
        if (el) el.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault(); // Enter in het zoekveld verstuurt het formulier niet
        if (free) acceptTyped(true);
        else if (items.length) choose(Math.max(active, 0));
        else { pasted = true; lookup(); }
      } else if (e.key === 'Escape') {
        closeList();
      }
    });

    // ---------- Klok en start ----------
    setInterval(() => { if (visible) updateReadouts(); }, 1000);

    function start() {
      readColors();
      resize();
      new ResizeObserver(resize).observe(visual);
      if (document.fonts) document.fonts.ready.then(() => { readColors(); render(); });
      const A = freeArea();
      Object.assign(marker, fromScreen({ x: A.cx, y: A.cy }));
      root.setAttribute('data-location-map-ready', '');
      let shown = false;
      new IntersectionObserver((entries) => {
        visible = entries.some((en) => en.isIntersecting);
        if (visible && !shown) {
          shown = true;
          if (animate) gsap.to(marker, { alpha: 1, duration: 0.6, delay: 0.9, onUpdate: render });
          else { marker.alpha = 1; render(); }
        }
      }, { threshold: 0.2 }).observe(visual);
      requestAnimationFrame(loop);
    }
    img.onload = start;
    img.onerror = () => console.warn('location-map: kaart kon niet laden');
    img.src = bestSrc(mapImg);
  }

  const run = () => document.querySelectorAll('[data-location-map]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
