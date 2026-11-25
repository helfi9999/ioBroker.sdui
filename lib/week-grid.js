'use strict';
const { localDate, addDaysLocal } = require('./transform');
const { simpleLesson } = require('./simple-json');
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette = ['#d9edf7','#e5dff5','#cfece7','#f8e2d7','#f1d9ec','#dce9d6','#f7e6bd','#d9e3f7'];
const validColor = (value, fallback) => /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim()) ? String(value).trim() : fallback;
const normalized = s => String(s || '').normalize('NFKC').trim().toLocaleLowerCase('de-DE');
function parseSubjectColors(input) {
  const colors = new Map();
  for (const line of String(input || '').split(/\r?\n/)) {
    const split = line.indexOf('=');
    if (split < 1) continue;
    const name = normalized(line.slice(0,split));
    const color = line.slice(split + 1).trim();
    if (name && /^#[0-9a-fA-F]{6}$/.test(color)) colors.set(name, color);
  }
  return colors;
}
const n = x => /^\d+$/.test(String(x ?? '').trim()) ? Number(x) : null;
function startOfWeek(now) {
  const d = new Date(`${localDate(now)}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  return addDaysLocal(now, -day);
}
function weekSchedule(lessons, now = new Date()) {
  const monday = startOfWeek(now);
  const dates = Array.from({length:5}, (_, i) => localDate(addDaysLocal(monday,i)));
  const weekdays = ['Mo','Di','Mi','Do','Fr'];
  const entries = lessons.filter(l => dates.includes(l.date) && !['HOLIDAY','SCHOOL_EVENT'].includes(l.kind));
  const holidayByDate = new Map(dates.map(date => [date, lessons.find(l => l.date === date && l.kind === 'HOLIDAY') || lessons.find(l => l.date === date && l.kind === 'SCHOOL_EVENT')]));
  const hours = [...new Set(entries.map(l => n(l.hour)).filter(x=>x!==null))].sort((a,b)=>a-b);
  // If the backend doesn't supply a period number, give lessons a date-local ordinal based on time.
  const perDay = new Map(dates.map(d => [d, entries.filter(l=>l.date===d).sort((a,b)=>a.begins_at-b.begins_at)]));
  const normalized = [];
  for (const [date, arr] of perDay) {
    const uniqueStarts = [...new Set(arr.map(l=>l.begins_at))];
    for (const l of arr) normalized.push({...l, displayHour:n(l.hour) ?? uniqueStarts.indexOf(l.begins_at)+1});
  }
  const periods = [...new Set(normalized.map(l=>l.displayHour))].sort((a,b)=>a-b);
  // Sdui typically sends one HOLIDAY entry per day instead of six teaching periods.
  // Keep a visible 1–6 grid even for a whole week without regular lessons.
  if (periods.length === 0 && [...holidayByDate.values()].some(Boolean)) periods.push(1,2,3,4,5,6);
  const holidayEntry = (date,hour) => {
    const holiday = holidayByDate.get(date);
    if (!holiday) return null;
    return { datum: date.split('-').reverse().join('.'), stunde:hour, beginn:'', ende:'', fach:holiday.subject || 'Ferien', lehrer:'', raum:'', status:holiday.kind==='SCHOOL_EVENT'?'Schulveranstaltung':'Ferien', kürzel:holiday.shortname||'', id:holiday.id, kommentar:'', typ:holiday.kind };
  }; 
  const days = dates.map((date,i) => ({date, weekday:weekdays[i], lessons:normalized.filter(l=>l.date===date).map(l=>({...simpleLesson(l), kürzel:l.shortname||'', id:l.id, stunde:l.displayHour, kommentar:l.comment||'', typ:l.kind}))}));
  const rows = periods.map(hour => {
    const candidates=normalized.filter(l=>l.displayHour===hour);
    const times=candidates.sort((a,b)=>a.begins_at-b.begins_at);
    return {stunde:hour, beginn:times[0]?.startTime||'', ende:times[0]?.endTime||'', tage:dates.map(date=>{
      const regular=normalized.filter(l=>l.date===date && l.displayHour===hour).map(l=>({...simpleLesson(l), kürzel:l.shortname||'', id:l.id, stunde:l.displayHour, kommentar:l.comment||'', typ:l.kind}));
      const holiday=holidayEntry(date,hour);
      return holiday ? [holiday] : regular;
    })};
  });
  return {von:dates[0],bis:dates[4],tage:days,zeilen:rows};
}
function renderWeekGrid(schedule, config = {}) {
  const days=schedule.tage;
  const configuredColors = parseSubjectColors(config.subjectColors);
  const defaultSubjects = {
    wirtschaft:'#F3B7D2', englisch:'#B9E0D8', erdkunde:'#B9E0D8', biologie:'#CCD4F2',
    sport:'#B9D9EE', mathematik:'#B9D9EE', deutsch:'#DED1EB', physik:'#B9E0D8',
    kunst:'#DDD0F0', klassenstunde:'#F4CFB6', klassenlehrerstunde:'#F4CFB6'
  };
  for (const [name,fallback] of Object.entries(defaultSubjects)) {
    const englishNames = {
      wirtschaft: 'economics', englisch: 'english',
      erdkunde: 'geography', biologie: 'biology',
      sport: 'sports', mathematik: 'mathematics',
      deutsch: 'german', physik: 'physics',
      kunst: 'art', klassenstunde: 'homeroom',
      klassenlehrerstunde: 'homeroom'
    };
    const englishColor = config['color_' + englishNames[name]];
    const legacyName = name === 'klassenlehrerstunde'
      ? 'klassenstunde'
      : name;
    const legacyColor = config['color_' + legacyName];
    if (!configuredColors.has(name)) {
      configuredColors.set(
        name,
        validColor(englishColor, validColor(legacyColor, fallback))
      );
    }
  }
  const defaultColor = validColor(config.defaultColor,'#D8E7EF');
  const subColor = validColor(config.substitutionColor, '#D58A16');
  const cancelColor = validColor(config.cancellationColor, '#D43D3D');
  const showTimes = config.showWeekTimes !== false;
  const colorOf = (subject, shortname) => {
    const keys = [normalized(subject), normalized(shortname)];
    for (const key of keys) if (configuredColors.has(key)) return configuredColors.get(key);
    // Match full subject prefix for abbreviations when Sdui supplies "MATHEMATIK" vs "Mathematik".
    for (const [key,value] of configuredColors) if(keys.some(k=>k && (k.startsWith(key) || key.startsWith(k)))) return value;
    return defaultColor;
  };
  const css=`<style>
.sdui-week-wrap{max-width:100%;overflow-x:auto;font-family:var(--sdui-font,Arial,sans-serif);font-size:var(--sdui-size,14px);line-height:1.35;color:var(--sdui-text,#18232e)}.sdui-week{min-width:690px;width:100%;border-collapse:collapse;table-layout:fixed}.sdui-week th,.sdui-week td{border:2px solid #1f2937}.sdui-week thead th{background:var(--sdui-header-bg,#e7edf5);text-align:center;padding:8px 2px;font-weight:600;color:var(--sdui-header-text,#334155)}.sdui-week th:first-child,.sdui-week .period{width:75px}.sdui-week .period{background:var(--sdui-period-bg,#f2f4f6);text-align:center;vertical-align:middle;color:var(--sdui-period-text,#475569);padding:0 4px}.sdui-week .period small{display:block;font-size:11px;color:var(--sdui-period-text,#667085)}.sdui-week td{vertical-align:top;background:#f7f8fa;padding:0;height:96px}.sdui-week td>div,.sdui-week td>.sdui-lesson{height:100%}.sdui-week .sdui-lesson{padding:7px 7px 6px;height:96px;box-sizing:border-box;border:none;border-radius:0;margin:0;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start;overflow-wrap:anywhere}.sdui-week .sdui-lesson strong{display:block;font-size:var(--sdui-subject-size,14px);line-height:1.12;white-space:normal;word-break:break-word;overflow-wrap:anywhere;margin-bottom:2px}.sdui-week .sdui-lesson small{display:block;font-size:var(--sdui-details-size,11px);line-height:1.2}.sdui-week .sdui-status{font-size:var(--sdui-details-size,11px);font-weight:700;margin-top:auto;padding-top:2px}.sdui-week .sdui-lesson .sdui-room{font-weight:700}.sdui-week .sdui-sub{box-shadow:inset 0 0 0 2px var(--sdui-sub-color,#cc8b11)}.sdui-week .sdui-cancel{box-shadow:inset 0 0 0 2px var(--sdui-cancel-color,#d13b3b);background:#ffe5e5!important;text-decoration:line-through}.sdui-week .sdui-holiday{background:#e3e9f2!important;color:#334155;display:flex;justify-content:center;font-weight:600}.sdui-week .sdui-school-event{background:#cfece7!important;color:#174d48;display:flex;justify-content:center;font-weight:600}.sdui-week .sdui-empty{height:96px;background:#f7f8fa}.sdui-week .sdui-daydate{display:block;font-size:18px;margin-top:2px}.sdui-week-caption{font-weight:700;margin:8px 0}.sdui-week .sdui-day-label{display:block}.sdui-week .sdui-day-label::after{content:var(--sdui-day-text,"")}.sdui-week .sdui-day-label.sdui-vis-override{font-size:0}.sdui-week .sdui-day-label.sdui-vis-override::after{font-size:var(--sdui-header-size,14px)}.sdui-week thead th{font-size:var(--sdui-header-size,14px)}</style>`;
  const theme=`<style>.sdui-week-wrap{--sdui-sub-color:${subColor};--sdui-cancel-color:${cancelColor}}</style>`;
  const heading=days.map((day,index)=>`<th scope="col"><span class="sdui-day-label sdui-vis-override" style="--sdui-day-text:var(--sdui-label-${['mo','di','mi','do','fr'][index]}, '${['Mo','Di','Mi','Do','Fr'][index]}')">${esc(day.weekday)}</span><span class="sdui-daydate">${esc(day.date.slice(8))}</span></th>`).join('');
  const body=schedule.zeilen.map(row=>{
    const cells=row.tage.map(list=>`<td>${list.length?list.map(l=>{
      const holiday=l.typ==='HOLIDAY';
       const schoolEvent=l.typ==='SCHOOL_EVENT';
       const special=holiday||schoolEvent;
      const cancel=['CANCLED','CANCELLED','CANCELED'].includes(l.typ);
      const sub=['SUBSTITUTION','TEACHER_SWITCH','GRADE_MISSING'].includes(l.typ);
      const cls=holiday?' sdui-holiday':schoolEvent?' sdui-school-event':cancel?' sdui-cancel':sub?' sdui-sub':'';
      const bg=cancel||special?'':` style="background:${colorOf(l.fach, l.kürzel)}"`;
      const label=l.fach||l.kürzel||'–';
      const timeMarkup=showTimes && !special?`<small>${esc(l.beginn)}–${esc(l.ende)}</small>`:'';
      const detailsMarkup=special?'':`<small>${esc(l.lehrer||'–')} · <span class="sdui-room">${esc(l.raum||'–')}</span></small>`;
      return `<div class="sdui-lesson${cls}"${bg}><strong title="${esc(l.fach)}">${esc(label)}</strong>${timeMarkup}${detailsMarkup}${(sub||cancel)?`<div class="sdui-status">${esc(l.status)}</div>`:''}${l.kommentar?`<small>${esc(l.kommentar)}</small>`:''}</div>`;
    }).join(''):'<div class="sdui-empty"></div>'}</td>`).join('');
    return `<tr><th class="period" scope="row">${esc(row.stunde)}<small>${esc(row.beginn)}–${esc(row.ende)}</small></th>${cells}</tr>`;
  }).join('');
  return css+theme+`<div class="sdui-week-wrap"><div class="sdui-week-caption">Stundenplan ${esc(schedule.von)} bis ${esc(schedule.bis)}</div><table class="sdui-week"><thead><tr><th><span class="sdui-day-label sdui-vis-override" style="--sdui-day-text:var(--sdui-label-std, 'Std.')">Std.</span></th>${heading}</tr></thead><tbody>${body}</tbody></table></div>`;
}
module.exports={weekSchedule,renderWeekGrid,parseSubjectColors};

// CSS-only controls intentionally avoid inline scripts, which VIS HTML widgets may block.
function renderWeekNavigator(lessons, now = new Date(), config = {}) {
  const futureDays = Math.min(210, Math.max(1, Number(config.daysFuture) || 14));
  const pastWeeks = Math.min(3, Math.max(0, Math.ceil((Number(config.daysPast) || 0) / 7)));
  const offsets = Array.from({length:pastWeeks + Math.ceil(futureDays / 7) + 1},(_,i)=>i-pastWeeks);
  const currentIndex = pastWeeks;
  const weeks = offsets.map(offset => ({
    offset,
    schedule: weekSchedule(lessons, addDaysLocal(now, offset * 7))
  }));
  const uid = 'sdui-week-navigation';
  const style = `<style>
.sdui-navigator{color:#18232e;max-width:100%;font-family:Arial,sans-serif}
.sdui-navigator > input.sdui-week-select{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.sdui-navigator .sdui-week-panel{display:none}
${weeks.map((_,i)=>`#${uid}-${i}:checked ~ .sdui-week-panels > .sdui-week-panel-${i}{display:block}`).join('\n')}
.sdui-navigator .sdui-week-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;min-height:42px}.sdui-navigator .sdui-week-toolbar-center{display:flex;align-items:center;justify-content:center;gap:10px;flex:1;flex-wrap:wrap}
.sdui-navigator .sdui-week-label{font-weight:700;text-align:center;color:var(--sdui-header-text,#334155)}
.sdui-navigator .sdui-week-arrow{display:inline-flex;align-items:center;justify-content:center;min-width:34px;min-height:32px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#0f172a;cursor:pointer;font-size:22px;user-select:none}
.sdui-navigator .sdui-week-arrow:hover{background:#dbeafe}
.sdui-navigator .sdui-week-arrow.disabled{color:#9ca3af;background:#f3f4f6;cursor:default}
.sdui-navigator .sdui-week-home{display:inline-block;padding:5px 10px;margin:0;border:1px solid #94a3b8;border-radius:4px;cursor:pointer;background:#f8fafc;color:#334155;font-size:12px}
.sdui-navigator .sdui-home-disabled{opacity:.55;cursor:default}.sdui-navigator .sdui-no-data{margin:8px 0;padding:8px;background:#fff7e6;color:#784a07;border-radius:4px;font-size:13px}
</style>`;
  const inputs = weeks.map((_,i) => `<input class="sdui-week-select" type="radio" name="${uid}" id="${uid}-${i}"${i===currentIndex?' checked':''}>`).join('');
  const panels = weeks.map(({schedule},i) => {
    const prev = i ? `<label class="sdui-week-arrow" for="${uid}-${i-1}" title="Vorherige Woche" aria-label="Vorherige Woche">&#x276E;</label>` : `<span class="sdui-week-arrow disabled" aria-hidden="true">&#x276E;</span>`;
    const next = i < weeks.length-1 ? `<label class="sdui-week-arrow" for="${uid}-${i+1}" title="Nächste Woche" aria-label="Nächste Woche">&#x276F;</label>` : `<span class="sdui-week-arrow disabled" aria-hidden="true">&#x276F;</span>`;
    const home = i===currentIndex?'<span class="sdui-week-home sdui-home-disabled">Aktuelle Woche</span>':`<label for="${uid}-${currentIndex}" class="sdui-week-home">Aktuelle Woche</label>`;
    const count = schedule.zeilen.reduce((sum, row) => sum + row.tage.reduce((n,cell) => n+cell.length,0),0);
    const notice = count?'':`<div class="sdui-no-data">Für diese Woche sind keine Einträge geladen. Prüfe die Einstellungen „Days past“ und „Days future“.</div>`;
    return `<section class="sdui-week-panel sdui-week-panel-${i}"><div class="sdui-week-toolbar">${prev}<div class="sdui-week-toolbar-center"><span class="sdui-week-label">${esc(schedule.von)} bis ${esc(schedule.bis)}</span>${home}</div>${next}</div>${notice}${renderWeekGrid(schedule,config)}</section>`;
  }).join('');
  return `${style}<div class="sdui-navigator">${inputs}<div class="sdui-week-panels">${panels}</div></div>`;
}
module.exports.renderWeekNavigator = renderWeekNavigator;
