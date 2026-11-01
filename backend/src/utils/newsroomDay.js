'use strict';

/**
 * The newsroom's day starts at midnight in Baghdad — not at midnight UTC,
 * which is 3 a.m. in Baghdad and where a server's own clock puts it. Every
 * count by day (the dashboard's cards and charts, the permanent daily record,
 * the page-view log) goes through here, so "today" covers the same hours
 * everywhere it is shown.
 *
 * Iraq has kept UTC+3 all year since it dropped daylight saving in 2008, so
 * the zone name (for Intl and Mongo's grouping) and the fixed offset (for
 * turning a day into an instant) always agree.
 */

const TZ = 'Asia/Baghdad';
const OFFSET = '+03:00';

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });

/** The Baghdad day an instant falls on, as YYYY-MM-DD. */
const dayOf = (instant) => dayFormatter.format(instant);

/** Today, in Baghdad. */
const today = () => dayOf(new Date());

/** The instant a Baghdad day begins (21:00 UTC the evening before). */
const dayStart = (day) => new Date(`${day}T00:00:00${OFFSET}`);

/** The day n days after (n < 0: before) a YYYY-MM-DD day. */
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The hour (0–23) an instant falls on, in Baghdad. */
const hourOf = (instant) => Number(hourFormatter.format(instant));

/** A Mongo expression for the Baghdad day of a date field, e.g. dayExpr('$timestamp'). */
const dayExpr = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

module.exports = { TZ, OFFSET, dayOf, today, dayStart, addDays, hourOf, dayExpr };
