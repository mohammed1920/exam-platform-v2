/* Student account behavior refinements */
(function () {
  'use strict';

  function currentUser() {
    return window.publicAuth && window.publicAuth.user;
  }

  function syncSidebarUser() {
    const sidebar = document.getElementById('student-account-sidebar');
    if (!sidebar) return;
    const user = currentUser();
    const name = user && (user.displayName || user.email) ? (user.displayName || user.email) : 'زائر';
    const email = user && user.email ? user.email : 'سجّل الدخول للوصول إلى ميزات الحساب';
    const avatar = document.getElementById('student-sidebar-avatar');
    const nameEl = document.getElementById('student-sidebar-name');
    const emailEl = document.getElementById('student-sidebar-email');
    const status = sidebar.querySelector('.student-sidebar-status');
    const logout = document.getElementById('student-sidebar-logout');

    if (avatar) avatar.textContent = user ? name.trim().charAt(0).toUpperCase() || 'ط' : '👤';
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (status) status.innerHTML = user ? '<span></span> حساب الطالب' : '<span></span> تسجيل الدخول مطلوب';
    if (logout) logout.innerHTML = user
      ? '<i class="fas fa-right-from-bracket"></i><span>تسجيل الخروج</span>'
      : '<i class="fas fa-right-to-bracket"></i><span>تسجيل الدخول</span>';
  }

  function openSidebarForCurrentState() {
    const sidebar = document.getElementById('student-account-sidebar');
    if (!sidebar) return;
    syncSidebarUser();
    sidebar.classList.add('is-open');
    sidebar.setAttribute('aria-hidden', 'false');
    document.body.classList.add('student-sidebar-open');
  }

  function bindAccountButton() {
    const account = document.getElementById('account-btn');
    if (!account || account.dataset.accountPatchBound === 'true') return;
    const replacement = account.cloneNode(true);
    account.replaceWith(replacement);
    replacement.dataset.accountPatchBound = 'true';
    replacement.addEventListener('click', openSidebarForCurrentState);
  }

  function updateAccountButton() {
    const button = document.getElementById('account-btn');
    if (!button) return;
    const user = currentUser();
    if (user) {
      button.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
      button.setAttribute('aria-label', 'فتح قائمة حسابي');
      button.title = 'قائمة حسابي';
      button.classList.add('authenticated');
    } else {
      button.textContent = 'سجل الدخول';
      button.setAttribute('aria-label', 'سجل الدخول');
      button.title = 'سجل الدخول';
      button.classList.remove('authenticated');
    }
  }

  function updateSidebarLogoutAction() {
    const button = document.getElementById('student-sidebar-logout');
    if (!button || button.dataset.accountPatchAction === 'true') return;
    button.dataset.accountPatchAction = 'true';
    button.addEventListener('click', event => {
      if (currentUser()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.publicAuth && window.publicAuth.openLogin();
    }, true);
  }

  function injectProfileEditor() {
    const root = document.getElementById('student-dashboard-content');
    if (!root || !currentUser()) return;
    const header = root.querySelector('.student-page-header h2');
    if (!header || header.textContent.trim() !== 'الملف الشخصي') return;
    if (root.querySelector('#profile-name-editor')) return;

    const user = currentUser();
    const name = user.displayName || '';
    const editor = document.createElement('div');
    editor.id = 'profile-name-editor';
    editor.className = 'profile-name-editor';
    editor.innerHTML = `
      <div class="profile-name-editor-heading">
        <div><h3>تعديل الاسم الشخصي</h3><p>يمكنك تغيير الاسم الذي يظهر في حسابك وقائمة الطالب.</p></div>
        <i class="fas fa-pen"></i>
      </div>
      <label for="profile-display-name">الاسم الشخصي</label>
      <div class="profile-name-editor-row">
        <input id="profile-display-name" type="text" maxlength="80" autocomplete="name" value="${escapeHtml(name)}" placeholder="اكتب اسمك هنا">
        <button type="button" id="profile-save-name"><i class="fas fa-check"></i> حفظ الاسم</button>
      </div>
      <p class="profile-name-editor-message" id="profile-name-editor-message" role="status"></p>`;

    root.appendChild(editor);
    const input = editor.querySelector('#profile-display-name');
    const save = editor.querySelector('#profile-save-name');
    const message = editor.querySelector('#profile-name-editor-message');
    save.addEventListener('click', async () => {
      const newName = input.value.trim();
      if (newName.length < 2) {
        message.textContent = 'اكتب اسماً مكوّناً من حرفين على الأقل.';
        return;
      }
      const auth = window.firebase && firebase.auth ? firebase.auth() : null;
      const activeUser = auth && auth.currentUser;
      if (!activeUser) {
        window.publicAuth.openLogin();
        return;
      }
      save.disabled = true;
      message.textContent = 'جاري حفظ الاسم...';
      try {
        await activeUser.updateProfile({ displayName: newName });
        await activeUser.reload();
        message.textContent = 'تم حفظ الاسم بنجاح.';
        updateAccountButton();
        syncSidebarUser();
        setTimeout(() => window.studentDashboard && window.studentDashboard.render('profile'), 250);
      } catch (error) {
        console.error('Profile name update failed:', error);
        message.textContent = 'تعذر حفظ الاسم. حاول مرة أخرى.';
      } finally {
        save.disabled = false;
      }
    });
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function install() {
    bindAccountButton();
    updateAccountButton();
    syncSidebarUser();
    updateSidebarLogoutAction();
    injectProfileEditor();

    const observer = new MutationObserver(() => {
      bindAccountButton();
      updateAccountButton();
      syncSidebarUser();
      updateSidebarLogoutAction();
      injectProfileEditor();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('public-auth-state-changed', event => {
      updateAccountButton();
      syncSidebarUser();
      if (event.detail && event.detail.user === null) {
        const sidebar = document.getElementById('student-account-sidebar');
        if (sidebar) {
          sidebar.classList.remove('is-open');
          sidebar.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('student-sidebar-open');
        if (window.app && typeof window.app.backToBooks === 'function') window.app.backToBooks();
      }
      updateSidebarLogoutAction();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
