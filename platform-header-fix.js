(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    /* اسم المنصة: سطر واحد فقط، بدون أي تأثير على القائمة الجانبية */
    header > h1 {
      white-space: nowrap;
      width: 100%;
      max-width: 100%;
      overflow: visible;
      text-align: center;
      font-size: clamp(1rem, 5.2vw, 1.8rem);
      line-height: 1.35;
      letter-spacing: 0;
    }

    header > h1 span {
      display: inline-block !important;
      vertical-align: middle;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
})();
