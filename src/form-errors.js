// Form Errors: verzendknoppen zijn altijd klikbaar. Klopt een verplicht veld niet, dan komt er bij versturen
// (of bij Continue in een formulier met stappen) een rode melding onder dat veld en gaat de focus naar het
// eerste foute veld. Zodra het veld klopt, verdwijnt de melding. Geldt voor elk Webflow-formulier op de site.
//
// Webflow-markup (Lumos-formulieren):
//   form.form_element[data-error-required][data-error-email][data-error-choice][data-error-terms]
//       meldingsteksten per formulier (vertaalbaar); zonder attribuut de Engelse tekst hieronder
//   form.form_element[data-error-field-<name>]   optioneel: eigen melding voor één veld (name in kleine letters),
//       gaat voor de algemene tekst, bv. data-error-field-message="Please describe your material requirements."
//   .form_label_wrap › .form_field               tekstveld / textarea  → melding onder het veld
//   .form_ui_item › input[type=checkbox|radio]    vinkje / keuzerondje  → melding onder het vinkje of de groep
// Melding: p.form_field_error (Webflow-stijl), veld krijgt aria-invalid en aria-describedby.
// Zonder script: de gewone browsercontrole.

(() => {
  const TEXT = {
    required: 'Please fill in this field.',
    email: 'Please enter a valid email address.',
    choice: 'Please choose an option.',
    terms: 'Please accept the terms.',
  };
  let uid = 0;

  // Velden die nu meetellen: zichtbaar, niet uitgeschakeld, niet in een andere stap.
  const fieldsOf = (root) => [...root.querySelectorAll('input, select, textarea')].filter((f) =>
    f.willValidate && f.type !== 'hidden' && f.type !== 'submit' && !f.closest('[hidden], .is-step:not(.is-current)'));

  function textFor(form, f) {
    const d = form.dataset;
    if (f.type === 'radio') return d.errorChoice || TEXT.choice;
    if (f.type === 'checkbox') return d.errorTerms || TEXT.terms;
    // Eigen melding per veld: data-error-field-<name> op het formulier (name in kleine letters, bv. data-error-field-message).
    const own = f.name && form.getAttribute(`data-error-field-${f.name.toLowerCase()}`);
    if (own) return own;
    if (f.validity.typeMismatch || f.validity.patternMismatch) return d.errorEmail || TEXT.email;
    return d.errorRequired || TEXT.required;
  }

  // Waar de melding komt: tekstvelden binnen hun label (onder het veld, ook in een raster van twee
  // kolommen); keuzerondjes onder de groep; een vinkje onder zijn regel (met de link "Terms").
  function placeOf(f) {
    if (f.type === 'radio') return { after: f.closest('.form_fieldset_list') || f.closest('fieldset') || f };
    if (f.type === 'checkbox') return { after: f.closest('.form_terms') || f.closest('.form_ui_item') || f };
    const label = f.closest('.form_label_wrap');
    return label ? { inside: label } : { after: f };
  }
  const groupOf = (form, f) => (f.type === 'radio' && f.name
    ? [...form.querySelectorAll('input[type="radio"]')].filter((r) => r.name === f.name) : [f]);

  function mark(form, f, bad) {
    const place = placeOf(f);
    let msg = place.inside ? place.inside.querySelector(':scope > .form_field_error')
      : (place.after.nextElementSibling && place.after.nextElementSibling.matches('.form_field_error') ? place.after.nextElementSibling : null);
    const group = groupOf(form, f);
    if (bad) {
      if (!msg) {
        // In een label een span (geen p) en verborgen voor de labelnaam; de melding komt via aria-describedby.
        msg = document.createElement(place.inside ? 'span' : 'p');
        msg.className = 'form_field_error';
        msg.id = `form-error-${++uid}`;
        if (place.inside) {
          msg.setAttribute('aria-hidden', 'true');
          msg.style.display = 'block';
          place.inside.append(msg);
        } else {
          place.after.after(msg);
          // Naast een veld in een kolom: de tussenruimte van de kolom terugbrengen tot space/2.
          const gap = parseFloat(getComputedStyle(place.after.parentElement).rowGap) || 0;
          if (gap) msg.style.marginTop = `calc(var(--_spacing---space--2, 0.5rem) - ${gap}px)`;
        }
      }
      msg.textContent = textFor(form, f);
      group.forEach((g) => { g.setAttribute('aria-invalid', 'true'); g.setAttribute('aria-describedby', msg.id); });
    } else {
      if (msg) msg.remove();
      group.forEach((g) => { g.removeAttribute('aria-invalid'); g.removeAttribute('aria-describedby'); });
    }
  }

  // Controleert de velden in root (formulier of één stap); geeft true als alles klopt.
  function check(form, root = form, focus = true) {
    let first = null;
    const seen = new Set();
    for (const f of fieldsOf(root)) {
      if (f.type === 'radio') { if (seen.has(f.name)) continue; seen.add(f.name); }
      const ok = f.checkValidity();
      mark(form, f, !ok);
      if (!ok && !first) first = f;
    }
    if (first && focus) first.focus();
    return !first;
  }

  function setup(form) {
    if (form.dataset.formErrorsReady) return;
    form.dataset.formErrorsReady = 'true';
    form.noValidate = true;
    // Een veld met een melding opnieuw controleren zodra je typt of kiest.
    const recheck = (e) => {
      const f = e.target;
      if (!f.matches || !f.matches('input, select, textarea')) return;
      if (f.getAttribute('aria-invalid') === 'true' && f.checkValidity()) mark(form, f, false);
    };
    form.addEventListener('input', recheck);
    form.addEventListener('change', recheck);
  }

  // Vóór Webflow (en vóór de stappen) versturen tegenhouden als er iets niet klopt.
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.formErrorsReady) return;
    if (!check(form)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  window.pmsFormErrors = { check };

  function init() { document.querySelectorAll('form').forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
