(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    /* توافق الهيدر مع هوية ميزان الجديدة */
    .mizan-header {
      position: relative;
      padding: 22px 64px 24px !important;
      text-align: center;
    }

    .mizan-brand-copy h1 {
      display: block;
      width: auto;
      max-width: none;
      margin: 0 0 7px !important;
      text-align: right;
      white-space: nowrap;
      overflow: visible;
      line-height: 1.1;
    }

    .mizan-brand-copy h1 span {
      display: inline-block !important;
      vertical-align: middle;
      white-space: nowrap;
    }

    .mizan-brand-copy p {
      margin: 0 !important;
      text-align: right;
      max-width: 900px;
    }

    @media (max-width: 560px) {
      .mizan-header {
        padding: 18px 52px 20px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
