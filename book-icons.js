/* ============================================================
   book-icons.js
   مكتبة أيقونات الكتب الفاخرة والبارزة + نظام توزيع الألوان التلقائي
   ============================================================ */

/* -------------------- 1) الثيمات اللونية -------------------- */
const BOOK_THEMES = ['blue', 'burgundy', 'emerald', 'brown', 'purple'];

const BOOK_THEME_LABELS = {
  blue: 'الأزرق الملكي',
  burgundy: 'العنابي الملكي',
  emerald: 'الأخضر الزمردي',
  brown: 'البني الجلدي',
  purple: 'البنفسجي الملكي'
};

function getBookTheme(bookId) {
  const id = String(bookId || '');
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return BOOK_THEMES[hash % BOOK_THEMES.length];
}

/* -------------------- 2) مكتبة الأيقونات الفاخرة والبارزة -------------------- */
// تم تصميم كل SVG بنظام طبقات ثنائي النغمة (Duotone) مع سمك خطوط أعمق وزوايا منحنية
// لتعطي مظهر الشارات القانونية البارزة والملكية عند تطابقها مع خلفية الذهبي.

const BOOK_ICONS = {
  scale: { 
    label: 'ميزان العدالة', 
    svg: '<path opacity="0.2" d="M12 3v17M6 9l-3 7a2 2 0 002.8 2.6L6 18h0c.2 0 3.2 0 3.4 0a2 2 0 002.6-2.6L9 9M18 9l-3 7a2 2 0 002.8 2.6L18 18h0c.2 0 3.2 0 3.4 0a2 2 0 002.6-2.6L21 9" fill="currentColor"/><path d="M12 3v17M4 8h16M6 8l-3 7a2 2 0 003 2.6L8 15M18 8l-3 7a2 2 0 003 2.6L20 15M9 21h6M10 4.5h4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  gavel: { 
    label: 'مطرقة القاضي', 
    svg: '<path opacity="0.25" d="M14 3l7 7-3 3-7-7z" fill="currentColor"/><path d="M14 3l7 7-2.5 2.5-7-7L14 3zM10.5 8.5l-7 7a2 2 0 000 2.8l1.2 1.2a2 2 0 002.8 0l7-7M2 22h8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  globe: { 
    label: 'القانون الدولي', 
    svg: '<circle cx="12" cy="12" r="9" opacity="0.15" fill="currentColor"/><circle cx="12" cy="12" r="9" stroke-width="1.8"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3c3 3.5 4.5 6.5 4.5 9s-1.5 5.5-4.5 9c-3-3.5-4.5-6.5-4.5-9s1.5-5.5 4.5-9z" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  pillar: { 
    label: 'عمود الدستور', 
    svg: '<path opacity="0.2" d="M6 9h12v11H6z" fill="currentColor"/><path d="M4 21h16M3 9h18M12 3L3 9h18L12 3zM6 9v12M10 9v12M14 9v12M18 9v12M2 21h20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  shield: { 
    label: 'درع الحماية', 
    svg: '<path d="M12 3l7 3.5v5.5c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V6.5L12 3z" opacity="0.2" fill="currentColor"/><path d="M12 3l7 3.5v5.5c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V6.5L12 3z M12 7v10M8 11h8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  scroll: { 
    label: 'الوثيقة القانونية', 
    svg: '<path opacity="0.2" d="M8 4h10a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2" fill="currentColor"/><path d="M8 4h10a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zM9 9h6M9 13h6M9 17h4" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  bookOpen: { 
    label: 'كتاب مفتوح', 
    svg: '<path opacity="0.2" d="M12 6.5c-2-1.8-5-2.5-8-1.5v12c3-1 6-.3 8 1.5 2-1.8 5-2.5 8-1.5v-12c-3-1-6-.3-8 1.5z" fill="currentColor"/><path d="M12 6.5c-2-1.8-5-2.5-8-1.5v12c3-1 6-.3 8 1.5 2-1.8 5-2.5 8-1.5v-12c-3-1-6-.3-8 1.5z M12 6.5v14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  document: { 
    label: 'مستند', 
    svg: '<rect x="4" y="3" width="16" height="18" rx="2" opacity="0.2" fill="currentColor"/><rect x="4" y="3" width="16" height="18" rx="2" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  stamp: { 
    label: 'الختم الرسمي', 
    svg: '<circle cx="12" cy="9" r="5" opacity="0.25" fill="currentColor"/><circle cx="12" cy="9" r="5" stroke-width="1.8"/><path d="M9 9l2 2 4-4M4 21h16M7 21v-3a3 3 0 013-3h4a3 3 0 013 3v3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  crown: { 
    label: 'التاج / السيادة', 
    svg: '<path opacity="0.25" d="M3 8l4 3.5L12 4l5 7.5L21 8l-2 11H5L3 8z" fill="currentColor"/><path d="M3 8l4 3.5L12 4l5 7.5L21 8l-2 11H5L3 8z M4 21h16" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  key: { 
    label: 'المفتاح', 
    svg: '<circle cx="7.5" cy="7.5" r="4.5" opacity="0.2" fill="currentColor"/><circle cx="7.5" cy="7.5" r="4.5" stroke-width="1.8"/><path d="M11 11l9.5 9.5M16 16l2.5-2.5M18 18l2.5-2.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  lock: { 
    label: 'القفل / الأمان', 
    svg: '<rect x="5" y="10" width="14" height="11" rx="2" opacity="0.2" fill="currentColor"/><rect x="5" y="10" width="14" height="11" rx="2" stroke-width="1.8"/><path d="M8 10V7a4 4 0 018 0v3M12 14v3" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  flag: { 
    label: 'العلم / الدولة', 
    svg: '<path opacity="0.25" d="M5 4h13l-3 4.5 3 4.5H5z" fill="currentColor"/><path d="M5 3v18M5 4h13l-3 4.5 3 4.5H5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  star: { 
    label: 'نجمة التميز', 
    svg: '<path opacity="0.25" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-width="1.8" stroke-linejoin="round"/>' 
  },
  compass: { 
    label: 'البوصلة', 
    svg: '<circle cx="12" cy="12" r="9" opacity="0.15" fill="currentColor"/><circle cx="12" cy="12" r="9" stroke-width="1.8"/><path d="M16.2 7.8l-2.8 8.4-5.6 2.8 2.8-8.4z" fill="currentColor" opacity="0.3"/><path d="M16.2 7.8l-2.8 8.4-5.6 2.8 2.8-8.4 5.6-2.8z" stroke-width="1.8" stroke-linejoin="round"/>' 
  },
  anchor: { 
    label: 'المرساة', 
    svg: '<circle cx="12" cy="5" r="2.5" opacity="0.25" fill="currentColor"/><circle cx="12" cy="5" r="2.5" stroke-width="1.8"/><path d="M12 7.5V21M4 12H2a10 10 0 0020 0h-2M7 17l5 4 5-4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  feather: { 
    label: 'ريشة التوقيع', 
    svg: '<path opacity="0.2" d="M20 3c-7 0-15 5-17 16 3-1.5 6-2 8.5-3.5L20 3z" fill="currentColor"/><path d="M20 3c-7 0-15 5-17 16 3-1.5 6-2 8.5-3.5L20 3zM11.5 15.5L4 21M13 9l-5 5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  handshake: { 
    label: 'الاتفاق / العقد', 
    svg: '<path opacity="0.2" d="M12 11l-3 3-4-3 5-5 4 2 5-3 3 3-5 5z" fill="currentColor"/><path d="M2 11l5-4 4.5 2.5L16 6.5l6 4M2 11l4 4 4-2 3 3 5-5M10 13l2 2M13.5 10.5l2.5 2.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  linkChain: { 
    label: 'الالتزام القانوني', 
    svg: '<rect x="2" y="8" width="9" height="8" rx="4" opacity="0.2" fill="currentColor"/><rect x="13" y="8" width="9" height="8" rx="4" opacity="0.2" fill="currentColor"/><rect x="2" y="8" width="9" height="8" rx="4" stroke-width="1.8"/><rect x="13" y="8" width="9" height="8" rx="4" stroke-width="1.8"/><path d="M8 12h8" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  briefcase: { 
    label: 'الحقيبة المهنية', 
    svg: '<rect x="3" y="7" width="18" height="13" rx="2" opacity="0.2" fill="currentColor"/><rect x="3" y="7" width="18" height="13" rx="2" stroke-width="1.8"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18M12 12v2" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  awardRibbon: { 
    label: 'شهادة تقدير', 
    svg: '<circle cx="12" cy="8" r="5" opacity="0.25" fill="currentColor"/><circle cx="12" cy="8" r="5" stroke-width="1.8"/><path d="M8.5 12.5L6 21l6-3 6 3-2.5-8.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  courthouse: { 
    label: 'مبنى المحكمة', 
    svg: '<path opacity="0.2" d="M3 10h18v9H3z" fill="currentColor"/><path d="M2 21h20M3 10h18M12 3L2 10h20L12 3zM5 10v9M9 10v9M15 10v9M19 10v9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  penSignature: { 
    label: 'التوقيع', 
    svg: '<path opacity="0.2" d="M14 3l7 7-10 10H4v-7L14 3z" fill="currentColor"/><path d="M14 3l7 7-10 10H4v-7L14 3zM3 21c4 0 5-2 8-2s4 2 9 2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  family: { 
    label: 'الأحوال الشخصية', 
    svg: '<circle cx="8" cy="7" r="2.5" opacity="0.3" fill="currentColor"/><circle cx="16" cy="7" r="2.5" opacity="0.3" fill="currentColor"/><circle cx="8" cy="7" r="2.5" stroke-width="1.8"/><circle cx="16" cy="7" r="2.5" stroke-width="1.8"/><path d="M2 20v-1.5a4.5 4.5 0 014.5-4.5h3A4.5 4.5 0 0114 18.5V20M13 14a4 4 0 014-4h1a4 4 0 014 4v6" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  percent: { 
    label: 'الضرائب والرسوم', 
    svg: '<circle cx="7" cy="7" r="2.5" fill="currentColor" opacity="0.3"/><circle cx="17" cy="17" r="2.5" fill="currentColor" opacity="0.3"/><circle cx="7" cy="7" r="2.5" stroke-width="1.8"/><circle cx="17" cy="17" r="2.5" stroke-width="1.8"/><path d="M18 6L6 18" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  handcuffs: { 
    label: 'القانون الجنائي', 
    svg: '<circle cx="7" cy="12" r="4.5" opacity="0.2" fill="currentColor"/><circle cx="17" cy="12" r="4.5" opacity="0.2" fill="currentColor"/><circle cx="7" cy="12" r="4.5" stroke-width="1.8"/><circle cx="17" cy="12" r="4.5" stroke-width="1.8"/><path d="M11.5 12h1M7 7.5V6a2 2 0 012-2h6a2 2 0 012 2v1.5" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  magnifier: { 
    label: 'التحقيق', 
    svg: '<circle cx="10.5" cy="10.5" r="6.5" opacity="0.2" fill="currentColor"/><circle cx="10.5" cy="10.5" r="6.5" stroke-width="1.8"/><path d="M15.5 15.5L21 21" stroke-width="2" stroke-linecap="round"/>' 
  },
  fingerprint: { 
    label: 'البصمة', 
    svg: '<path opacity="0.2" d="M12 3a7 7 0 00-7 7c0 4 2 7 2 11h10c0-4 2-7 2-11a7 7 0 00-7-7z" fill="currentColor"/><path d="M12 3a7 7 0 00-7 7c0 4 2 7 2 11M12 3a7 7 0 017 7c0 4-2 7-2 11M9 11a3 3 0 016 0c0 4-1.5 6-1.5 10M12 7a1 1 0 00-1 1c0 5-1.5 7-1.5 10" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  clipboardCheck: { 
    label: 'قائمة تحقق', 
    svg: '<rect x="4" y="4" width="16" height="17" rx="2" opacity="0.2" fill="currentColor"/><rect x="4" y="4" width="16" height="17" rx="2" stroke-width="1.8"/><path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M8.5 12.5l2.5 2.5 4.5-4.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  bank: { 
    label: 'البنك / المال', 
    svg: '<circle cx="12" cy="12" r="9" opacity="0.15" fill="currentColor"/><circle cx="12" cy="12" r="9" stroke-width="1.8"/><path d="M12 6v12M9.5 9a2.5 2.5 0 012.5-2h1a2 2 0 010 4h-2a2 2 0 000 4h1a2.5 2.5 0 002.5-2" stroke-width="1.8" stroke-linecap="round"/>' 
  },
  emblem: { 
    label: 'الشعار الوطني', 
    svg: '<path opacity="0.2" d="M12 2l3 5 5 1-4 4 1 5-5-3-5 3 1-5-4-4 5-1z" fill="currentColor"/><path d="M12 2l2.5 5.5L20 8.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1L12 2zM12 11v9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  torch: { 
    label: 'شعلة العدالة', 
    svg: '<path opacity="0.25" d="M12 2c1.5 2 3 3.5 3 5.5a3 3 0 01-6 0C9 5.5 10.5 4 12 2z" fill="currentColor"/><path d="M12 2c1.5 2 3 3.5 3 5.5a3 3 0 01-6 0C9 5.5 10.5 4 12 2zM8 11h8l-1.5 11h-5L8 11z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  map: { 
    label: 'الحدود الجغرافية', 
    svg: '<path opacity="0.2" d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4z" fill="currentColor"/><path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  },
  buildingColumns: { 
    label: 'مبنى حكومي', 
    svg: '<path opacity="0.2" d="M2 10h20v11H2z" fill="currentColor"/><path d="M2 21h20M2 10h20M12 3L2 10h20L12 3zM5 10v11M9 10v11M13 10v11M17 10v11" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' 
  }
};

// أيقونة افتراضية إن لم تُحدَّد للكتاب أيقونة صراحة في books.json
function getBookIconSvg(iconKey) {
  const entry = BOOK_ICONS[iconKey] || BOOK_ICONS.scale;
  return entry.svg;
}

// تصدير للنافذة العامة لاستخدامها عبر الموديلات
if (typeof window !== 'undefined') {
  window.BOOK_THEMES = BOOK_THEMES;
  window.BOOK_THEME_LABELS = BOOK_THEME_LABELS;
  window.BOOK_ICONS = BOOK_ICONS;
  window.getBookTheme = getBookTheme;
  window.getBookIconSvg = getBookIconSvg;
}
