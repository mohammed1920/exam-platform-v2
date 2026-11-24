/* Platform bootstrap: service-worker updates, install prompt, visitor counter.
 * Keep this classic script at the end of index.html to preserve execution order.
 */

(function setupMizanServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  const workerUrl = new URL('service-worker.js', document.baseURI);
  const appScope = new URL('./', document.baseURI);
  const dismissedKey = 'mizan-update-dismissed';
  let activeRegistration = null;
  let updateBanner = null;
  let isReloading = false;
  let isApplyingUpdate = false;

  function wasDismissed() {
    try { return localStorage.getItem(dismissedKey) === '1'; }
    catch (_) { return false; }
  }

  function dismissUpdate() {
    try { localStorage.setItem(dismissedKey, '1'); } catch (_) {}
    if (updateBanner) updateBanner.hidden = true;
  }

  function createUpdateBanner() {
    if (updateBanner) return updateBanner;

    const banner = document.createElement('section');
    banner.id = 'mizan-update-banner';
    banner.className = 'mizan-update-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');

    const copy = document.createElement('div');
    copy.className = 'mizan-update-banner__copy';

    const title = document.createElement('strong');
    title.textContent = 'يتوفر تحديث جديد لمنصة ميزان';

    const description = document.createElement('span');
    description.textContent = 'حدّث الصفحة للحصول على أحدث الملفات والتحسينات.';

    copy.append(title, description);

    const actions = document.createElement('div');
    actions.className = 'mizan-update-banner__actions';

    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.className = 'mizan-update-banner__action';
    updateButton.textContent = 'تحديث الآن';

    const laterButton = document.createElement('button');
    laterButton.type = 'button';
    laterButton.className = 'mizan-update-banner__dismiss';
    laterButton.textContent = 'لاحقاً';
    laterButton.setAttribute('aria-label', 'تأجيل تحديث ميزان');

    laterButton.addEventListener('click', dismissUpdate);

    updateButton.addEventListener('click', () => {
      if (!navigator.onLine) {
        updateButton.disabled = false;
        updateButton.textContent = 'اتصل بالإنترنت ثم حدّث';
        return;
      }

      updateButton.disabled = true;
      updateButton.textContent = 'جارٍ التحديث…';

      const waitingWorker = activeRegistration && activeRegistration.waiting;
      if (!waitingWorker) {
        // The pending worker may have activated in another tab already.
        isReloading = true;
        window.location.reload();
        return;
      }

      isApplyingUpdate = true;
      waitingWorker.postMessage({ type: 'MIZAN_SKIP_WAITING' });
      window.setTimeout(() => {
        if (!isReloading) {
          isReloading = true;
          window.location.reload();
        }
      }, 8000);
    });

    window.addEventListener('online', () => {
      if (updateBanner && !updateBanner.hidden) {
        const button = updateBanner.querySelector('.mizan-update-banner__action');
        if (button && !button.disabled) button.textContent = 'تحديث الآن';
      }
    });

    actions.append(updateButton, laterButton);
    banner.append(copy, actions);
    document.body.appendChild(banner);
    updateBanner = banner;
    return banner;
  }

  function showUpdateAvailable(registration) {
    if (registration) activeRegistration = registration;
    // An update prompt is valid only while a new worker is actually waiting
    // to take control; refreshed CSS/JS files alone are not an app release.
    if (!activeRegistration?.waiting || !navigator.serviceWorker.controller) return;
    if (wasDismissed()) return;
    createUpdateBanner().hidden = false;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first controller acquisition also needs one reload: the original
    // document was loaded before the worker could intercept its CSS/JS files.
    // On later updates this reload happens only after the user accepts update.
    if (isReloading) return;
    isReloading = true;
    if (isApplyingUpdate) {
      try { localStorage.removeItem(dismissedKey); } catch (_) {}
    }
    window.location.reload();
  });

  async function registerWorker() {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Remove only an obsolete registration for this exact app scope.
      // Never unregister unrelated workers on the same origin.
      await Promise.all(registrations
        .filter(registration => {
          if (registration.scope !== appScope.href) return false;
          const worker = registration.active || registration.waiting || registration.installing;
          return worker && worker.scriptURL !== workerUrl.href;
        })
        .map(registration => registration.unregister()));

      const registration = await navigator.serviceWorker.register(workerUrl.href, {
        scope: appScope.pathname,
        updateViaCache: 'none'
      });
      activeRegistration = registration;
      if (!registration.waiting) {
        try { sessionStorage.removeItem(dismissedKey); } catch (_) {}
      }

      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateAvailable(registration);
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (
            installingWorker.state === 'installed' &&
            navigator.serviceWorker.controller &&
            registration.waiting
          ) {
            showUpdateAvailable(registration);
          }
        });
      });

      const checkForUpdates = () => {
        if (navigator.onLine && document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      };

      window.addEventListener('focus', checkForUpdates);
      window.addEventListener('online', checkForUpdates);
      document.addEventListener('visibilitychange', checkForUpdates);
      checkForUpdates();
    } catch (error) {
      console.warn('Mizan Service Worker registration failed:', error);
    }
  }

  registerWorker();
})();

(function setupInstallButton() {
  const installButton = document.getElementById('install-app-btn');
  const iosHint = document.getElementById('ios-install-hint');

  if (!installButton) return;

  const displayMode = window.matchMedia('(display-mode: standalone)');
  const installDismissedKey = 'mizan-install-completed';
  const isInstallCompleted = () => {
    try { return localStorage.getItem(installDismissedKey) === '1'; }
    catch (_) { return false; }
  };
  const isInstalledMode = () =>
    displayMode.matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true ||
    isInstallCompleted();

  const hideInstallPrompt = () => {
    installButton.hidden = true;
    installButton.style.setProperty('display', 'none', 'important');
    if (iosHint) {
      iosHint.hidden = true;
      iosHint.style.setProperty('display', 'none', 'important');
    }
  };

  if (isInstalledMode()) {
    hideInstallPrompt();
    return;
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (isInstalledMode()) hideInstallPrompt();
  }, { once: true });

  let deferredPrompt = null;
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  installButton.hidden = false;
  installButton.style.removeProperty('display');
  if (iosHint) iosHint.style.removeProperty('display');

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });

  installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
      const installPrompt = deferredPrompt;
      deferredPrompt = null;
      installPrompt.prompt();

      try {
        const choice = await installPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          try { localStorage.setItem(installDismissedKey, '1'); } catch (_) {}
          hideInstallPrompt();
        }
      } catch (_) {
        // Keep the install button available if installation does not complete.
      }
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
    deferredPrompt = null;
    try { localStorage.setItem(installDismissedKey, '1'); } catch (_) {}
    hideInstallPrompt();
  });

  const syncInstallButton = () => {
    if (isInstalledMode()) hideInstallPrompt();
  };

  if (typeof displayMode.addEventListener === 'function') {
    displayMode.addEventListener('change', syncInstallButton);
  } else if (typeof displayMode.addListener === 'function') {
    displayMode.addListener(syncInstallButton);
  }

  window.addEventListener('pageshow', syncInstallButton);
  window.addEventListener('focus', syncInstallButton);
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
