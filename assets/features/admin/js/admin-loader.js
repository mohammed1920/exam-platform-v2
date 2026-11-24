/* Load administration modules only after Firebase confirms an enabled admin account. */
(function () {
  'use strict';

  const ADMIN_PANEL_SCRIPT = 'assets/features/admin/js/firebase-admin-panel.js?v=2.44';

  let checkPromise = null;
  let modulesPromise = null;
  let lastUserUid = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script => script.src === new URL(src, document.baseURI).href);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('تعذر تحميل وحدة الإدارة: ' + src));
      };
      document.body.appendChild(script);
    });
  }

  async function loadAdminModules() {
    if (modulesPromise) return modulesPromise;

    modulesPromise = loadScript(ADMIN_PANEL_SCRIPT).catch(error => {
      modulesPromise = null;
      console.error('تعذر تحميل لوحة إدارة ميزان:', error);
      return false;
    });

    return modulesPromise;
  }

  async function checkAdminAccess(user) {
    if (!user || !window.publicAuth?.firestore) return false;

    try {
      const snapshot = await window.publicAuth.firestore.collection('admins').doc(user.uid).get();
      const data = snapshot.exists ? snapshot.data() : null;
      const allowed = Boolean(data && data.role === 'admin' && data.enabled !== false);
      window.mizanAdminAccess = allowed ? { uid: user.uid, verified: true } : null;
      return allowed;
    } catch (error) {
      console.warn('تعذر التحقق من صلاحية الإدارة:', error);
      return false;
    }
  }

  async function syncAdminAccess() {
    if (checkPromise) return checkPromise;

    checkPromise = (async () => {
      const auth = window.publicAuth;
      if (!auth) return false;

      await auth.whenReady();
      await auth.whenFirestoreReady?.();

      const user = auth.user;
      if (!user) {
        lastUserUid = null;
        window.mizanAdminAccess = null;
        return false;
      }

      const allowed = await checkAdminAccess(user);
      if (!allowed) {
        window.mizanAdminAccess = null;
        return false;
      }

      lastUserUid = user.uid;
      return loadAdminModules();
    })().finally(() => {
      checkPromise = null;
    });

    return checkPromise;
  }

  function start() {
    if (!window.publicAuth) return;
    syncAdminAccess();
    window.addEventListener('public-auth-state-changed', event => {
      const user = event.detail?.user || null;
      if (!user) {
        lastUserUid = null;
        window.mizanAdminAccess = null;
        return;
      }
      if (user.uid !== lastUserUid) syncAdminAccess();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();