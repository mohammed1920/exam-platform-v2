/* Mizan central card action bus.
   Book cards intentionally keep their own interactions and are not handled here. */
(function () {
  'use strict';

  function resolveAction(target) {
    return target.closest('[data-mizan-card-action], [data-home-action]');
  }

  function dispatch(target) {
    const card = resolveAction(target);
    if (!card || card.closest('.book-card')) return;
    const action = card.dataset.mizanCardAction || card.dataset.homeAction;
    if (!action) return;
    if (window.MizanHomeActions && typeof window.MizanHomeActions.run === 'function') {
      window.MizanHomeActions.run(action);
    }
  }

  function install() {
    document.addEventListener('click', event => dispatch(event.target));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = resolveAction(event.target);
      if (!card || card.closest('.book-card') || card.matches('button, a, input, select, textarea')) return;
      event.preventDefault();
      dispatch(card);
    });
  }

  window.MizanCardActions = { dispatch };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
