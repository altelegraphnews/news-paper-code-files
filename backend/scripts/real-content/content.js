'use strict';

/*
 * Real editorial content for التلغراف — extracted from the Word documents and
 * photos under "مواد لموقع التلغراف". This module is the single source of truth
 * for both the Cloudinary upload step and the DB seed step.
 *
 *   AUTHORS  — writer/critic/journalist accounts (byline + bio + avatar image)
 *   IMAGES   — key -> absolute source path (uploaded to Cloudinary as public_id)
 *   ARTICLES — one entry per article: title, category, author, source text file,
 *              type (poem|prose|review|interview), hero image + inline figures.
 *   buildHtml(article, urlFor) — renders the article body HTML from its source
 *              text, injecting Cloudinary URLs for any inline figures.
 */

const fs = require('fs');
const path = require('path');

const MATERIALS_ROOT = 'C:/Users/aimen/Desktop/مواد لموقع التلغراف';
const SOURCES_DIR = path.join(__dirname, 'sources');

// ---------------------------------------------------------------------------
// Images: key -> source file. The key becomes the Cloudinary public_id suffix.
// ---------------------------------------------------------------------------
const IMAGES = {
  // Poetry — decorative surreal art used as hero banners
  'shir-ajyal-hero': 'شعر/48b28ad98c95e9fd064dff72dac58c66.jpg',
  'shir-masarrat-hero': 'شعر/7a67fff9-9e32-4257-b1d4-52de51d5b63d.png',
  'shir-raseef-hero': 'شعر/8c6a4351619b38ec60e0007bf5940c16.jpg',
  'shir-ghawayat-hero': 'شعر/a8dbae200253649616794685eb9dc769.jpg',
  'shir-qublat-hero': 'شعر/0fb8406d158d419f6f9be650b3e87be8.jpg',
  // Poets (avatars)
  'author-mahdi': 'شعر/مهدي القريشي.jfif',
  'author-jawad': 'شعر/جواد الشلال.jpg',
  'author-walaa': 'شعر/ولاء شهاب.jpg',
  'author-jabbar': 'شعر/جبار الكواز.jpg',
  // Prose writers (avatars + prose heroes)
  'author-shawqi': 'سرد/شوقي كريم حسن (6).jpg',
  'author-dawud': 'سرد/داود سلمان عجاج.jfif',
  'author-wilam': 'سرد/ولام العطار.jpg',
  'author-iyad': 'سرد/اياد خضير.jpg',
  // Reviews
  'author-ismailabd': 'قراءات/اسماعيل العبد/اسماعيل العبد.jpg',
  'author-dina': 'قراءات/دينا عبد الرحمن/دينا عبد الرحمن.jfif',
  'qiraat-mithaq-cover': 'قراءات/دينا عبد الرحمن/الغلاف.jfif',
  'qiraat-mithaq-haneen1': 'قراءات/دينا عبد الرحمن/حنين الصايغ (1).jpg',
  'qiraat-mithaq-haneen2': 'قراءات/دينا عبد الرحمن/حنين الصايغ (2).jpg',
  'author-qusay': 'قراءات/قصي المحمود/قصي المحمود.jfif',
  'qiraat-maarid-cover': 'قراءات/قصي المحمود/الغلاف.jfif',
  'qiraat-maarid-thaer': 'قراءات/قصي المحمود/ثائر ابراهيم.jfif',
  'author-khudair': 'قراءات/محمد خضير/محمد خضير.jpg',
  'qiraat-munhadar-painting': 'قراءات/محمد خضير/لوحة صادق الصائغ.jpg',
  'author-noori': 'قراءات/نوري اسماعيل/نوري اسماعيل.jpg',
  // Interviews
  'author-qadhafi': 'حوار/حوار القذافي/القذافي مسعود  (2).jpg',
  'hiwar-haddad-subject': 'حوار/حوار القذافي/حسام الحداد.jpg',
  'hiwar-haddad-book1': 'حوار/حوار القذافي/اغلفة كتب (1).jpg',
  'hiwar-haddad-book2': 'حوار/حوار القذافي/اغلفة كتب (2).jpg',
  'hiwar-haddad-book3': 'حوار/حوار القذافي/اغلفة كتب (3).jpg',
  'hiwar-haddad-book4': 'حوار/حوار القذافي/اغلفة كتب (4).jpg',
  'hiwar-haddad-book5': 'حوار/حوار القذافي/اغلفة كتب (5).jpg',
  'hiwar-haddad-book6': 'حوار/حوار القذافي/اغلفة كتب (6).jpg',
  'hiwar-haddad-book7': 'حوار/حوار القذافي/اغلفة كتب (7).jpg',
  'hiwar-haddad-book8': 'حوار/حوار القذافي/اغلفة كتب (8).jpg',
  'author-jamal': 'حوار/حوار محمد الكاظم/صورة جمال.jpeg',
  'hiwar-kadhim-subject': 'حوار/حوار محمد الكاظم/محمد الكاظم.jpg',
  'hiwar-kadhim-photo1': 'حوار/حوار محمد الكاظم/481464833_10237164442271178_2913275553272573588_n.jpg',
  'hiwar-kadhim-photo2': 'حوار/حوار محمد الكاظم/507984812_10238657115427074_9055415851258132483_n.jpg',
  'hiwar-kadhim-photo3': 'حوار/حوار محمد الكاظم/556401293_10240291088035368_7684541206902915189_n.jpg',
  'hiwar-kadhim-photo4': 'حوار/حوار محمد الكاظم/518381908_10239183915636750_5223001457914809145_n.jpg',
};

function imageAbsPath(key) {
  const rel = IMAGES[key];
  if (!rel) throw new Error(`Unknown image key: ${key}`);
  return path.join(MATERIALS_ROOT, rel);
}

// ---------------------------------------------------------------------------
// Authors (byline accounts)
// ---------------------------------------------------------------------------
const AUTHORS = {
  mahdi: { name: 'مهدي القريشي', bio: 'شاعر عراقي.', avatar: 'author-mahdi' },
  jawad: { name: 'جواد الشلال', bio: 'شاعر عراقي.', avatar: 'author-jawad' },
  walaa: { name: 'ولاء شهاب', bio: 'شاعرة عراقية.', avatar: 'author-walaa' },
  jabbar: { name: 'جبّار الكوّاز', bio: 'شاعر وكاتب عراقي.', avatar: 'author-jabbar' },
  shawqi: { name: 'شوقي كريم حسن', bio: 'قاص وكاتب عراقي.', avatar: 'author-shawqi' },
  dawud: { name: 'داود سلمان عجاج', bio: 'قاص عراقي.', avatar: 'author-dawud' },
  wilam: { name: 'ولام العطار', bio: 'قاصة عراقية.', avatar: 'author-wilam' },
  iyad: { name: 'اياد خضير', bio: 'قاص عراقي.', avatar: 'author-iyad' },
  ismailabd: { name: 'إسماعيل إبراهيم عبد', bio: 'ناقد وكاتب عراقي.', avatar: 'author-ismailabd' },
  dina: { name: 'د. دينا عبد الرحمن', bio: 'ناقدة وأكاديمية.', avatar: 'author-dina' },
  qusay: { name: 'قصي المحمود', bio: 'أديب وناقد عراقي.', avatar: 'author-qusay' },
  khudair: {
    name: 'محمد خضير',
    bio: 'قاص عراقي، من أبرز كتّاب القصة القصيرة في العراق، صاحب «المملكة السوداء» و«بصرياثا».',
    avatar: 'author-khudair',
  },
  noori: {
    name: 'إسماعيل نوري الربيعي',
    bio: 'كاتب وأكاديمي عراقي مهتم بالدراسات الثقافية والتاريخية.',
    avatar: 'author-noori',
  },
  qadhafi: { name: 'محمد القذافي مسعود', bio: 'كاتب وصحفي.', avatar: 'author-qadhafi' },
  jamal: { name: 'جمال الهنداوي', bio: 'كاتب وصحفي.', avatar: 'author-jamal' },
};

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------
const ARTICLES = [
  // ---- شعر (Poetry) ----
  {
    key: 'ajyal',
    source: '08__شعر__أجيال.txt',
    type: 'poem',
    category: 'shir',
    author: 'mahdi',
    title: 'أجيال',
    tags: ['شعر', 'قصيدة', 'أجيال', 'الشعر العراقي'],
    hero: 'shir-ajyal-hero',
    featured: true,
  },
  {
    key: 'masarrat',
    source: '09__شعر__اكتب المسرات على ورقة ناعمة وتطير مشبعة بالزعل.txt',
    type: 'poem',
    category: 'shir',
    author: 'jawad',
    title: 'اكتب المسرّات على ورقةٍ ناعمة وتطير مشبعةً بالزّعل',
    tags: ['شعر', 'قصيدة نثر', 'الشعر العراقي'],
    hero: 'shir-masarrat-hero',
  },
  {
    key: 'raseef',
    source: '10__شعر__على رصيفِ الانتظار.txt',
    type: 'poem',
    category: 'shir',
    author: 'walaa',
    title: 'على رصيفِ الانتظار',
    tags: ['شعر', 'قصيدة', 'الشعر العراقي'],
    hero: 'shir-raseef-hero',
  },
  {
    key: 'ghawayat',
    source: '11__شعر__مدوّنُ الغوايات.txt',
    type: 'poem',
    category: 'shir',
    author: 'jabbar',
    title: 'مدوّنُ الغوايات',
    tags: ['شعر', 'قصيدة', 'الشعر العراقي'],
    hero: 'shir-ghawayat-hero',
  },
  {
    key: 'qublat',
    source: '12__شعر__منذ أشهر اجهز لك قبلات واخبئها بصمت نادر.txt',
    type: 'poem',
    category: 'shir',
    author: 'jawad',
    title: 'منذ أشهرٍ أجهّز لكِ قبلاتٍ وأخبّئها بصمتٍ نادر',
    tags: ['شعر', 'قصيدة نثر', 'الشعر العراقي'],
    hero: 'shir-qublat-hero',
  },

  // ---- سرد (Prose) ----
  {
    key: 'amaar',
    source: '03__سرد__أعمار متأخرة.txt',
    type: 'prose',
    category: 'sard',
    author: 'shawqi',
    title: 'أعمار متأخرة',
    subtitle: 'مسرودة قصصية',
    tags: ['سرد', 'قصة قصيرة', 'القصة العراقية'],
    hero: 'author-shawqi',
  },
  {
    key: 'wilada',
    source: '04__سرد__الولادة.txt',
    type: 'prose',
    category: 'sard',
    author: 'dawud',
    title: 'الولادة',
    tags: ['سرد', 'قصة قصيرة', 'القصة العراقية'],
    hero: 'author-dawud',
  },
  {
    key: 'walad',
    source: '05__سرد__الولد الذي أضاء المدينة.txt',
    type: 'prose',
    category: 'sard',
    author: 'wilam',
    title: 'الولد الذي أضاء المدينة',
    subtitle: 'قصة قصيرة',
    tags: ['سرد', 'قصة قصيرة', 'القصة العراقية'],
    hero: 'author-wilam',
  },
  {
    key: 'khiyana',
    source: '06__سرد__خيانة.txt',
    type: 'prose',
    category: 'sard',
    author: 'iyad',
    title: 'خيانة',
    tags: ['سرد', 'قصة قصيرة', 'القصة العراقية'],
    hero: 'author-iyad',
  },
  {
    key: 'qaswa',
    source: '07__سرد__مواجهة القسوة.txt',
    type: 'prose',
    category: 'sard',
    author: 'iyad',
    title: 'مواجهة القسوة',
    tags: ['سرد', 'قصة قصيرة', 'القصة العراقية'],
    hero: 'author-iyad',
  },

  // ---- قراءات (Reviews) ----
  {
    key: 'qass',
    source: '13__قراءات__اسماعيل العبد__القص وسلطة الفهم.txt',
    type: 'review',
    category: 'qiraat',
    author: 'ismailabd',
    title: 'القصّ وسلطة الفهم',
    tags: ['قراءات', 'نقد أدبي', 'السرد', 'السيميائية'],
    hero: 'author-ismailabd',
  },
  {
    key: 'mithaq',
    source: '14__قراءات__دينا عبد الرحمن__ميثاق النساء.txt',
    type: 'review',
    category: 'qiraat',
    author: 'dina',
    title: '«ميثاق النساء» لحنين الصايغ',
    subtitle: 'سيرة الوجع الأنثوي بين سلطة الجماعة وحلم الحرية',
    tags: ['قراءات', 'نقد أدبي', 'الرواية', 'حنين الصايغ'],
    hero: 'qiraat-mithaq-cover',
    heroCaption: 'غلاف رواية «ميثاق النساء»',
    figures: {
      title: 'الروائية اللبنانية حنين الصايغ',
      layout: 'gallery',
      items: [{ key: 'qiraat-mithaq-haneen1' }, { key: 'qiraat-mithaq-haneen2' }],
    },
    featured: true,
  },
  {
    key: 'maarid',
    source: '15__قراءات__قصي المحمود__رؤى فنية في المجموعة القصصية.txt',
    type: 'review',
    category: 'qiraat',
    author: 'qusay',
    title: 'رؤى فنية في المجموعة القصصية «معرض استعادي»',
    subtitle: 'قراءة في المجموعة القصصية للقاص ثائر إبراهيم',
    tags: ['قراءات', 'نقد أدبي', 'القصة القصيرة', 'ثائر إبراهيم'],
    hero: 'qiraat-maarid-cover',
    heroCaption: 'غلاف المجموعة القصصية «معرض استعادي»',
    figures: {
      layout: 'single',
      items: [{ key: 'qiraat-maarid-thaer', caption: 'القاص ثائر إبراهيم' }],
    },
  },
  {
    key: 'munhadar',
    source: '16__قراءات__محمد خضير__على منحدر النهر.txt',
    type: 'review',
    category: 'qiraat',
    author: 'khudair',
    title: 'على منحدر النهر: سكيتش من أجل صادق الصائغ',
    tags: ['قراءات', 'سرد', 'صادق الصائغ', 'محمد خضير'],
    hero: 'qiraat-munhadar-painting',
    heroCaption: 'لوحة للشاعر صادق الصائغ',
  },
  {
    key: 'insan',
    source: '17__قراءات__نوري اسماعيل__حين يصنع النص الإنسان.txt',
    type: 'review',
    category: 'qiraat',
    author: 'noori',
    title: 'حين يصنع النصّ الإنسان',
    subtitle: 'كيف يتحوّل النص المؤسِّس إلى بنية ذهنية تُعيد إنتاج الشخصية عبر التاريخ؟',
    tags: ['قراءات', 'نقد ثقافي', 'ملحمة كلكامش', 'الأدب العراقي'],
    hero: 'author-noori',
  },

  // ---- حوار (Interviews) ----
  {
    key: 'haddad',
    source: '01__حوار__حوار القذافي__الكاتب والباحث المصري حسام الحداد.txt',
    type: 'interview',
    category: 'hiwar',
    author: 'qadhafi',
    title:
      'الكاتب والباحث المصري حسام الحداد: بقاء أيّ مجتمع مرتبط بقدرته على إنتاج عقولٍ تفكّر لا عقولٍ تكرّر',
    subtitle: 'يرى أنّ التعليم في العالم العربي يحتاج إلى إرادةٍ سياسيةٍ واضحة',
    tags: ['حوار', 'الإسلام السياسي', 'الإرهاب', 'التعليم', 'حسام الحداد'],
    hero: 'hiwar-haddad-subject',
    heroCaption: 'الكاتب والباحث المصري حسام الحداد',
    pullQuotes: [
      'الإرهاب لم يعد مجرّد ظاهرة أمنية بل نتيجة مركّبة لأزماتٍ سياسية واجتماعية ودينية ممتدّة',
      'بقاء أيّ مجتمع اليوم مرتبطٌ مباشرةً بقدرته على إنتاج عقولٍ تفكّر لا عقولٍ تكرّر',
    ],
    figures: {
      title: 'من مؤلّفات حسام الحداد',
      layout: 'gallery',
      items: [
        { key: 'hiwar-haddad-book1' },
        { key: 'hiwar-haddad-book2' },
        { key: 'hiwar-haddad-book3' },
        { key: 'hiwar-haddad-book4' },
        { key: 'hiwar-haddad-book5' },
        { key: 'hiwar-haddad-book6' },
        { key: 'hiwar-haddad-book7' },
        { key: 'hiwar-haddad-book8' },
      ],
    },
    featured: true,
  },
  {
    key: 'kadhim',
    source: '02__حوار__حوار محمد الكاظم__عناوين مقترحة.txt',
    type: 'interview',
    category: 'hiwar',
    author: 'jamal',
    title: 'الكاتب محمد الكاظم: أنا تلميذٌ نجيبٌ لكلّ مدارس السرد العظيمة التي سبقتني',
    subtitle: 'يبحث عن الخصوصية ومتمرّدٌ على تقاليد النصّ الأدبي',
    tags: ['حوار', 'القصة القصيرة', 'السرد', 'الأدب العراقي', 'محمد الكاظم'],
    hero: 'hiwar-kadhim-subject',
    heroCaption: 'القاص والكاتب محمد الكاظم',
    pullQuotes: [
      'أنْ تكون عراقياً يعني أن تكون كائناً احتجاجياً',
      'غادرتُ مرحلة البوح الفردي بعد انقضاء مرحلة البدايات',
      'الأمل في وقتنا هذا يمثّل التزاماً أخلاقياً تجاه المجتمع كي لا تنهار أرواح البشر',
    ],
    figures: {
      title: 'الكاتب محمد الكاظم في صور',
      layout: 'gallery',
      items: [
        { key: 'hiwar-kadhim-photo1' },
        { key: 'hiwar-kadhim-photo2' },
        { key: 'hiwar-kadhim-photo3' },
        { key: 'hiwar-kadhim-photo4' },
      ],
    },
    featured: true,
  },
];

// ---------------------------------------------------------------------------
// Text -> HTML helpers
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// strip bidi control marks / BOM / nbsp, trim trailing space
function cleanLine(s) {
  return String(s)
    .replace(/[‎‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+$/g, '');
}

// normalize for header matching (drop tashkeel, punctuation, spaces, unify letters)
function norm(s) {
  return String(s)
    .replace(/[ـً-ٰٟ]/g, '')
    .replace(/[‎‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[«»"'()[\].,!؟:\-–—\s]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function readLines(sourceFile) {
  const raw = fs.readFileSync(path.join(SOURCES_DIR, sourceFile), 'utf8').replace(/^﻿/, '');
  return raw.split(/\r?\n/).map(cleanLine);
}

function isSep(line) {
  const t = line.trim();
  return t.length > 0 && /^[*٭•●◆]+$/.test(t);
}

function isBlank(line) {
  return line.trim() === '';
}

// remove leading header lines (title/subtitle/author/pure punctuation/blank)
function stripHeader(lines, headers) {
  const H = headers.filter(Boolean).map(norm);
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '') { i++; continue; }
    const n = norm(t);
    const isPunct = n === '';
    const matches = H.some((h) => h && (h.includes(n) || n.includes(h)) && n.length >= 3);
    if (isPunct || matches) { i++; continue; }
    break;
  }
  return lines.slice(i);
}

function figureHtml(url, alt, caption) {
  const cap = caption ? `<figcaption>${esc(caption)}</figcaption>` : '';
  return `<figure><img src="${url}" alt="${esc(alt || caption || '')}" loading="lazy" />${cap}</figure>`;
}

// Render an article's related-image set: a responsive .content-gallery grid for
// multiple pictures (book covers, interview photos), or a single centered figure.
function renderFiguresBlock(article, urlFor) {
  const f = article.figures;
  if (!f || !f.items || !f.items.length) return '';
  if (f.layout === 'gallery') {
    const heading = f.title ? `<h3>${esc(f.title)}</h3>` : '';
    const figs = f.items
      .map((it) => figureHtml(urlFor(it.key), it.caption || f.title || article.title, it.caption))
      .join('');
    return `${heading}<div class="content-gallery">${figs}</div>`;
  }
  return f.items.map((it) => figureHtml(urlFor(it.key), it.caption, it.caption)).join('\n');
}

function placeFiguresBlock(blocks, block, placement, introCount) {
  if (!block) return blocks.join('\n');
  const copy = blocks.slice();
  if (placement === 'afterLead') copy.splice(Math.min(introCount || 1, copy.length), 0, block);
  else copy.push(block); // 'end' (default)
  return copy.join('\n');
}

// evenly splice figures between top-level blocks (never before the first block)
function injectFigures(blocks, figures) {
  if (!figures || !figures.length) return blocks.join('\n');
  const out = blocks.slice();
  const step = Math.max(1, Math.floor(out.length / (figures.length + 1)));
  let inserted = 0;
  figures.forEach((fig, idx) => {
    let pos = Math.min(out.length, (idx + 1) * step + inserted);
    if (pos < 1) pos = 1;
    out.splice(pos, 0, fig);
    inserted++;
  });
  return out.join('\n');
}

// ---- per-type builders -----------------------------------------------------

function buildPoem(article, urlFor) {
  const lines = stripHeader(readLines(article.source), [
    article.title,
    article.subtitle,
    AUTHORS[article.author].name,
  ]);
  const blocks = [];
  let stanza = [];
  const flush = () => {
    if (stanza.length) {
      blocks.push(`<p>${stanza.map(esc).join('<br />')}</p>`);
      stanza = [];
    }
  };
  for (const line of lines) {
    if (isBlank(line)) { flush(); continue; }
    if (isSep(line)) { flush(); blocks.push('<hr />'); continue; }
    stanza.push(line.trim());
  }
  flush();
  // collapse consecutive <hr />
  const cleaned = [];
  for (const b of blocks) {
    if (b === '<hr />' && cleaned[cleaned.length - 1] === '<hr />') continue;
    cleaned.push(b);
  }
  while (cleaned.length && cleaned[0] === '<hr />') cleaned.shift();
  while (cleaned.length && cleaned[cleaned.length - 1] === '<hr />') cleaned.pop();
  return cleaned.join('\n');
}

function buildProse(article, urlFor) {
  let lines = stripHeader(readLines(article.source), [
    article.title,
    article.subtitle,
    AUTHORS[article.author].name,
  ]);
  const blocks = [];
  let i = 0;
  // leading parenthetical epigraph(s) -> blockquote
  const epi = [];
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '') { i++; continue; }
    if (t.startsWith('(') && t.length < 160) { epi.push(t.replace(/^\(|\)$/g, '').trim()); i++; continue; }
    break;
  }
  if (epi.length) blocks.push(`<blockquote>${epi.map(esc).join('<br />')}</blockquote>`);
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '') continue;
    blocks.push(`<p>${esc(t)}</p>`);
  }
  return placeFiguresBlock(blocks, renderFiguresBlock(article, urlFor), article.figures?.placement || 'end');
}

function buildReview(article, urlFor) {
  const lines = stripHeader(readLines(article.source), [
    article.title,
    article.subtitle,
    AUTHORS[article.author].name,
    'ميثاق النساء لحنين الصايغ',
    'في المجموعة القصصية معرض استعادي للقاص ثائر ابراهيم',
    'على منحدر النهر',
    'سكيتش من أجل صادق الصائغ',
    'كيف يتحول النص المؤسس إلى بنية ذهنية تعيد إنتاج الشخصية عبر التاريخ',
  ]);
  const blocks = [];
  let inSources = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === '') continue;
    if (/^المصادر$/.test(t)) { inSources = true; blocks.push('<hr />'); blocks.push('<h3>المصادر</h3>'); continue; }
    if (inSources) {
      blocks.push(`<p class="ref">${esc(t.replace(/^\d+\s*[ـ\-]\s*/, ''))}</p>`);
      continue;
    }
    // short "heading:" lines (المتن: / الخلاصة:)
    if (/[:：]$/.test(t) && t.length <= 16) {
      blocks.push(`<h3>${esc(t.replace(/[:：]$/, ''))}</h3>`);
      continue;
    }
    // trailing footnote line about the painting
    if (t.startsWith('*') && t.length < 80) {
      blocks.push(`<p class="note">${esc(t.replace(/^\*+\s*/, ''))}</p>`);
      continue;
    }
    blocks.push(`<p>${esc(t)}</p>`);
  }
  return placeFiguresBlock(blocks, renderFiguresBlock(article, urlFor), article.figures?.placement || 'end');
}

function buildInterview(article, urlFor) {
  const lines = readLines(article.source);
  const firstQ = lines.findIndex((l) => l.trim().startsWith('*'));
  const preLines = firstQ === -1 ? lines : lines.slice(0, firstQ);
  const qaLines = firstQ === -1 ? [] : lines.slice(firstQ);

  const blocks = [];
  // lead = the longest paragraph in the pre-section (the bio intro)
  let lead = '';
  for (const l of preLines) {
    const t = l.trim();
    if (t.length > lead.length && !t.startsWith('*') && norm(t) !== norm(article.title)) lead = t;
  }
  if (lead) blocks.push(`<p>${esc(lead)}</p>`);
  if (article.pullQuotes && article.pullQuotes.length) {
    blocks.push(`<blockquote>${article.pullQuotes.map(esc).join('<br />')}</blockquote>`);
  }
  const introCount = blocks.length; // gallery slots in right after the intro/pull-quotes
  // Q/A
  for (const l of qaLines) {
    const t = l.trim();
    if (t === '') continue;
    if (t.startsWith('*')) {
      const q = t.replace(/^\*+\s*/, '').trim();
      if (q) blocks.push(`<p><strong>${esc(q)}</strong></p>`);
    } else {
      const a = t.replace(/^[ـ\-–—]\s*/, '').trim();
      if (a) blocks.push(`<p>${esc(a)}</p>`);
    }
  }
  return placeFiguresBlock(blocks, renderFiguresBlock(article, urlFor), article.figures?.placement || 'afterLead', introCount);
}

function buildHtml(article, urlFor) {
  switch (article.type) {
    case 'poem': return buildPoem(article, urlFor);
    case 'prose': return buildProse(article, urlFor);
    case 'review': return buildReview(article, urlFor);
    case 'interview': return buildInterview(article, urlFor);
    default: throw new Error(`Unknown article type: ${article.type}`);
  }
}

module.exports = { IMAGES, imageAbsPath, AUTHORS, ARTICLES, buildHtml, MATERIALS_ROOT };
