'use strict';

const AnalyticsEvent = require('../models/AnalyticsEvent');
const Article = require('../models/Article');
const DailyStat = require('../models/DailyStat');
// Required for its side effect: populate('category') needs the model registered.
require('../models/Category');
const logger = require('../utils/logger');

/**
 * Days are the newsroom's days. Iraq has kept UTC+3 all year since it dropped
 * daylight saving in 2008, so the zone name (for Mongo's grouping) and the
 * fixed offset (for turning a day into an instant) always agree.
 */
const TZ = 'Asia/Baghdad';
const OFFSET = '+03:00';

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
const dayOf = (instant) => dayFormatter.format(instant); // YYYY-MM-DD
const today = () => dayOf(new Date());
const dayStart = (day) => new Date(`${day}T00:00:00${OFFSET}`);
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const VIEW = { eventType: 'article_view', article: { $ne: null } };
const DAY_EXPR = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: TZ } };

/**
 * Views per day per article, and distinct visitors per day, for [start, end).
 * Visitors are grouped twice rather than collected into one set per day, so a
 * busy day never builds an array of every visitor id in memory.
 */
const tally = async (start, end) => {
  const match = { ...VIEW, timestamp: { $gte: start, $lt: end } };
  const [views, visitors] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: { day: DAY_EXPR, article: '$article' }, views: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, sessionId: { $type: 'string' } } },
      { $group: { _id: { day: DAY_EXPR, visitor: '$sessionId' } } },
      { $group: { _id: '$_id.day', visitors: { $sum: 1 } } },
    ]),
  ]);

  const days = new Map();
  const dayEntry = (day) => {
    if (!days.has(day)) days.set(day, { views: 0, visitors: null, articles: [] });
    return days.get(day);
  };
  for (const row of views) {
    const entry = dayEntry(row._id.day);
    entry.views += row.views;
    entry.articles.push({ article: row._id.article, views: row.views });
  }
  for (const row of visitors) dayEntry(row._id).visitors = row.visitors;
  for (const entry of days.values()) entry.articles.sort((a, b) => b.views - a.views);
  return days;
};

/**
 * Write every finished day that has no record yet, up to yesterday.
 *
 * The first run has nothing to continue from, so it starts at the oldest event
 * still in the log — the day after it, in fact, because the 90-day expiry cuts
 * that oldest day part-way through and a short day would be stored as if it
 * were whole. Every day in the span gets a record, quiet ones as zero, so the
 * next run knows where to pick up and a gap in the chart is a real zero.
 */
const rollUp = async () => {
  const until = today();
  const last = await DailyStat.findOne().sort('-date').select('date').lean();

  let from;
  if (last) {
    from = addDays(last.date, 1);
  } else {
    const oldest = await AnalyticsEvent.findOne(VIEW).sort('timestamp').select('timestamp').lean();
    if (!oldest) return 0;
    from = addDays(dayOf(oldest.timestamp), 1);
  }
  if (from >= until) return 0;

  const days = await tally(dayStart(from), dayStart(until));
  const ops = [];
  for (let day = from; day < until; day = addDays(day, 1)) {
    const entry = days.get(day) || { views: 0, visitors: null, articles: [] };
    ops.push({ updateOne: { filter: { date: day }, update: { $set: entry }, upsert: true } });
  }
  await DailyStat.bulkWrite(ops, { ordered: false });
  logger.info(`📊 Daily stats: recorded ${ops.length} day(s), ${from} → ${addDays(until, -1)}`);
  return ops.length;
};

// One roll-up at a time: the hourly timer and a dashboard request can arrive together.
let rolling = null;
const ensureRolledUp = () => {
  rolling ??= rollUp()
    .catch((err) => logger.error(`Daily stats roll-up failed: ${err.message}`))
    .finally(() => { rolling = null; });
  return rolling;
};

/**
 * Close finished days on boot and then hourly. The dashboard closes them too
 * whenever it asks, but the raw log only lasts 90 days, so the history must not
 * depend on someone opening the dashboard.
 */
const startDailyRollup = () => {
  ensureRolledUp();
  setInterval(ensureRolledUp, 60 * 60 * 1000).unref();
};

const PRESETS = ['today', '7d', '30d', '90d', 'month', 'year', 'all'];

/** Resolve a preset or a custom pair into an inclusive [from, to] of days. */
const resolveRange = async ({ preset, from, to }) => {
  const now = today();
  switch (preset) {
    case 'today': return { from: now, to: now };
    case '7d': return { from: addDays(now, -6), to: now };
    case '30d': return { from: addDays(now, -29), to: now };
    case '90d': return { from: addDays(now, -89), to: now };
    case 'month': return { from: `${now.slice(0, 8)}01`, to: now };
    case 'year': return { from: `${now.slice(0, 5)}01-01`, to: now };
    case 'all': {
      const first = await DailyStat.findOne().sort('date').select('date').lean();
      return { from: first?.date || now, to: now };
    }
    default: {
      const end = to && to < now ? to : now;
      const start = from && from <= end ? from : end;
      return { from: start, to: end };
    }
  }
};

/**
 * Everything the dashboard shows for one period: totals, a day-by-day series,
 * the most-read articles and sections, and how far back the record goes.
 *
 * Finished days come from daily_stats; today, if it is in the period, is read
 * live from the event log, so the numbers move during the day.
 */
const getRange = async (params) => {
  await ensureRolledUp();
  const { from, to } = await resolveRange(params);
  const now = today();

  const [stored, first, firstWithVisitors, lifetime] = await Promise.all([
    DailyStat.find({ date: { $gte: from, $lte: to < now ? to : addDays(now, -1) } }).sort('date').lean(),
    DailyStat.findOne().sort('date').select('date').lean(),
    DailyStat.findOne({ visitors: { $ne: null } }).sort('date').select('date').lean(),
    Article.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: null, views: { $sum: '$views.total' } } },
    ]),
  ]);

  const days = new Map(stored.map((d) => [d.date, d]));
  if (from <= now && to >= now) {
    const live = await tally(dayStart(now), new Date());
    days.set(now, live.get(now) || { views: 0, visitors: null, articles: [] });
  }

  // The series starts where the record does; days before it were never kept.
  const since = first?.date || now;
  const series = [];
  for (let day = from > since ? from : since; day <= to; day = addDays(day, 1)) {
    const d = days.get(day);
    series.push({ date: day, views: d?.views || 0, visitors: d?.visitors ?? null });
  }

  const perArticle = new Map();
  for (const d of days.values()) {
    for (const { article, views } of d.articles) {
      const key = String(article);
      perArticle.set(key, (perArticle.get(key) || 0) + views);
    }
  }

  const ids = [...perArticle.keys()];
  const articles = ids.length
    ? await Article.find({ _id: { $in: ids } })
      .populate('category', 'name slug color')
      .select('title slug category')
      .lean()
    : [];

  const byCategory = new Map();
  for (const a of articles) {
    if (!a.category) continue;
    const key = String(a.category._id);
    const entry = byCategory.get(key) || { ...a.category, views: 0 };
    entry.views += perArticle.get(String(a._id)) || 0;
    byCategory.set(key, entry);
  }

  const views = series.reduce((sum, d) => sum + d.views, 0);
  const measured = series.filter((d) => d.visitors !== null);
  const peak = series.reduce((best, d) => (d.views > (best?.views ?? -1) ? d : best), null);
  const visitorsSince = firstWithVisitors?.date
    || ((days.get(now)?.visitors ?? null) !== null ? now : null);

  return {
    from,
    to,
    today: now,
    totals: {
      views,
      // Each visitor counted once per day they came, summed over the period.
      visitors: measured.length ? measured.reduce((sum, d) => sum + d.visitors, 0) : null,
      avgPerDay: series.length ? Math.round(views / series.length) : 0,
      peak: peak && peak.views > 0 ? { date: peak.date, views: peak.views } : null,
    },
    series,
    topArticles: articles
      .map((a) => ({ ...a, views: perArticle.get(String(a._id)) || 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    categories: [...byCategory.values()].sort((a, b) => b.views - a.views),
    history: {
      since,
      visitorsSince,
      lifetimeViews: lifetime[0]?.views || 0,
    },
  };
};

module.exports = { PRESETS, rollUp, ensureRolledUp, startDailyRollup, resolveRange, getRange, dayOf, addDays };
