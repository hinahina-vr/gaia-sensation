// Local file navigation cannot reliably trigger browser downloads.
if (location.protocol === 'file:') {
  document.querySelectorAll('a[download]').forEach(link => {
    link.removeAttribute('download');
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'PNGを開く ↗';
  });
}
