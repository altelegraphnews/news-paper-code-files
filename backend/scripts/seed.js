'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const config = require('../src/config/env');
const logger = require('../src/utils/logger');

// Models
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Article = require('../src/models/Article');
const Ticker = require('../src/models/Ticker');
const Comment = require('../src/models/Comment');

const { generateSlug } = require('../src/utils/slugGenerator');

const CATEGORIES = [
  { name: 'المدخل', nameEn: 'Editorial', slug: 'madkhal', color: '#1a2744', icon: '📰', order: 1, showInNav: true },
  { name: 'شعر', nameEn: 'Poetry', slug: 'shir', color: '#8e44ad', icon: '📜', order: 2, showInNav: true },
  { name: 'سرد', nameEn: 'Prose', slug: 'sard', color: '#2980b9', icon: '📖', order: 3, showInNav: true },
  { name: 'قراءات', nameEn: 'Reviews', slug: 'qiraat', color: '#27ae60', icon: '🔍', order: 4, showInNav: true },
  { name: 'فكر', nameEn: 'Thought', slug: 'fikr', color: '#c9a84c', icon: '💡', order: 5, showInNav: true },
  { name: 'حوار', nameEn: 'Interview', slug: 'hiwar', color: '#e74c3c', icon: '🎙️', order: 6, showInNav: true },
  { name: 'ترجمة', nameEn: 'Translation', slug: 'tarjama', color: '#16a085', icon: '🌐', order: 7, showInNav: true },
  { name: 'إصدارات', nameEn: 'Publications', slug: 'isdaraat', color: '#e67e22', icon: '📚', order: 8, showInNav: true },
];

const ARTICLE_TEMPLATES = [
  {
    titleTemplate: 'في مدخل القصيدة: عن اللغة والوجود',
    excerpt: 'مقالة افتتاحية تستكشف العلاقة بين اللغة الشعرية والتجربة الإنسانية، وكيف تفتح القصيدة أبواباً لم تكن لتُفتح بغيرها.',
    content: '<h2>في مدخل القصيدة</h2><p>حين نقف على عتبة القصيدة، لا نعرف يقيناً أين تنتهي اللغة وأين يبدأ الصمت. ثمة شيء في الكتابة الشعرية يشبه محاولة التقاط الهواء في راحة اليد.</p><p>المدخل إلى الشعر ليس باباً واحداً، بل أبواب متعددة، كل منها يفضي إلى فضاء مختلف من التأويل والدلالة.</p>',
    tags: ['شعر', 'لغة', 'أدب'],
    categoryKey: 'madkhal',
    isFeatured: true,
  },
  {
    titleTemplate: 'قصيدة النثر العربية: بين التجريب والأصالة',
    excerpt: 'دراسة في تطور قصيدة النثر في الأدب العربي الحديث، وجدلية العلاقة بين الشكل الجديد والموروث الشعري العريق.',
    content: '<h2>قصيدة النثر</h2><p>لا تزال قصيدة النثر تثير جدلاً نقدياً واسعاً في المشهد الأدبي العربي، بين من يرى فيها خيانة للموروث الشعري ومن يعدّها الشكل الأكثر قدرة على التعبير عن روح العصر.</p><blockquote>الشكل وعاء الروح، وقصيدة النثر وعاء جديد لروح قديمة</blockquote>',
    tags: ['شعر', 'نثر', 'نقد أدبي'],
    categoryKey: 'shir',
    isFeatured: true,
  },
  {
    titleTemplate: 'الرواية العربية الجديدة: أصوات تكسر القواعد',
    excerpt: 'جولة في الفضاء الروائي العربي الراهن، تتوقف عند تجارب روائية جديدة تجرؤ على مساءلة الأشكال الموروثة وابتكار فضاءات سردية غير مسبوقة.',
    content: '<h2>فضاءات السرد الجديدة</h2><p>شهد المشهد الروائي العربي في السنوات الأخيرة موجة من الأصوات الجريئة التي تكسر القواعد المألوفة، وتطرح أسئلة جوهرية حول الهوية والذاكرة والمكان.</p>',
    tags: ['رواية', 'سرد', 'أدب عربي'],
    categoryKey: 'sard',
    isFeatured: true,
  },
  {
    titleTemplate: 'قراءة في "حفريات" محمود درويش: الذاكرة مرآة للمنفى',
    excerpt: 'قراءة نقدية في ديوان "حفريات" للشاعر الفلسطيني محمود درويش، تتتبع مفهوم الذاكرة والمنفى في نسيج القصيدة.',
    content: '<h2>الذاكرة في شعر درويش</h2><p>يشكّل مفهوم الذاكرة عند درويش مرآة مركّبة تعكس صور المنفى والوطن في آنٍ واحد. في "حفريات" يذهب الشاعر إلى أعماق اللحظة الماضية باحثاً عن ما تبقى.</p>',
    tags: ['قراءة', 'درويش', 'شعر', 'نقد'],
    categoryKey: 'qiraat',
    isFeatured: false,
  },
  {
    titleTemplate: 'في معنى الحرية: مساءلة فلسفية',
    excerpt: 'مقالة فكرية تستعرض تحولات مفهوم الحرية في الفلسفة الغربية والعربية، من اليونان حتى اللحظة الراهنة.',
    content: '<h2>الحرية: من اليونان إلى اليوم</h2><p>لم يتوقف البشر عن سؤال الحرية منذ أن بدأوا يفكرون. غير أن هذا السؤال يتخذ في كل عصر ملامح جديدة تعكس هواجس ذلك العصر وإكراهاته.</p>',
    tags: ['فلسفة', 'حرية', 'فكر'],
    categoryKey: 'fikr',
    isFeatured: true,
  },
  {
    titleTemplate: 'حوار مع الكاتب أحمد الرشيد: الكتابة خلاصٌ من الصمت',
    excerpt: 'حوار معمّق مع الروائي والشاعر أحمد الرشيد حول مساره الأدبي وتجربته في الكتابة والنشر والعلاقة مع القارئ.',
    content: '<h2>الكتابة وجهاً لوجه</h2><p>التقينا بالكاتب أحمد الرشيد في مقهاه المفضل، فكان الحوار رحلة في دواخل الكلمة ووعورة الكتابة وبهجتها.</p>',
    tags: ['حوار', 'كاتب', 'أدب'],
    categoryKey: 'hiwar',
    isFeatured: false,
    isBreaking: false,
  },
  {
    titleTemplate: 'من بورخيس إلى العربية: ترجمة المتاهة',
    excerpt: 'مقالة تتأمل تحديات ترجمة أدب بورخيس إلى العربية، وكيف تعاملت الترجمات المختلفة مع عوالمه المتشابكة.',
    content: '<h2>بورخيس عربياً</h2><p>ترجمة بورخيس تحدٍّ مضاعف: فهو يكتب في لغة تعمل بآليات مغايرة للعربية، وموضوعاته تدور في فضاءات فلسفية ولغوية شديدة الكثافة.</p>',
    tags: ['ترجمة', 'بورخيس', 'أدب عالمي'],
    categoryKey: 'tarjama',
    isFeatured: false,
  },
  {
    titleTemplate: 'إصدارات جديدة: أعمال توقف عندها في موسم الخريف',
    excerpt: 'استعراض لأبرز الإصدارات الأدبية والفكرية الجديدة في موسم الخريف، مع تقديم موجز لكل إصدار.',
    content: '<h2>ما صدر حديثاً</h2><p>يزخر موسم الخريف عادةً بالإصدارات الأدبية والفكرية. نقدّم هنا توقفات موجزة عند بعض أبرز ما وصلنا.</p>',
    tags: ['إصدارات', 'كتب', 'أدب'],
    categoryKey: 'isdaraat',
    isFeatured: false,
  },
];

const TICKERS = [
  { text: 'عاجل: اجتماع طارئ لمجلس الأمن الدولي لمناقشة الأوضاع في المنطقة', isBreaking: true, order: 1 },
  { text: 'أسعار النفط ترتفع 3% في التعاملات المبكرة وسط مخاوف من اضطرابات الإمداد', isBreaking: false, order: 2 },
  { text: 'المنتخب العراقي يتأهل لنهائيات كأس آسيا بعد فوز مثير', isBreaking: false, order: 3 },
  { text: 'انطلاق مؤتمر المناخ العربي في الرياض بمشاركة 20 دولة', isBreaking: false, order: 4 },
];

const seed = async () => {
  try {
    logger.info('🌱 Starting database seed...');
    await mongoose.connect(config.mongodb.uri);
    logger.info('📦 Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Article.deleteMany({}),
      Ticker.deleteMany({}),
      Comment.deleteMany({}),
    ]);
    logger.info('🗑️  Cleared existing data');

    // Create users
    const superAdmin = await User.create({
      name: 'المدير الأعلى',
      email: config.seed.adminEmail,
      password: config.seed.adminPassword,
      role: 'super_admin',
      isActive: true,
      bio: 'مدير منصة الود الإخبارية',
    });

    const editor = await User.create({
      name: 'فاطمة الزهراء',
      email: 'editor@alwid.com',
      password: 'Editor@123',
      role: 'editor',
      isActive: true,
      bio: 'محررة أخبار السياسة والاقتصاد',
    });

    const author = await User.create({
      name: 'أحمد الرشيد',
      email: 'author@alwid.com',
      password: 'Author@123',
      role: 'author',
      isActive: true,
      bio: 'كاتب ومحلل متخصص في الشأن الثقافي والأدبي',
    });

    logger.info('👥 Users created');

    // Create categories
    const categoryMap = {};
    for (const cat of CATEGORIES) {
      const created = await Category.create({ ...cat, isActive: true });
      categoryMap[cat.slug] = created;
    }
    logger.info('📁 Categories created');

    // Create articles
    for (let i = 0; i < ARTICLE_TEMPLATES.length; i++) {
      const tmpl = ARTICLE_TEMPLATES[i];
      const cat = categoryMap[tmpl.categoryKey];
      const authorUser = i % 2 === 0 ? editor : author;

      await Article.create({
        title: tmpl.titleTemplate,
        slug: generateSlug(tmpl.titleTemplate),
        excerpt: tmpl.excerpt,
        content: tmpl.content,
        category: cat._id,
        author: authorUser._id,
        tags: tmpl.tags,
        status: 'published',
        publishedAt: new Date(Date.now() - i * 3 * 60 * 60 * 1000), // staggered publish times
        isFeatured: tmpl.isFeatured || false,
        isBreaking: tmpl.isBreaking || false,
        commentsEnabled: true,
        readingTimeMin: Math.ceil(tmpl.content.split(' ').length / 200),
        // Views start at zero — real counts come only from reader view beacons
        views: { total: 0, last24h: 0, last7d: 0 },
        ogImage: {
          url: `https://picsum.photos/seed/${i + 1}/800/450`,
          alt: tmpl.titleTemplate,
        },
        seo: {
          title: tmpl.titleTemplate + ' | الود',
          description: tmpl.excerpt,
          keywords: tmpl.tags,
        },
      });
    }

    // Create more articles to fill the feed
    const extraTitles = [
      'تحقيق: كيف تؤثر التغيرات المناخية على الإنتاج الزراعي في العالم العربي',
      'البنك المركزي العراقي يتخذ إجراءات جديدة لتعزيز قيمة الدينار',
      'لقاء حصري مع بطل العالم العربي في رياضة الفنون القتالية',
      'الفيلم العربي "المسافة" يحصد جوائز في مهرجانات دولية مرموقة',
      'دراسة: 60% من الشباب العربي يستخدمون الذكاء الاصطناعي في التعليم',
      'تقرير: ازدهار السياحة الداخلية في دول الخليج خلال الموسم الحالي',
      'الحكومة العراقية تعلن عن مشاريع بنية تحتية بمليارات الدولارات',
      'خبراء: أسواق الأسهم العربية تشهد تحولات هيكلية غير مسبوقة',
    ];

    const catKeys = Object.keys(categoryMap);
    for (let i = 0; i < extraTitles.length; i++) {
      const cat = categoryMap[catKeys[i % catKeys.length]];
      await Article.create({
        title: extraTitles[i],
        slug: generateSlug(extraTitles[i]) + '-' + i,
        excerpt: 'تابعونا لمزيد من التفاصيل حول هذا الخبر الهام الذي يؤثر على المشهد الإقليمي برمته.',
        content: `<p>${extraTitles[i]}</p><p>تفاصيل ومعلومات إضافية قيد الإعداد. يرجى متابعة موقع الود للأخبار العربية للاطلاع على آخر المستجدات.</p>`,
        category: cat._id,
        author: [editor._id, author._id][i % 2],
        tags: [catKeys[i % catKeys.length], 'أخبار'],
        status: 'published',
        publishedAt: new Date(Date.now() - (i + 10) * 2 * 60 * 60 * 1000),
        commentsEnabled: true,
        readingTimeMin: 2,
        views: { total: 0, last24h: 0, last7d: 0 },
        ogImage: { url: `https://picsum.photos/seed/${i + 50}/800/450`, alt: extraTitles[i] },
      });
    }

    logger.info('📰 Articles created');

    // Create tickers
    for (const t of TICKERS) {
      await Ticker.create({ ...t, isActive: true, createdBy: superAdmin._id });
    }
    logger.info('📢 Tickers created');

    logger.info('');
    logger.info('✅ Seed completed successfully!');
    logger.info('');
    logger.info('🔑 Admin credentials:');
    logger.info(`   Email: ${config.seed.adminEmail}`);
    logger.info(`   Password: ${config.seed.adminPassword}`);
    logger.info('');
    logger.info('👤 Editor credentials:');
    logger.info('   Email: editor@alwid.com');
    logger.info('   Password: Editor@123');
    logger.info('');
  } catch (err) {
    logger.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seed();
