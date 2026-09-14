(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    /* الهيدر: القائمة أولاً بالأعلى، ثم اسم المنصة والشرح تحته */
    header {
      position: relative;
      padding: 82px 20px 28px !important;
      text-align: center;
    }

    /* زر القائمة يأخذ الصف العلوي ولا يحجز مكاناً بجانب اسم المنصة */
    header > #account-btn {
      position: absolute !important;
      top: 24px !important;
      right: 24px !important;
      z-index: 10;
      margin: 0 !important;
    }

    /* اسم المنصة ينزل تحت زر القائمة ويبقى في المنتصف */
    header > h1 {
      display: block;
      width: 100%;
      max-width: 100%;
      margin: 0 auto 7px !important;
      text-align: center;
      white-space: nowrap;
      overflow: visible;
      font-size: clamp(1rem, 5.2vw, 1.8rem);
      line-height: 1.35;
      letter-spacing: 0;
    }

    header > h1 span {
      display: inline-block !important;
      vertical-align: middle;
      white-space: nowrap;
    }

    /* شرح المنصة يبقى أسفل الاسم ومتمركزاً */
    header > p {
      margin-left: auto;
      margin-right: auto;
      text-align: center;
      max-width: 900px;
    }

    @media (max-width: 560px) {
      header {
        padding: 76px 14px 24px !important;
      }

      header > #account-btn {
        top: 16px !important;
        right: 16px !important;
      }

      header > h1 {
        font-size: clamp(0.95rem, 5vw, 1.5rem);
      }
    }
  `;
  document.head.appendChild(style);
})();
