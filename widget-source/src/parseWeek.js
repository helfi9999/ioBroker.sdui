export function unwrapStateValue(raw) {
  // VIS may expose values directly, as {val}, or as {state: {val}}.
  // Unwrap only recognized state wrappers, never arbitrary timetable objects.
  let value = raw;
  for (let i = 0; i < 3; i++) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !('tage' in value) && 'val' in value) {
      value = value.val;
    } else if (value && typeof value === 'object' && !Array.isArray(value) && 'state' in value && !('tage' in value)) {
      value = value.state;
    } else {
      break;
    }
  }
  return value;
}

export function parseWeek(raw) {
  try {
    const unwrapped = unwrapStateValue(raw);
    const value = typeof unwrapped === 'string' ? JSON.parse(unwrapped) : unwrapped;
    if (!value || !Array.isArray(value.tage) || !Array.isArray(value.zeilen) || value.tage.length !== 5) return null;
    if (!value.zeilen.every(row => row && Array.isArray(row.tage) && row.tage.length === 5 && row.tage.every(Array.isArray))) return null;
    return value;
  } catch { return null; }
}

export function colorForLesson(lesson, settings) {
  const typ = String(lesson?.typ || '').toUpperCase();
  if (['CANCLED', 'CANCELED', 'CANCELLED'].includes(typ)) return settings.cancelColor;
  if (typ === 'HOLIDAY') return settings.holidayColor;
  if (typ === 'SCHOOL_EVENT') return settings.schoolEventColor;
  const name = String(lesson?.fach || lesson?.kürzel || '').normalize('NFKC').trim().toLocaleLowerCase('de-DE');
  const colors = {
    mathematik: settings.mathColor, englisch: settings.englishColor,
    deutsch: settings.germanColor, sport: settings.sportColor,
    biologie: settings.bioColor, erdkunde: settings.geoColor,
    physik: settings.physicsColor, kunst: settings.artColor,
    wirtschaft: settings.economicsColor, klassenstunde: settings.classHourColor,
    klassenlehrerstunde: settings.classHourColor,
    chemie: settings.chemistryColor, geschichte: settings.historyColor,
    musik: settings.musicColor, informatik: settings.computingColor,
  };
  const key = Object.keys(colors).find(subject => name === subject || name.startsWith(subject + ' '));
  return (key && colors[key]) || settings.lessonColor;
}

export function formatRange(start, end) {
  if (!start && !end) return '';
  return [start, end].filter(Boolean).join('–');
}
