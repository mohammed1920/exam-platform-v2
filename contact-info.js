/* Mizan contact information module.
 * Owns loading and rendering of the public contact cards.
 */
(function () {
  'use strict';

  async function loadContactInfo() {
    try {
      const pathname = window.location.pathname;
      const basePath = window.location.hostname.endsWith('github.io')
        ? (pathname.split('/').filter(Boolean)[0] ? `/${pathname.split('/').filter(Boolean)[0]}` : '')
        : (pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '');
      const res = await fetch(`${basePath}/data/contact.json?contact_version=3&ts=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        console.log('Contact data loaded:', data);
        renderContactInfo(data);
      }
    } catch (e) {
      console.error('Contact loading failed:', e);
    }
  }

  function renderContactInfo(data) {
    if (!data) return;
    const container = document.getElementById('contactInfoCards');
    if (!container) return;

    container.innerHTML = '';

    const makeCard = ({ href, icon, title, text, className = '', external = false }) => {
      const card = document.createElement('a');
      card.className = `contact-card ${className}`.trim();
      card.href = href;
      if (external) {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }
      card.innerHTML = `<i class="${icon}"></i><span><strong></strong><small></small></span><b class="contact-card-action">${external ? 'فتح' : 'اتصال'}</b>`;
      card.querySelector('strong').textContent = title;
      card.querySelector('small').textContent = text;
      return card;
    };

    // رقم الهاتف: يبقى ظاهراً كبطاقة مستقلة، والضغط عليه يفتح لوحة الاتصال.
    if (data.phone) {
      container.appendChild(makeCard({
        href: `tel:${encodeURIComponent(String(data.phone))}`,
        icon: 'fas fa-phone',
        title: 'رقم الهاتف',
        text: String(data.phone),
        className: 'contact-card-phone'
      }));
    }

    if (data.email) {
      container.appendChild(makeCard({
        href: `mailto:${encodeURIComponent(String(data.email))}`,
        icon: 'fas fa-envelope',
        title: 'البريد الإلكتروني',
        text: String(data.email),
        className: 'contact-card-email'
      }));
    }

    const whatsappNumber = String(data.whatsapp_number || '').replace(/\D/g, '');
    if (whatsappNumber) {
      container.appendChild(makeCard({
        href: `https://wa.me/${whatsappNumber}`,
        icon: 'fab fa-whatsapp',
        title: 'واتساب',
        text: 'تواصل مباشر مع إدارة المنصة',
        className: 'contact-card-whatsapp',
        external: true
      }));
    }

    const telegramUsername = String(data.telegram_username || '').replace(/^@/, '').trim();
    if (telegramUsername) {
      container.appendChild(makeCard({
        href: `https://t.me/${encodeURIComponent(telegramUsername)}`,
        icon: 'fab fa-telegram-plane',
        title: 'تليغرام',
        text: 'تواصل مباشر مع إدارة المنصة',
        className: 'contact-card-telegram',
        external: true
      }));
    }

    const normalizeExternalUrl = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return '#';
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#';
      } catch (_) {
        return '#';
      }
    };

    const instagramValue = String(data.instagram || '').trim();
    if (instagramValue) {
      const instagramUrl = /^https?:\/\//i.test(instagramValue)
        ? instagramValue
        : `https://instagram.com/${encodeURIComponent(instagramValue.replace(/^@/, ''))}`;
      const href = normalizeExternalUrl(instagramUrl);
      if (href !== '#') {
        container.appendChild(makeCard({
          href,
          icon: 'fab fa-instagram',
          title: 'تابعنا على إنستغرام',
          text: instagramValue.startsWith('@') ? instagramValue : `@${instagramValue.replace(/^https?:\/\//i, '').replace(/^www\.instagram\.com\//i, '').replace(/\/$/, '')}`,
          className: 'contact-card-instagram',
          external: true
        }));
      }
    }

    const facebookValue = String(data.facebook || '').trim();
    if (facebookValue) {
      const facebookUrl = /^https?:\/\//i.test(facebookValue)
        ? facebookValue
        : `https://facebook.com/${facebookValue.replace(/^@/, '')}`;
      const href = normalizeExternalUrl(facebookUrl);
      if (href !== '#') {
        container.appendChild(makeCard({
          href,
          icon: 'fab fa-facebook-f',
          title: 'تابع صفحتنا على فيسبوك',
          text: 'صفحتنا الرسمية',
          className: 'contact-card-facebook',
          external: true
        }));
      }
    }

    (Array.isArray(data.social_links) ? data.social_links : []).forEach(link => {
      const href = normalizeExternalUrl(link.url);
      if (href === '#') return;
      const isTelegramLink = /(^|\/)t\.me\//i.test(href);
      container.appendChild(makeCard({
        href,
        icon: isTelegramLink ? 'fab fa-telegram-plane' : 'fas fa-link',
        title: String(link.label || (isTelegramLink ? 'قناة تليغرام' : 'رابط إضافي')),
        text: isTelegramLink ? 'فتح القناة أو المجموعة' : 'فتح الرابط',
        className: isTelegramLink ? 'contact-card-telegram contact-card-secondary' : 'contact-card-secondary',
        external: true
      }));
    });
  }

  window.MizanContactInfo = Object.freeze({
    load: loadContactInfo
  });
})();
