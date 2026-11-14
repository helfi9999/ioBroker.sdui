'use strict';

const TIME_ZONE = 'Europe/Berlin';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'});
const timeFormatter = new Intl.DateTimeFormat('de-DE', {timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
const pad = n => String(n).padStart(2, '0');
function localDate(d) {
  const parts = Object.fromEntries(dayFormatter.formatToParts(d).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function addDaysLocal(d, n) {
  const [y, m, day] = localDate(d).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day + n, 12));
}
function formatLesson(l) {
  const metadata = l.meta || {};
  const begin = Number(l.begins_at);
  const end = Number(l.ends_at);
  if (!Number.isFinite(begin) || !Number.isFinite(end)) return null;
  return {
    id: l.id,
    begins_at: begin,
    ends_at: end,
    date: localDate(new Date(begin * 1000)),
    startTime: timeFormatter.format(new Date(begin * 1000)),
    endTime: timeFormatter.format(new Date(end * 1000)),
    time: `${timeFormatter.format(new Date(begin * 1000))}–${timeFormatter.format(new Date(end * 1000))}`,
    hour: metadata.displayname_hour || '',
    subject: metadata.displayname || l.course?.subject?.name || '',
    shortname: metadata.shortname || '',
    kind: l.kind || 'REGULAR',
    kindDescription: metadata.displayname_kind || '',
    teachers: (l.teachers || []).map(x => x.shortcut || x.name).filter(Boolean),
    rooms: (l.bookables || []).map(x => x.shortcut || x.name).filter(Boolean),
    grades: (l.grades || []).map(x => x.shortcut || x.name).filter(Boolean),
    comment: l.comment || ''
  };
}
function transform(data, now = new Date()) {
  if (!data || !Array.isArray(data.lessons)) throw new Error('Unexpected Sdui response: data.lessons missing');
  const all = data.lessons.map(formatLesson).filter(Boolean).sort((a, b) => a.begins_at - b.begins_at || a.id - b.id);
  const today = localDate(now);
  const tomorrow = localDate(addDaysLocal(now, 1));
  const on = day => all.filter(l => l.date === day);
  const changes = l => ['SUBSTITUTION', 'TEACHER_SWITCH', 'GRADE_MISSING'].includes(l.kind);
  const canceled = l => ['CANCLED', 'CANCELLED', 'CANCELED'].includes(l.kind);
  return {
    all, today: on(today), tomorrow: on(tomorrow),
    substitutionsToday: on(today).filter(changes),
    substitutionsTomorrow: on(tomorrow).filter(changes),
    cancellationsToday: on(today).filter(canceled),
    cancellationsTomorrow: on(tomorrow).filter(canceled),
    holidays: all.filter(l => l.kind === 'HOLIDAY' && l.ends_at * 1000 >= now.getTime()),
    totalCount: all.length
  };
}
module.exports = {localDate, addDaysLocal, transform, formatLesson};
