// Modal via het adres: opent de Lumos Modal waarvan data-modal-target gelijk is aan de hash van de URL
// (bv. /products/zircon#quote opent het offertepaneel). Gebruikt door de knop "Request a quote" van
// de kostencalculator op Home (ticket 1244r2tgcat). Laadt niets; doet niets zonder passende modal.
//
// Het Lumos Modal-script registreert zijn modals bij DOMContentLoaded in window.lumos.modal; daarom
// opent dit script pas daarna. Na openen verdwijnt de hash uit de URL, zodat terug/vernieuwen het
// paneel niet opnieuw opent.

(function () {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id || !/^[\w-]+$/.test(id)) return;

  function open() {
    const modal = window.lumos && window.lumos.modal;
    if (!modal || !modal.list || !modal.list[id]) return;
    modal.open(id);
    history.replaceState(null, '', location.pathname + location.search);
  }

  // Na de DOMContentLoaded-handlers van de pagina (die van Lumos Modal staat eerder in de pagina).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(open, 0));
  } else {
    setTimeout(open, 0);
  }
})();
