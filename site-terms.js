(() => {
  const dialog = document.querySelector('#site-terms');
  document.addEventListener('click', event => {
    if (event.target.closest?.('#intro-terms-open') && !dialog.open) dialog.showModal();
  });
  dialog?.querySelector('[data-terms-close]').addEventListener('click', () => dialog.close());
  window.addEventListener('keydown', event => {
    if (!dialog.open) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
  }, true);
  dialog?.addEventListener('close', () => document.querySelector('#intro-terms-open')?.focus({ preventScroll: true }));
})();
