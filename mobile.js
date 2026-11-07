(function () {
  'use strict';
  const status = document.getElementById('offlineStatus');
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = 'オフライン利用にはHTTPSの公開URLで開いてください。';
    return;
  }
  const update = () => {
    status.textContent = navigator.onLine
      ? 'オフライン準備完了。この画面は圏外でも開けます。'
      : '現在オフラインです。記録はこの端末に保存できます。';
  };
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
    } catch (_) {
      status.textContent = 'オフライン準備ができませんでした。通信できる状態で開き直してください。';
    }
  });
})();
