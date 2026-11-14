import React from 'react';
import { colorForLesson, parseWeek, formatRange } from './parseWeek.js';

const colors = [
  ['monBg', 'Montag: Hintergrund', '#3c526c'],
  ['monFg', 'Montag: Schrift', '#ffffff'],
  ['tueBg', 'Dienstag: Hintergrund', '#3c526c'],
  ['tueFg', 'Dienstag: Schrift', '#ffffff'],
  ['wedBg', 'Mittwoch: Hintergrund', '#3c526c'],
  ['wedFg', 'Mittwoch: Schrift', '#ffffff'],
  ['thuBg', 'Donnerstag: Hintergrund', '#3c526c'],
  ['thuFg', 'Donnerstag: Schrift', '#ffffff'],
  ['friBg', 'Freitag: Hintergrund', '#3c526c'],
  ['friFg', 'Freitag: Schrift', '#ffffff'],
  ['stdHeadBg', 'Std.-Überschrift: Hintergrund', '#28384e'],
  ['stdHeadFg', 'Std.-Überschrift: Schrift', '#ffffff'],
  ['periodBg', 'Stunden/Uhrzeiten: Hintergrund', '#dbe4ed'],
  ['periodColor', 'Stunden/Uhrzeiten: Schrift', '#25394f'],
  ['navBg', 'Navigationsleiste: Hintergrund', '#323c50'],
  ['navFg', 'Navigationsleiste: Schrift', '#ffffff'],
  ['emptyColor', 'Leere Zellen', '#f3f5f8'],
  ['textColor', 'Fach: Schriftfarbe', '#182635'],
  ['lineColor', 'Linienfarbe', '#ffffff'],
  ['lessonColor', 'Andere Fächer', '#d9e8f4'],
  ['mathColor', 'Mathematik', '#b9d9ee'],
  ['englishColor', 'Englisch', '#b9e0d8'],
  ['germanColor', 'Deutsch', '#ded1eb'],
  ['sportColor', 'Sport', '#b9d9ee'],
  ['bioColor', 'Biologie', '#ccd4f2'],
  ['geoColor', 'Erdkunde', '#b9e0d8'],
  ['physicsColor', 'Physik', '#b9e0d8'],
  ['artColor', 'Kunst', '#ddd0f0'],
  ['economicsColor', 'Wirtschaft', '#f3b7d2'],
  ['classHourColor', 'Klassenstunde', '#f4cfb6'],
  ['chemistryColor', 'Chemie', '#cfece7'],
  ['historyColor', 'Geschichte', '#f7e6bd'],
  ['musicColor', 'Musik', '#e5dff5'],
  ['computingColor', 'Informatik', '#d9e3f7'],
  ['holidayColor', 'Ferien', '#e3e9f2'],
  ['schoolEventColor', 'Schulveranstaltung', '#cfece7'],
  ['cancelColor', 'Ausfall', '#ffd7d7'],
  ['cancelDiagonalColor', 'Ausfall: Diagonale Farbe', '#cf4040'],
  ['subBorder', 'Vertretung: Rahmen', '#d58a16'],
];
const dimensions = [
  ['fontSize', 'Grundschriftgröße', 14, 9, 26],
  ['dayFontSize', 'Wochentage Schriftgröße', 15, 9, 26],
  ['stdFontSize', 'Stundenzahlen Schriftgröße', 14, 9, 26],
  ['timeFontSize', 'Uhrzeiten Schriftgröße', 11, 8, 22],
  ['subjectFont', 'Fach-Schriftgröße', 14, 9, 26],
  ['detailFont', 'Details-Schriftgröße', 11, 8, 22],
  ['rowHeight', 'Stundenhöhe (px)', 96, 38, 250],
  ['periodWidth', 'Stundenspalte (px)', 70, 36, 170],
  ['borderWidth', 'Rahmenstärke (px)', 2, 0, 8],
  ['subBorderWidth', 'Vertretung: Rahmenstärke (px)', 2, 0, 8],
  ['teacherBorderWidth', 'Lehrerwechsel: Rahmenstärke (px)', 2, 0, 8],
  ['cancelBorderWidth', 'Ausfall: Rahmenstärke (px)', 2, 0, 8],
  ['cancelDiagonalWidth', 'Ausfall: Diagonale Stärke (px)', 3, 0, 8],
  ['radius', 'Eckenradius (px)', 3, 0, 30],
];
const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri'];
const fontOptions = ['Arial', 'Verdana', 'Tahoma', 'Georgia', 'Trebuchet MS', 'Courier New', 'Ubuntu', 'Ubuntu-Light', 'Ubuntu-Regular', 'Ubuntu-Medium', 'Ubuntu-Bold', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];
const fontFields = [
  ['dayFontName', 'Schriftart Wochentage'],
  ['stdFontName', 'Schriftart Stundennummern'],
  ['timeFontName', 'Schriftart Uhrzeiten'],
  ['lessonFontName', 'Schriftart Unterricht'],
];
const safeFont = (font) => fontOptions.includes(font) ? font : 'Arial';
const validColor = (input, fallback) => {
  const value = String(input || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  const match = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/i);
  if (!match) return fallback;
  const rgb = match.slice(1, 4).map(Number);
  if (rgb.some(n => n > 255)) return fallback;
  if (value.toLowerCase().startsWith('rgba(') && match[4] === undefined) return fallback;
  return value;
};

export default class SduiWeekWidget extends window.visRxWidget {
  static getWidgetInfo() {
    return {
      id: 'tplSduiInventwoWeek',
      visPrev: 'widgets/vis-2-widgets-sdui/sdui-week-preview.svg',
      visSet: 'sdui',
      visSetLabel: 'SDUI Widgets',
      visSetColor: '#62788e',
      visName: 'Stundenplan (inventwo-Stil)',
      visAttrs: [
        { name: 'common', fields: [
          { name: 'oid', label: 'JSON-Datenpunkt', type: 'id', default: 'sdui.0.timetable.weekGrid.json' },
          { name: 'lastUpdateOid', label: 'Letzte Aktualisierung' , type: 'id', default: 'sdui.0.info.lastUpdate' },
          { name: 'weeksOid', label: 'Wochen-Navigation JSON', type: 'id', default: 'sdui.0.timetable.weekGrid.weeks.json' },
          { name: 'showWeekNavigation', label: 'Wochen-Navigation anzeigen', type: 'checkbox', default: true },
          { name: 'showTimes', label: 'Unterrichtszeiten anzeigen', type: 'checkbox', default: true },
          { name: 'showTeacher', label: 'Lehrer anzeigen', type: 'checkbox', default: true },
          { name: 'showRoom', label: 'Raum anzeigen', type: 'checkbox', default: true },
          { name: 'showDate', label: 'Datum anzeigen', type: 'checkbox', default: true },
          { name: 'showStatus', label: 'Vertretung/Ausfall-Status anzeigen', type: 'checkbox', default: true },
        ] },
        { name: 'Schrift und Abstände', fields: [
          ...fontFields.map(([name, label]) => ({ name, label, type: 'select', options: fontOptions.map(value => ({ value, label: value })), default: 'Arial' })),
          ...dimensions.map(([name, label, value, min, max]) => ({ name, label, type: 'number', default: value, min, max })),
        ] },
        { name: 'Wochentage: Farben', fields: colors.filter(([name]) => /^(mon|tue|wed|thu|fri)(Bg|Fg)$/.test(name)).map(([name, label, value]) => ({
  name, label, type: 'color', default: value
})) },
        { name: 'Stunden und Uhrzeiten: Farben', fields: colors.filter(([name]) => ['stdHeadBg','stdHeadFg','periodBg','periodColor'].includes(name)).map(([name, label, value]) => ({
  name, label, type: 'color', default: value
})) },
        { name: 'Weitere Farben', fields: colors.filter(([name]) => !/^(mon|tue|wed|thu|fri)(Bg|Fg)$/.test(name) && !['stdHeadBg','stdHeadFg','periodBg','periodColor'].includes(name)).map(([name, label, value]) => ({
  name, label, type: 'color', default: value
})) },
        { name: 'Wochentage', fields: labels.map((label, i) => ({
          name: `label${i}`, label: `Beschriftung ${label}`, type: 'text', default: label,
        })).concat([{ name: 'periodLabel', label: 'Stundenspalte', type: 'text', default: 'Std.' }]) },
      ],
      visDefaultStyle: { width: 980, height: 700 },
    };
  }

  getWidgetInfo() { return SduiWeekWidget.getWidgetInfo(); }
  static getI18nPrefix() { return ''; }
  // The oid field is registered as a VIS state selector, so VIS subscribes automatically.
  onRxDataChanged() {}
  onStateUpdated() {}
  renderWidgetBody(props) {
    super.renderWidgetBody(props);
    const settings = this.state.rxData || {};
    const stateId = settings.oid || 'sdui.0.timetable.weekGrid.json';
    const values = this.state.values || {};
    const lastUpdateId = settings.lastUpdateOid || "sdui.0.info.lastUpdate";
    const lastUpdateRaw = values[`${lastUpdateId}.val`] ?? values[lastUpdateId] ?? this.state[lastUpdateId];
    const lastUpdateValue = lastUpdateRaw && typeof lastUpdateRaw === "object" ? lastUpdateRaw.val : lastUpdateRaw;
    const lastUpdateDate = lastUpdateValue ? new Date(lastUpdateValue) : null;
    const lastUpdateText = lastUpdateDate && !Number.isNaN(lastUpdateDate.getTime()) ? lastUpdateDate.toLocaleTimeString("de-DE", {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin"}) : "";
    const raw = values[`${stateId}.val`] ?? values[stateId] ?? this.state[stateId];
    const weeksId = settings.weeksOid || 'sdui.0.timetable.weekGrid.weeks.json';
    const weeksRaw = values[`${weeksId}.val`] ?? values[weeksId] ?? this.state[weeksId];
    let weekEntries = [];
    try {
      const parsed = typeof weeksRaw === 'string' ? JSON.parse(weeksRaw) : weeksRaw?.val !== undefined ? JSON.parse(weeksRaw.val) : weeksRaw;
      if (Array.isArray(parsed?.weeks)) {
        weekEntries = parsed.weeks.filter(w => Number.isInteger(w?.offset) && parseWeek(w.grid));
      }
    } catch (_) { /* Fallback to the current week. */ }
    const offset = Number(this.state.sduiWeekOffset) || 0;
    const current = weekEntries.find(w => w.offset === offset);
    const week = current ? parseWeek(current.grid) : (weekEntries.length ? null : parseWeek(raw));
    const weekPosition = weekEntries.findIndex(w => w.offset === offset);
    const navigate = (direction) => {
      if (weekPosition < 0) return;
      const next = weekEntries[weekPosition + direction];
      if (next) { console.log('Sdui Wochenwechsel:', offset, '->', next.offset); this.setState({sduiWeekOffset: next.offset}); }
    };
    const val = (name, fallback) => settings[name] ?? fallback;
    const getColor = (name) => validColor(settings[name], colors.find(c => c[0] === name)?.[2] || '#ffffff');
    const fontSize = Math.max(9, Math.min(26, Number(val('fontSize', 14)) || 14));
    const rowHeight = Math.max(38, Math.min(250, Number(val('rowHeight', 96)) || 96));
    const periodWidth = Math.max(36, Math.min(170, Number(val('periodWidth', 70)) || 70));
    const borderWidth = Math.max(0, Math.min(8, Number(val('borderWidth', 2)) || 0));
    const radius = Math.max(0, Math.min(30, Number(val('radius', 3)) || 0));
    const border = `${borderWidth}px solid ${getColor('lineColor')}`;
    const borderCell = { border, boxSizing: 'border-box' };
    const font = { fontFamily: safeFont(val('lessonFontName', 'Arial')), fontSize, color: getColor('textColor') };
    const dayFont = safeFont(val('dayFontName', 'Arial'));
    const stdFont = safeFont(val('stdFontName', 'Arial'));
    const timeFont = safeFont(val('timeFontName', 'Arial'));
    const daySize = Number(val('dayFontSize', 15));
    const stdSize = Number(val('stdFontSize', 14));
    const timeSize = Number(val('timeFontSize', 11));
    const headers = Array.from({ length: 5 }, (_, i) => week?.tage?.[i] || {});
    return <div style={{ width: '100%', height: '100%', overflow: 'auto', ...font }}>
      {val('showWeekNavigation', true) && <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:8, background:getColor('navBg'), color:getColor('navFg'), fontFamily:dayFont}}>
        <button type="button" disabled={weekPosition <= 0} onClick={() => navigate(-1)} style={{cursor:'pointer', padding:'5px 12px'}} aria-label="Vorherige Woche">❮</button>
        <span style={{textAlign:'center'}}>{week ? `${week.von || ''} – ${week.bis || ''}` : 'Keine Daten für diese Woche'} · {weekEntries.length} Wochen</span>
        <div style={{display:'flex', alignItems:'center', gap:5}}>
          <button type="button" disabled={offset === 0 || !weekEntries.some(w => w.offset === 0)} onClick={() => this.setState({sduiWeekOffset:0})} style={{cursor:'pointer', padding:'5px 8px'}}>Heute</button>
          <button type="button" disabled={weekPosition < 0 || weekPosition >= weekEntries.length-1} onClick={() => navigate(1)} style={{cursor:'pointer', padding:'5px 12px'}} aria-label="Nächste Woche">❯</button>
          {lastUpdateText && <span style={{fontSize:12, whiteSpace:"nowrap"}} title="Letzte erfolgreiche Sdui-Aktualisierung">✓ Aktualisiert um {lastUpdateText}</span>}
          <button type="button" onClick={() => this.props.context.socket.setState("sdui.0.control.refresh", {val: true, ack: false}).catch(err => console.error("Sdui-Aktualisierung fehlgeschlagen:", err))} style={{cursor:"pointer", padding:"5px 10px"}} title="Stundenplan jetzt von Sdui abrufen">↻ Aktualisieren</button>
        </div>
      </div>}
      {!week ? <div style={{ padding: 16 }}>Kein gültiger Sdui-Wochenplan gefunden. Datenpunkt unter „JSON-Datenpunkt“ wählen.</div> :
        <table style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 600 }}>
          <colgroup><col style={{ width: periodWidth }} />{labels.map((_, i) => <col key={i} />)}</colgroup>
          <thead><tr>
            {[{ date: '', label: val('periodLabel', 'Std.') }, ...headers.map((day, i) => ({
              date: val('showDate', true) && /^\d{4}-\d{2}-\d{2}$/.test(day.date || '') ? (day.date || '').slice(8, 10) + '.' : '',
              label: val(`label${i}`, labels[i]),
            }))].map((day, i) => <th key={i} style={{ ...borderCell, background: getColor(i === 0 ? 'stdHeadBg' : `${dayKeys[i - 1]}Bg`), color: getColor(i === 0 ? 'stdHeadFg' : `${dayKeys[i - 1]}Fg`), fontFamily: i === 0 ? stdFont : dayFont, fontSize: i === 0 ? stdSize : daySize, padding: 8, textAlign: 'center' }}>
              <div>{day.label}</div><div>{day.date}</div>
            </th>)}
          </tr></thead>
          <tbody>{week.zeilen.map((row, rowIndex) => <tr key={`${row.stunde}-${rowIndex}`}>
            <th style={{ ...borderCell, background: getColor('periodBg'), color: getColor('periodColor'), fontFamily: stdFont, fontSize: stdSize, textAlign: 'center', fontWeight: 500, height: rowHeight }}>
              <strong>{row.stunde}</strong>
              {val('showTimes', true) && <div style={{ fontSize: timeSize, fontFamily: timeFont }}>{formatRange(row.beginn, row.ende)}</div>}
            </th>
            {labels.map((_, dayIndex) => {
              const entries = Array.isArray(row.tage?.[dayIndex]) ? row.tage[dayIndex] : [];
              return <td key={dayIndex} style={{ ...borderCell, background: getColor('emptyColor'), height: rowHeight, verticalAlign: 'top', padding: 0 }}>
                <div style={{ display: 'flex', height: rowHeight, overflow: 'hidden' }}>
                {entries.map((entry, i) => {
                  const typ = String(entry.typ || '').toUpperCase();
                  const substitution = ['SUBSTITUTION', 'TEACHER_SWITCH', 'GRADE_MISSING'].includes(typ);
                  const canceled = ['CANCLED', 'CANCELLED', 'CANCELED'].includes(typ);
                  const frameSize = (name) => Math.max(0, Math.min(8, Number(val(name, 2)) || 0));
                  const specialBorder = canceled
                    ? `${frameSize('cancelBorderWidth')}px solid #cf4040`
                    : typ === 'TEACHER_SWITCH'
                      ? `${frameSize('teacherBorderWidth')}px solid ${getColor('subBorder')}`
                      : substitution
                        ? `${frameSize('subBorderWidth')}px solid ${getColor('subBorder')}`
                        : 'none';
                  const diagonalWidth = Math.max(0, Math.min(8, Number(val('cancelDiagonalWidth', 3)) || 0));
                  const diagonalBackground = canceled && diagonalWidth > 0
                    ? `linear-gradient(to top right, transparent calc(50% - ${diagonalWidth / 2}px), ${getColor('cancelDiagonalColor')} calc(50% - ${diagonalWidth / 2}px), ${getColor('cancelDiagonalColor')} calc(50% + ${diagonalWidth / 2}px), transparent calc(50% + ${diagonalWidth / 2}px))`
                    : 'none';
                  return <div key={entry.id || i} style={{ flex: 1, minWidth: 0, background: colorForLesson(entry, Object.fromEntries(colors.map(([name]) => [name, getColor(name)]))),
                    borderRadius: radius, border: specialBorder, backgroundImage: diagonalBackground, boxSizing: 'border-box', padding: 6, overflow: 'hidden', overflowWrap: 'anywhere', textDecoration: 'none' }}>
                    <div style={{ fontSize: Number(val('subjectFont', 14)), fontWeight: 700 }}>{entry.fach || entry.kürzel || '–'}</div>
                    {val('showTeacher', true) && !['HOLIDAY', 'SCHOOL_EVENT'].includes(typ) && <div style={{ fontSize: Number(val('detailFont', 11)) }}>{entry.lehrer || '–'}</div>}
                    {val('showRoom', true) && !['HOLIDAY', 'SCHOOL_EVENT'].includes(typ) && <div style={{ fontSize: Number(val('detailFont', 11)) }}>{entry.raum || '–'}</div>}
                    {val('showStatus', true) && typ !== 'REGULAR' && !['HOLIDAY', 'SCHOOL_EVENT'].includes(typ) && entry.status && <div style={{ fontSize: Number(val('detailFont', 11)), fontWeight: 700 }}>{canceled && entry.status === 'Entfall' ? 'Entfällt' : entry.status}</div>}
                  </div>;
                })}</div>
              </td>;
            })}
          </tr>)}</tbody>
        </table>}
    </div>;
  }
}
