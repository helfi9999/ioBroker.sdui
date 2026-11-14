'use strict';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
function renderTable(lessons, title = 'Stundenplan') {
  const css = `<style>.sdui-table{width:100%;border-collapse:collapse;font:14px Arial,sans-serif;color:inherit}.sdui-table th,.sdui-table td{padding:7px 9px;border-bottom:1px solid #aaa6;text-align:left;vertical-align:top}.sdui-table th{background:#8882}.sdui-table .sdui-substitution{background:#d69a001c}.sdui-table .sdui-cancelled{background:#d22a2a1b}.sdui-table .sdui-holiday{background:#2e8b5719}.sdui-table caption{font-weight:bold;text-align:left;padding:8px 0}.sdui-empty{font:14px Arial,sans-serif;padding:8px}</style>`;
  if (!lessons.length) return css + `<div class="sdui-empty">${escapeHtml(title)}: keine Einträge</div>`;
  const rows = lessons.map(l => {
    const kind = ['CANCLED', 'CANCELLED', 'CANCELED'].includes(l.kind) ? 'sdui-cancelled' :
      ['SUBSTITUTION', 'TEACHER_SWITCH', 'GRADE_MISSING'].includes(l.kind) ? 'sdui-substitution' :
      l.kind === 'HOLIDAY' ? 'sdui-holiday' : '';
    const subject = l.subject || l.shortname || '—';
    return `<tr class="${kind}"><td>${escapeHtml(l.date)}</td><td>${escapeHtml(l.hour)}</td><td>${escapeHtml(l.time)}</td><td>${escapeHtml(subject)}</td><td>${escapeHtml(l.teachers.join(', '))}</td><td>${escapeHtml(l.rooms.join(', '))}</td><td>${escapeHtml(l.kindDescription || l.kind)}</td><td>${escapeHtml(l.comment)}</td></tr>`;
  }).join('');
  return css + `<table class="sdui-table"><caption>${escapeHtml(title)}</caption><thead><tr><th>Datum</th><th>Std.</th><th>Uhrzeit</th><th>Fach</th><th>Lehrkraft</th><th>Raum</th><th>Status</th><th>Hinweis</th></tr></thead><tbody>${rows}</tbody></table>`;
}
const lessonFields = {
  date: ['Datum', 'string', 'text'],
  startTime: ['Beginn', 'string', 'text'],
  endTime: ['Ende', 'string', 'text'],
  time: ['Uhrzeit', 'string', 'text'],
  hour: ['Stunde', 'string', 'text'],
  subject: ['Fach', 'string', 'text'],
  teachers: ['Lehrkräfte', 'string', 'text'],
  rooms: ['Räume', 'string', 'text'],
  grades: ['Klassen', 'string', 'text'],
  kind: ['Statuscode', 'string', 'text'],
  kindDescription: ['Status', 'string', 'text'],
  comment: ['Hinweis', 'string', 'text']
};
function lessonStateValues(lesson) {
  return {
    date: lesson.date, startTime: lesson.startTime, endTime: lesson.endTime, time: lesson.time,
    hour: String(lesson.hour), subject: lesson.subject,
    teachers: lesson.teachers.join(', '), rooms: lesson.rooms.join(', '), grades: lesson.grades.join(', '),
    kind: lesson.kind, kindDescription: lesson.kindDescription || lesson.kind, comment: lesson.comment
  };
}
module.exports = {renderTable, lessonFields, lessonStateValues};
