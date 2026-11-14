'use strict';

const statusMap = {
  REGULAR: 'Regulär',
  SUBSTITUTION: 'Vertretung',
  TEACHER_SWITCH: 'Lehrerwechsel',
  GRADE_MISSING: 'Klassenänderung',
  CANCLED: 'Entfall',
  CANCELLED: 'Entfall',
  CANCELED: 'Entfall',
  HOLIDAY: 'Ferien'
};

function simpleLesson(l) {
  const [year, month, day] = String(l.date || '').split('-');
  const rawHour = l.hour == null ? '' : String(l.hour).trim();
  const stunde = /^\d+$/.test(rawHour) ? Number(rawHour) : rawHour;
  return {
    datum: year && month && day ? `${day}.${month}.${year}` : '',
    stunde,
    beginn: l.startTime || '',
    ende: l.endTime || '',
    fach: l.subject || l.shortname || '',
    lehrer: Array.isArray(l.teachers) ? l.teachers.join(', ') : '',
    raum: Array.isArray(l.rooms) ? l.rooms.join(', ') : '',
    status: statusMap[l.kind] || l.kindDescription || l.kind || 'Unbekannt'
  };
}
function simpleLessons(lessons) {
  return lessons.map(simpleLesson);
}
module.exports = {simpleLesson, simpleLessons};
