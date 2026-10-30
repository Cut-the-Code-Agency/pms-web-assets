// Card Primary hover: vierkantje, titel, tekst en (CTA) foto.
// Gebruikt de GSAP die Webflow zelf laadt (Site settings › GSAP); laadt zelf niets.
//
// Webflow-markup (in de component Card Primary):
//   [data-card-hover="card"]     de groep waarop gehoverd wordt
//   [data-card-hover="marker"]   het vierkantje; rust: scale(0), oorsprong linksboven (class)
//   [data-card-hover="title"]    de titel; rust: translateX(-…) (class), hover: 0
//   [data-card-hover="text"]     tekst die bij hover verschijnt als hij in rust height 0 heeft
//   [data-card-hover="image"]    de foto; zoomt alleen in de varianten uit ZOOM
//
// Waarom geen Webflow Interactions: die stoppen een lopende animatie niet als de andere begint.
// Erin (450 ms) duurt langer dan eruit (250 ms), dus bij een korte hover bleef de kaart in de
// hover-stand hangen. GSAP met overwrite: 'auto' keert altijd terug vanaf de huidige stand.
// Timing: decisions/motion.md (hover: erin langer dan eruit).

const IN = 0.45;
const OUT = 0.25;
const FADE_IN = 0.3;
const FADE_OUT = 0.2;

// Varianten waarin de foto meezoomt. Webflow zet de variant op de kaart als data-wf--card-primary--variant="cta"
// (naam in kleine letters); oudere publicaties gaven data-wf-variant-state met het variant-id. Beide tellen.
const ZOOM = { cta: 1.084, '51efa20c-c7be-48fe-973a-11367f19d622': 1.084 }; // CTA

function init() {
  const gsap = window.gsap;
  if (!gsap) return;

  const ease = { in: 'power2.inOut', out: 'power2.inOut', fade: 'sine.inOut' };
  if (window.CustomEase) {
    gsap.registerPlugin(window.CustomEase);
    ease.in = window.CustomEase.create('pmsHoverIn', '0.75,0,0.5,1');
    ease.out = window.CustomEase.create('pmsHoverOut', '0.5,0,0.75,1');
    ease.fade = window.CustomEase.create('pmsFade', '0.5,0,0.5,1');
  }

  // Kaarten zonder link of knop (bv. een toepassing zonder industrie) reageren niet: ze zijn niet klikbaar.
  // Uitzondering: varianten waarvan de hovertekst de inhoud is (Certificate: naam van de norm, nooit klikbaar).
  // (Binnen init: dit script draait als gewoon script, alles op het bovenste niveau is globaal.)
  const hoverWithoutLink = ['certificate'];
  const variantOf = (card) => {
    const named = card.closest('[data-wf--card-primary--variant]');
    if (named) return named.getAttribute('data-wf--card-primary--variant');
    return card.closest('[data-wf-variant-state]')?.getAttribute('data-wf-variant-state') || '';
  };

  // Alleen met een muis en vanaf tablet; op mobiel regelt Webflow Interactions de CTA (scroll).
  const canHover = window.matchMedia('(hover: hover) and (min-width: 768px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-card-hover="card"]').forEach((card) => {
    const part = (name) => card.querySelector(`[data-card-hover="${name}"]`);
    const marker = part('marker');
    const title = part('title');
    const text = part('text');
    const image = part('image');
    const parts = [marker, title, text, image].filter(Boolean);

    const variant = variantOf(card);
    const clickable = !!card.querySelector('.clickable_wrap a[href], .clickable_wrap button');
    if (!clickable && !hoverWithoutLink.includes(variant)) return;
    const zoom = ZOOM[variant] || 1;
    const restX = title ? gsap.getProperty(title, 'x') : 0;
    const reveal = !!text && text.getBoundingClientRect().height === 0;

    const play = (on) => {
      if (!canHover.matches) return;
      const still = reduce.matches;
      const move = { duration: still ? 0 : on ? IN : OUT, ease: on ? ease.in : ease.out, overwrite: 'auto' };
      const fade = { duration: still ? 0 : on ? FADE_IN : FADE_OUT, ease: ease.fade, overwrite: 'auto' };
      if (marker) gsap.to(marker, { ...move, scale: on ? 1 : 0, transformOrigin: '0% 0%' });
      if (title) gsap.to(title, { ...move, x: on ? 0 : restX });
      if (reveal) {
        gsap.to(text, { ...move, height: on ? 'auto' : 0 });
        gsap.to(text, { ...fade, opacity: on ? 1 : 0 });
      }
      if (image && zoom !== 1) gsap.to(image, { ...move, scale: on ? zoom : 1 });
    };

    card.addEventListener('mouseenter', () => play(true));
    card.addEventListener('mouseleave', () => play(false));
    // Toetsenbord: alleen bij zichtbare focus, niet na een muisklik.
    card.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) play(true); });
    card.addEventListener('focusout', (e) => { if (!card.contains(e.relatedTarget)) play(false); });

    // Naar mobiel of terug: inline stijlen weg, zodat de classes en Webflow Interactions weer gelden.
    canHover.addEventListener('change', () => gsap.set(parts, { clearProps: 'all' }));
  });
}

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
