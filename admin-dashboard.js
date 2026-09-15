(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyDDZNWGjUfcuyXHyWtILZ06hnOWW-ZxGIM',
    authDomain: 'iraq-law-test.firebaseapp.com',
    projectId: 'iraq-law-test',
    storageBucket: 'iraq-law-test.firebasestorage.app',
    messagingSenderId: '1081689116785',
    appId: '1:1081689116785:web:272ef3aa864e5d1c40cbd0'
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

  function dateValue(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value) {
    const d = dateValue(value);
    return d ? new Intl.DateTimeFormat('ar-IQ', {year:'numeric', month:'2-digit', day:'2-digit'}).format(d) : '—';
  }

  function show(view) {
    ['login-view','dashboard-view','denied-view'].forEach(id => $(id).hidden = id !== view);
  }

  function setMessage(text, error = false) {
    const el = $('login-message');
    el.textContent = text || '';
    el.className = error ? 'message error' : 'message';
  }

  async function isAdmin(user) {
    if (!user) return false;
    try {
      const snap = await db.collection('admins').doc(user.uid).get();
      return snap.exists && snap.data()?.role === 'admin' && snap.data()?.enabled !== false;
    } catch (error) {
      console.error('Admin access check failed:', error);
      return false;
    }
  }

  async function loadStudents() {
    const btn = $('refresh-btn');
    btn.disabled = true;
    $('table-root').innerHTML = '<div class="state">جاري تحديث بيانات المشتركين...</div>';
    try {
      const snap = await db.collection('students').orderBy('createdAt', 'desc').limit(2000).get();
      const students = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
      const now = new Date();
      const active = students.filter(s => s.status !== 'suspended').length;
      const suspended = students.filter(s => s.status === 'suspended').length;
      const thisMonth = students.filter(s => {
        const d = dateValue(s.createdAt);
        return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;

      $('total').textContent = students.length;
      $('active').textContent = active;
      $('month').textContent = thisMonth;
      $('suspended').textContent = suspended;

      if (!students.length) {
        $('table-root').innerHTML = '<div class="state">لا توجد حسابات طلاب مسجلة حالياً.</div>';
        return;
      }

      $('table-root').innerHTML = `<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>تاريخ التسجيل</th><th>الحالة</th></tr></thead><tbody>${students.map(s => `<tr><td>${esc(s.displayName || 'طالب المنصة')}</td><td dir="ltr">${esc(s.email || '—')}</td><td>${formatDate(s.createdAt)}</td><td><span class="status ${s.status === 'suspended' ? 'suspended' : 'active'}">${s.status === 'suspended' ? 'موقوف' : 'فعال'}</span></td></tr>`).join('')}</tbody></table></div>`;
    } catch (error) {
      console.error('Student administration read failed:', error);
      $('table-root').innerHTML = '<div class="state error">تعذر تحميل بيانات المشتركين. تحقق من قواعد Firestore.</div>';
    } finally {
      btn.disabled = false;
    }
  }

  async function enterDashboard(user) {
    if (!user) { show('login-view'); return; }
    $('admin-email').textContent = user.email || '—';
    if (await isAdmin(user)) {
      show('dashboard-view');
      await loadStudents();
    } else {
      await auth.signOut();
      show('denied-view');
    }
  }

  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('email').value.trim();
    const password = $('password').value;
    const btn = $('login-btn');
    if (!email || !password) return setMessage('أدخل البريد الإلكتروني وكلمة المرور.', true);
    btn.disabled = true;
    setMessage('جاري التحقق من صلاحية الأدمن...');
    try {
      const credential = await auth.signInWithEmailAndPassword(email, password);
      if (!(await isAdmin(credential.user))) {
        await auth.signOut();
        setMessage('هذا الحساب لا يملك صلاحية الأدمن.', true);
        return;
      }
      await enterDashboard(credential.user);
    } catch (error) {
      console.error(error);
      setMessage('فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.', true);
    } finally { btn.disabled = false; }
  });

  $('refresh-btn').addEventListener('click', loadStudents);
  $('logout-btn').addEventListener('click', () => auth.signOut());
  $('back-btn').addEventListener('click', () => show('login-view'));

  auth.onAuthStateChanged(user => enterDashboard(user));
})();