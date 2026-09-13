/* Public-site Firebase Authentication only. admin.html intentionally does not load this file. */
(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyDDZNWGjUfcuyXHywtILZ06hnOWW-ZxGIM',
    authDomain: 'iraq-law-test.firebaseapp.com',
    projectId: 'iraq-law-test',
    storageBucket: 'iraq-law-test.firebasestorage.app',
    messagingSenderId: '1081689116785',
    appId: '1:1081689116785:web:272ef3aa864e5d1c40cbd0',
    measurementId: 'G-DL2T4Y7HVB'
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  const state = {
    user: null,
    ready: false,
    pendingAction: null,
    resolveReady: null
  };
  state.readyPromise = new Promise(resolve => { state.resolveReady = resolve; });

  const errorMessages = {
    'auth/invalid-email': 'يرجى إدخال بريد إلكتروني صحيح.',
    'auth/user-disabled': 'تم تعطيل هذا الحساب.',
    'auth/user-not-found': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/wrong-password': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/email-already-in-use': 'هذا البريد الإلكتروني مستخدم مسبقًا.',
    'auth/weak-password': 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.',
    'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول.',
    'auth/popup-blocked': 'منع المتصفح نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة ثم حاول مجددًا.',
    'auth/too-many-requests': 'تكررت المحاولات. انتظر قليلًا ثم حاول مجددًا.'
  };

  function messageFor(error) {
    return errorMessages[error && error.code] || 'تعذر إتمام العملية. حاول مرة أخرى.';
  }

  function displayName(user) {
    return (user && (user.displayName || user.email || 'المستخدم')).trim();
  }

  function updateAccountButton() {
    const button = document.getElementById('account-btn');
    if (!button) return;
    button.textContent = state.user ? `👤 ${displayName(state.user)}` : '🔐 تسجيل الدخول';
    button.title = state.user ? 'فتح قائمة الحساب' : 'تسجيل الدخول';
    button.classList.toggle('authenticated', Boolean(state.user));
  }

  function setModalMode(mode) {
    const modal = document.getElementById('login-modal');
    const title = document.getElementById('auth-modal-title');
    const submit = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const switchButton = document.getElementById('auth-switch-btn');
    const reset = document.getElementById('auth-reset-btn');
    const isRegister = mode === 'register';
    if (!modal) return;
    modal.dataset.mode = mode;
    title.textContent = isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول';
    submit.textContent = isRegister ? 'إنشاء الحساب' : 'تسجيل الدخول';
    switchText.textContent = isRegister ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟';
    switchButton.textContent = isRegister ? 'تسجيل الدخول' : 'إنشاء حساب';
    reset.style.display = isRegister ? 'none' : 'inline-block';
    document.getElementById('auth-error').textContent = '';
  }

  function openModal(mode = 'login') {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    setModalMode(mode);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => document.getElementById('auth-email')?.focus(), 0);
  }

  function closeModal(clearPending = true) {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('auth-error').textContent = '';
    if (clearPending) state.pendingAction = null;
  }

  function setError(text) {
    const error = document.getElementById('auth-error');
    if (error) error.textContent = text;
  }

  async function withButtonBusy(button, operation) {
    if (button) button.disabled = true;
    try { await operation(); } catch (error) { setError(messageFor(error)); }
    finally { if (button) button.disabled = false; }
  }

  function openAccountMenu() {
    if (!state.user) { openModal(); return; }
    const label = displayName(state.user);
    if (window.confirm(`تم تسجيل الدخول باسم ${label}.\nهل تريد تسجيل الخروج؟`)) signOut();
  }

  async function signInGoogle() {
    await withButtonBusy(document.getElementById('google-signin-btn'), async () => {
      await auth.signInWithPopup(googleProvider);
    });
  }

  async function submitEmailAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const isRegister = document.getElementById('login-modal').dataset.mode === 'register';
    await withButtonBusy(document.getElementById('auth-submit-btn'), async () => {
      if (!email || !password) throw { code: 'auth/invalid-email' };
      if (isRegister) await auth.createUserWithEmailAndPassword(email, password);
      else await auth.signInWithEmailAndPassword(email, password);
    });
  }

  async function resetPassword() {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) { setError('أدخل بريدك الإلكتروني أولًا لاستعادة كلمة المرور.'); return; }
    await withButtonBusy(document.getElementById('auth-reset-btn'), async () => {
      await auth.sendPasswordResetEmail(email);
      setError('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
    });
  }

  async function signOut() {
    try { await auth.signOut(); } catch (error) { console.error('Firebase logout failed:', error); }
  }

  function requireAuth(action) {
    if (typeof action !== 'function') return false;
    if (state.user) { action(); return true; }
    state.pendingAction = action;
    openModal();
    return false;
  }

  function finishPendingAction() {
    const action = state.pendingAction;
    state.pendingAction = null;
    if (state.user && typeof action === 'function') window.setTimeout(action, 0);
  }

  function installModal() {
    if (document.getElementById('login-modal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="auth-modal" id="login-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="auth-modal-title" data-mode="login">
        <div class="auth-modal-content">
          <button class="auth-modal-close" id="auth-close-btn" type="button" aria-label="إغلاق">×</button>
          <div class="auth-modal-heading"><span>⚖️</span><h2 id="auth-modal-title">تسجيل الدخول</h2></div>
          <p class="auth-modal-subtitle">سجّل دخولك للوصول إلى الأسئلة والاختبارات.</p>
          <button class="google-signin-btn" id="google-signin-btn" type="button">G تسجيل الدخول بواسطة Google</button>
          <div class="auth-divider"><span>أو</span></div>
          <form id="auth-form" novalidate>
            <label for="auth-email">البريد الإلكتروني</label>
            <input id="auth-email" type="email" autocomplete="email" required>
            <label for="auth-password">كلمة المرور</label>
            <input id="auth-password" type="password" autocomplete="current-password" minlength="6" required>
            <p class="auth-error" id="auth-error" role="alert"></p>
            <button class="auth-submit-btn" id="auth-submit-btn" type="submit">تسجيل الدخول</button>
          </form>
          <button class="auth-reset-btn" id="auth-reset-btn" type="button">نسيت كلمة المرور؟</button>
          <div class="auth-switch"><span id="auth-switch-text">ليس لديك حساب؟</span> <button id="auth-switch-btn" type="button">إنشاء حساب</button></div>
        </div>
      </div>`);

    document.getElementById('account-btn').addEventListener('click', openAccountMenu);
    document.getElementById('auth-close-btn').addEventListener('click', () => closeModal());
    document.getElementById('login-modal').addEventListener('click', event => {
      if (event.target.id === 'login-modal') closeModal();
    });
    document.getElementById('google-signin-btn').addEventListener('click', signInGoogle);
    document.getElementById('auth-form').addEventListener('submit', submitEmailAuth);
    document.getElementById('auth-reset-btn').addEventListener('click', resetPassword);
    document.getElementById('auth-switch-btn').addEventListener('click', () => {
      setModalMode(document.getElementById('login-modal').dataset.mode === 'login' ? 'register' : 'login');
    });
  }

  window.publicAuth = {
    get user() { return state.user; },
    get ready() { return state.ready; },
    whenReady: () => state.readyPromise,
    requireAuth,
    openLogin: openModal,
    closeLogin: closeModal,
    signOut,
    displayName
  };

  document.addEventListener('DOMContentLoaded', installModal);
  auth.onAuthStateChanged(user => {
    const wasAuthenticated = Boolean(state.user);
    state.user = user;
    state.ready = true;
    updateAccountButton();
    if (state.resolveReady) { state.resolveReady(user); state.resolveReady = null; }
    if (user) {
      closeModal(false);
      finishPendingAction();
    } else if (wasAuthenticated && window.app?.examActive) {
      window.app.backToBooks();
    }
    window.dispatchEvent(new CustomEvent('public-auth-state-changed', { detail: { user } }));
  });
})();
