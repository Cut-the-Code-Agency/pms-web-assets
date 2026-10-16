// Product Tabs (mineraalpagina): ruimt lege tabs en ontbrekende datasheets op vóórdat het
// Lumos Tab-script (bij DOMContentLoaded) knoppen en panelen op volgorde koppelt.
// Laad met defer in de page-footer: een deferred script draait vóór DOMContentLoaded.
//
// Webflow-markup (Lumos Tab in de slot van Product Tabs):
//   .product-tabs_wrap .tab_button_list .tab_button_item   knoppen
//   .product-tabs_wrap .tab_content_list .product-tabs_panel   panelen (zelfde volgorde)
//     .product-tabs_text            rich text; leeg (w-dyn-bind-empty of geen tekst) = tab weg
//     .product-tabs_docs
//       a[data-doc]                 datasheet-link; zonder bestand (geen href, '#') = weg
//       [data-doc-request]          zin "available upon request"; weg zodra er een datasheet is
//
// Zonder CMS (statische pagina) regelen de zichtbaarheidsprops alles; dit script doet dan niets.

(function () {
  const isEmpty = (el) => !el || el.classList.contains('w-dyn-bind-empty') || !el.textContent.trim();
  const noFile = (a) => {
    const href = (a.getAttribute('href') || '').trim();
    return !href || href === '#' || a.classList.contains('w-dyn-bind-empty');
  };

  function clean(section) {
    const buttons = [...section.querySelectorAll('.tab_button_list .tab_button_item')];
    const panels = [...section.querySelectorAll('.tab_content_list .product-tabs_panel')];

    panels.forEach((panel) => {
      const docs = panel.querySelector('.product-tabs_docs');
      if (!docs) return;
      const links = [...docs.querySelectorAll('a[data-doc]')];
      links.filter(noFile).forEach((a) => a.remove());
      const left = docs.querySelectorAll('a[data-doc]').length;
      const request = docs.querySelector('[data-doc-request]');
      if (left && request) request.remove();
      if (!left && !request) docs.remove();
    });

    // Tab weg als het paneel geen tekst heeft (knop en paneel samen, zodat de volgorde klopt).
    panels.forEach((panel, i) => {
      if (!isEmpty(panel.querySelector('.product-tabs_text'))) return;
      const wrapper = panel.closest('.tab_content_list > *') || panel;
      wrapper.remove();
      const btn = buttons[i];
      if (btn) (btn.closest('.tab_button_list > *') || btn).remove();
    });

    if (!section.querySelector('.tab_content_list .product-tabs_panel')) section.style.display = 'none';
  }

  function boot() {
    document.querySelectorAll('.product-tabs_wrap').forEach(clean);
  }

  boot();
})();
