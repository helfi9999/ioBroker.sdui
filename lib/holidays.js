'use strict';
const { localDate, addDaysLocal, formatLesson } = require('./transform');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const daysBetween = (a,b) => Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
function normalizeHolidays(payloads, now = new Date()) {
  const today = localDate(now);
  const days = new Map();
  const eventsByDate = new Map();
  const byDate = new Map();

  for (const payload of payloads) {
    if (!payload || !Array.isArray(payload.lessons)) {
      throw new Error('Invalid Sdui holidays response');
    }

    for (const raw of payload.lessons) {
      const lesson = formatLesson(raw);
      if (!lesson) continue;

      const date = lesson.date;

      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push({raw, lesson});

      if (raw.kind === 'HOLIDAY') {
        const label = (lesson.subject || 'Ferien').trim();
        if (!days.has(date)) days.set(date, {date, name:label});
      }
    }
  }

  const canceledKinds = ['CANCLED', 'CANCELLED', 'CANCELED'];

  // Schulinterne freie Tage aus Sdui-EVENTs erkennen.
  for (const [date, entries] of byDate) {
    if (days.has(date)) continue;

    const events = entries.filter(x => x.raw.kind === 'EVENT');
    const lessons = entries.filter(x =>
      x.raw.kind !== 'EVENT' && x.raw.kind !== 'HOLIDAY'
    );

    const canceled = lessons.filter(x =>
      canceledKinds.includes(String(x.raw.kind || '').toUpperCase())
    );

    // Nur übernehmen, wenn alle übermittelten Unterrichtseinträge entfallen.
    if (!events.length || !lessons.length || canceled.length !== lessons.length) {
      continue;
    }

    const first = Math.min(...canceled.map(x => Number(x.raw.begins_at)));
    const last = Math.max(...canceled.map(x => Number(x.raw.ends_at)));

    const event = events.find(x =>
      Number(x.raw.begins_at) <= first &&
      Number(x.raw.ends_at) >= last
    );

    if (!event) continue;

    const label = (
      event.lesson.subject ||
      event.raw.comment ||
      event.raw.meta?.displayname ||
      'Schulfrei'
    ).trim();

    eventsByDate.set(date, {date, name:label});
  }

  const events = [...eventsByDate.values()]
    .filter(day => day.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date));

  const upcoming = [...days.values()]
    .filter(day => day.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date));

  const periods = [];

  for (const day of upcoming) {
    const last = periods[periods.length-1];

    if (last && last.name === day.name &&
        daysBetween(last.end,day.date) <= 3) {
      last.end = day.date;
      last.schoolDays++;
    } else {
      periods.push({
        name:day.name,
        start:day.date,
        end:day.date,
        schoolDays:1
      });
    }
  }

  return {days:upcoming, periods, events};
}
function renderHolidayHtml(periods) {
  const format = s => s ? s.slice(8,10)+'.'+s.slice(5,7)+'.'+s.slice(0,4) : '–';
  const rows = periods.length ? periods.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(format(p.start))}</td><td>${escapeHtml(format(p.end))}</td></tr>`).join('') : '<tr><td colspan="3">Keine zukünftigen Ferien von Sdui übermittelt</td></tr>';
  return `<div class="sdui-holidays"><style>.sdui-holidays{font-family:Arial,sans-serif;color:#18232e}.sdui-holidays table{border-collapse:collapse;width:100%}.sdui-holidays th,.sdui-holidays td{padding:9px;border:1px solid #cbd5e1;text-align:left}.sdui-holidays th{background:#eef2f7}</style><table><thead><tr><th>Ferien</th><th>Beginn</th><th>Ende (letzter erfasster Ferientag)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
module.exports={normalizeHolidays,renderHolidayHtml,daysBetween};
