(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    /* هيدر ميزان: صف الأدوات يبقى مستقلاً، وهوية ميزان تعرض كصورة واحدة */
    .mizan-header {
      position: relative;
      padding: 72px 24px 24px !important;
      text-align: center;
    }

    .mizan-header-art {
      width: min(100%, 760px);
      margin: 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      left: 0;
    }

    .mizan-header-art-image {
      display: block;
      width: 100%;
      max-width: 760px;
      height: auto;
      margin: 0 auto;
      object-fit: contain;
    }

    .mizan-header .mizan-header-art + #install-app-btn {
      margin-left: auto;
      margin-right: auto;
    }

    @media (max-width: 700px) {
      .mizan-header {
        padding: 58px 14px 18px !important;
      }

      .mizan-header-art {
        width: min(100%, 620px);
      }

      .mizan-header-art-image {
        width: 100%;
      }
    }

    @media (max-width: 420px) {
      .mizan-header {
        padding: 54px 8px 16px !important;
      }

      .mizan-header-art {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
})();