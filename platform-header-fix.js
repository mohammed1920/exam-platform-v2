(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    /* توافق الهيدر مع هوية ميزان الجديدة */
    .mizan-header {
      position: relative;
      padding: 78px 64px 28px !important;
      text-align: center;
    }

    /* نقل هوية ميزان قليلاً لليسار حتى تتمركز بصرياً مع مساحة المحتوى */
    .mizan-brand {
      direction: ltr !important;
      grid-template-columns: auto auto !important;
      grid-template-rows: auto auto !important;
      position: relative;
      left: -90px;
    }

    .mizan-logo-animation {
      grid-column: 2 !important;
      grid-row: 1 !important;
    }

    .mizan-brand-copy {
      display: contents !important;
    }

    .mizan-brand-copy h1 {
      grid-column: 1 !important;
      grid-row: 1 !important;
      display: block;
      width: auto;
      max-width: none;
      margin: 0 !important;
      text-align: left !important;
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
      grid-column: 1 / -1 !important;
      grid-row: 2 !important;
      margin: 0 !important;
      text-align: center !important;
      max-width: 900px;
      direction: rtl !important;
    }

    @media (max-width: 560px) {
      .mizan-header {
        padding: 58px 52px 22px !important;
      }

      .mizan-brand {
        left: -45px;
      }
    }
  `;
  document.head.appendChild(style);
})();