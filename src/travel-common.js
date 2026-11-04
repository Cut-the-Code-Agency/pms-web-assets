// Gedeeld door chromite-travel.js (3D-model) en stone-travel.js (video): merkcurve, hulpfuncties en de
// lichte titels die het script zelf tekent en op de vorm van de steen afknipt.

// Merkcurve "Position" (decisions/motion.md): cubic-bezier(0.75, 0, 0.5, 1)
function bezier(x1, y1, x2, y2) {
  const f = (u, a, b) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  return t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1, u = t;
    for (let i = 0; i < 24; i++) {
      u = (lo + hi) / 2;
      if (f(u, x1, x2) < t) lo = u; else hi = u;
    }
    return f(u, y1, y2);
  };
}
export const ease = bezier(0.75, 0, 0.5, 1);
export const clamp01 = v => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpPose = (a, b, t) => ({ cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), size: lerp(a.size, b.size, t) });

// Lichte titel: elke letter op de plek van de DOM-letter tekenen, met de afknipping van maskers
// (SplitText-lettermaskers) en de zichtbaarheid van de inlaadanimatie
export function makeLightPainter() {
  const range = document.createRange();
  let styleCache = new Map();
  const style = el => {
    let s = styleCache.get(el);
    if (!s) { s = getComputedStyle(el); styleCache.set(el, s); }
    return s;
  };

  // Ondoorzichtigheid en afknipping van de letter: alle voorouders tot <body>
  function context(el) {
    let opacity = 1;
    let clip = null;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = style(n);
      if (s.visibility === 'hidden' && n === el) return null;
      if (s.display === 'none') return null;
      opacity *= parseFloat(s.opacity);
      if (opacity < 0.01) return null;
      const ox = s.overflowX !== 'visible', oy = s.overflowY !== 'visible';
      if (ox || oy) {
        const r = n.getBoundingClientRect();
        const c = { l: ox ? r.left : -1e5, t: oy ? r.top : -1e5, r: ox ? r.right : 1e5, b: oy ? r.bottom : 1e5 };
        clip = clip ? { l: Math.max(clip.l, c.l), t: Math.max(clip.t, c.t), r: Math.min(clip.r, c.r), b: Math.min(clip.b, c.b) } : c;
      }
    }
    return { opacity, clip };
  }

  function paint(ctx, item) {
    const walker = document.createTreeWalker(item.el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.data;
      if (!text.trim()) continue;
      const parent = node.parentElement;
      const ctxInfo = context(parent);
      if (!ctxInfo) continue;
      const s = style(parent);
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      ctx.globalAlpha = ctxInfo.opacity;
      const upper = s.textTransform === 'uppercase';
      const lower = s.textTransform === 'lowercase';
      for (let i = 0; i < text.length; i++) {
        let ch = text[i];
        if (/\s/.test(ch)) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getClientRects()[0];
        if (!r || !r.width) continue;
        if (upper) ch = ch.toUpperCase(); else if (lower) ch = ch.toLowerCase();
        const ascent = ctx.measureText(ch).fontBoundingBoxAscent;
        const c = ctxInfo.clip;
        if (c) {
          if (c.r <= c.l || c.b <= c.t) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(c.l, c.t, c.r - c.l, c.b - c.t);
          ctx.clip();
        }
        ctx.fillText(ch, r.left, r.top + ascent);
        if (c) ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  return {
    begin() { styleCache = new Map(); },
    paint,
  };
}
