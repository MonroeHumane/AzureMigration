(function () {
  'use strict';

  function renderQr(container) {
    if (!container || typeof qrcode !== 'function') {
      return;
    }

    var url = container.getAttribute('data-url') || window.location.href.split('#')[0];
    var qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    container.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.monroe-artwork-contest-qr[data-url]').forEach(renderQr);
  });
})();
