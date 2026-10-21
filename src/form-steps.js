// Form Steps: een Webflow-formulier in stappen (Contact Form op Contact: gegevens → rol → bericht).
// Markup (Webflow-component Contact Form, Lumos-velden):
//   .form_element                         het <form>
//     fieldset.form_fieldset_wrap.is-step  één stap (minstens twee, anders doet het script niets)
//     [data-form-steps-count] › [data-form-step-current] / [data-form-step-total]   teller "1/3"
//     [data-form-back] [data-form-next] [data-form-submit]                         knoppen (Button Main erin)
// Continue controleert de velden van de huidige stap (required, type=email, verplichte radiogroep; meldingen
// via form-errors.js) en gaat pas dan door; Enter in een veld doet hetzelfde. De verzendknop staat alleen op de
// laatste stap. Zonder script staan alle stappen onder elkaar en verstuurt het formulier gewoon.

(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setup(form) {
    const steps = [...form.querySelectorAll('.form_fieldset_wrap.is-step')];
    if (steps.length < 2 || form.dataset.formStepsReady) return;
    form.dataset.formStepsReady = 'true';
    form.classList.add('is-steps');
    const back = form.querySelector('[data-form-back]');
    const next = form.querySelector('[data-form-next]');
    const submit = form.querySelector('[data-form-submit]');
    const counter = form.querySelector('[data-form-steps-count]');
    const current = form.querySelector('[data-form-step-current]');
    const total = form.querySelector('[data-form-step-total]');
    if (total) total.textContent = `/${steps.length}`;
    if (counter) { counter.setAttribute('role', 'status'); counter.setAttribute('aria-live', 'polite'); }
    let at = 0;

    const fields = (step) => [...step.querySelectorAll('input, select, textarea')].filter((f) => f.type !== 'hidden' && !f.disabled);

    function show(i, focus) {
      at = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach((s, k) => {
        const on = k === at;
        s.classList.toggle('is-current', on);
        s.toggleAttribute('hidden', !on);
      });
      if (back) back.hidden = at === 0;
      if (next) next.hidden = at === steps.length - 1;
      if (submit) submit.hidden = at !== steps.length - 1;
      if (current) current.textContent = String(at + 1);
      if (counter) counter.setAttribute('aria-label', `Step ${at + 1} of ${steps.length}`);
      if (focus) {
        const first = fields(steps[at])[0];
        if (first) first.focus({ preventScroll: true });
        const r = form.getBoundingClientRect();
        if (r.top < 0) form.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
      }
    }

    // Klopt de huidige stap? Met form-errors.js (site-footer) rode meldingen onder de foute velden,
    // anders de melding van de browser bij het eerste foute veld.
    function valid() {
      if (window.pmsFormErrors) return window.pmsFormErrors.check(form, steps[at]);
      for (const f of fields(steps[at])) {
        if (!f.checkValidity()) { f.reportValidity(); return false; }
      }
      return true;
    }

    function onNext(e) { if (e) e.preventDefault(); if (valid()) show(at + 1, true); }
    function onBack(e) { if (e) e.preventDefault(); show(at - 1, true); }
    if (next) next.addEventListener('click', onNext);
    if (back) back.addEventListener('click', onBack);

    // Enter of een submit vóór de laatste stap: naar de volgende stap in plaats van versturen.
    form.addEventListener('submit', (e) => {
      if (at < steps.length - 1) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onNext();
      }
    }, true);
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && at < steps.length - 1) { e.preventDefault(); onNext(); }
    });

    show(0, false);
  }

  function init() { document.querySelectorAll('form.form_element, .form_element').forEach((f) => setup(f.tagName === 'FORM' ? f : f.querySelector('form') || f)); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
