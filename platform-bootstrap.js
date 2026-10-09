/* Platform bootstrap: install prompt and visitor counter.
 * Keep this classic script at the end of index.html to preserve execution order.
 */

(function setupInstallButton() {
  const installButton = document.getElementById('install-app-btn');
  const iosHint = document.getElementById('ios-install-hint');

  if (!installButton) return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    installButton.hidden = true;
    return;
  }

  installButton.hidden = false;

  let deferredPrompt = null;
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });

  installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      return;
    }

    if (isIOS) {
      if (!iosHint) return;
      iosHint.hidden = false;
      window.setTimeout(() => {
        iosHint.hidden = true;
      }, 7000);
      return;
    }

    window.alert(
      'لتثبيت ميزان على هاتفك:\n\n' +
      'افتح قائمة المتصفح (⋮ أو ≡) ثم اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".'
    );
  });

  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    if (iosHint) iosHint.hidden = true;
    deferredPrompt = null;
  });
})();

(function setupVisitorCounter() {
  const countElement = document.getElementById('visitor-count');
  if (!countElement) return;

  const workspace = 'mhmd-hmyds-team-5310';
  const counterName = 'first-counter-5310';
  const baseUrl = `https://api.counterapi.dev/v2/${workspace}/${counterName}`;
  const alreadyCounted = sessionStorage.getItem('visitCounted') === '1';
  const requestUrl = alreadyCounted ? baseUrl : `${baseUrl}/up`;

  fetch(requestUrl)
    .then((response) => {
      if (!response.ok) throw new Error('Visitor counter request failed');
      return response.json();
    })
    .then((data) => {
      const value =
        data.data?.up_count ??
        data.data?.value ??
        data.count ??
        data.value ??
        null;

      countElement.textContent = value == null ? '—' : String(value);

      if (!alreadyCounted) {
        sessionStorage.setItem('visitCounted', '1');
      }
    })
    .catch(() => {
      countElement.textContent = '—';
    });
})();
