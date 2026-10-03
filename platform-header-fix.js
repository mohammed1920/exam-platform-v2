(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    /* هيدر ميزان: صف الهوية في المنتصف والعبارة تحته */
    .mizan-header {
      position: relative;
      padding: 30px 76px 25px 24px !important;
      text-align: center;
    }

    .mizan-header-brand {
      width: min(100%, 920px);
      margin: 34px auto 0;
      display: flex;
      flex-direction: column;
      direction: rtl;
      justify-content: center;
      align-items: center;
      gap: 8px;
      min-height: 132px;
    }

    .mizan-header-identity {
      display: inline-flex;
      flex-direction: row;
      direction: rtl;
      align-items: center;
      justify-content: center;
      width: max-content;
      max-width: 100%;
      gap: 6px;
    }

    .mizan-header-logo {
      width: 116px;
      height: 116px;
      flex: 0 0 116px;
      display: grid;
      place-items: center;
      overflow: hidden;
    }

    .mizan-header-logo svg {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .mizan-header-copy {
      flex: 0 0 auto;
      width: auto;
      min-width: 0;
      text-align: center;
    }
    .mizan-header-copy h1 {
      margin: 0;
      color: var(--primary, #c29d5f);
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
      font-size: clamp(2.4rem, 5vw, 4.4rem);
      font-weight: 700;
      line-height: 1;
      letter-spacing: .01em;
      text-shadow: 0 5px 24px rgba(194,157,95,.14);
    }

    .mizan-header-tagline {
      margin: 0;
      color: var(--text-secondary, #94a3b8);
      font-family: 'Tajawal', 'Cairo', sans-serif;
      font-size: clamp(.82rem, 1.7vw, 1.08rem);
      font-weight: 500;
      line-height: 1.5;
      text-align: center;
    }

    .mizan-header .mizan-header-brand + #install-app-btn {
      margin-left: auto;
      margin-right: auto;
    }

    @media (max-width: 700px) {
      .mizan-header { padding: 25px 56px 18px 14px !important; }
      .mizan-header-brand { gap: 5px; min-height: 104px; margin-top: 26px; }
      .mizan-header-identity { gap: 5px; }
      .mizan-header-logo { width: 86px; height: 86px; flex-basis: 86px; }
    }

    @media (max-width: 420px) {
      .mizan-header { padding: 22px 50px 16px 8px !important; }
      .mizan-header-brand { margin-top: 20px; }
      .mizan-header-identity { gap: 4px; }
      .mizan-header-logo { width: 70px; height: 70px; flex-basis: 70px; }
      .mizan-header-copy h1 { font-size: 2.3rem; }
      .mizan-header-tagline { font-size: .74rem; }
    }
  `;
  document.head.appendChild(style);

  function mountMizanLogo() {
    const container = document.getElementById('mizan-header-logo');
    if (!container || !window.lottie) return;
    try {
      window.lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'assets/branding/meezan-assemble.json'
      });
    } catch (_) {
      /* لا يُعاد أي شعار قديم إذا تعذر تشغيل Lottie. */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountMizanLogo, { once: true });
  } else {
    mountMizanLogo();
  }
})();
