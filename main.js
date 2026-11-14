'use strict';
const utils = require('@iobroker/adapter-core');
const { localDate, addDaysLocal, transform } = require('./lib/transform');
const { loginBody, parseLoginResponse } = require('./lib/auth');
const { renderTable, lessonFields, lessonStateValues } = require('./lib/presentation');
const { simpleLessons } = require('./lib/simple-json');
const { weekSchedule, renderWeekGrid, renderWeekNavigator } = require('./lib/week-grid');
const { normalizeHolidays, renderHolidayHtml, daysBetween } = require('./lib/holidays');
const { normalizeNews, parseSeenIds } = require('./lib/news');

class Sdui extends utils.Adapter {
  constructor(options = {}) {
    super({...options, name: 'sdui'});
    this.pollTimer = null;
    this.pollRunning = false;
    this.accessToken = '';
    this.expiresAt = 0;
    this.stopping = false;
    this.cachedHolidayDays = [];
    this.cachedSchoolEvents = [];
    this.lastHolidayFetch = 0;
    this.cachedFutureLessons = [];
    this.lastFutureFetch = 0;
    this.futureCacheKey = "";
    this.on('ready', this.onReady.bind(this));
    this.on('message', this.onMessage.bind(this));
    this.on('stateChange', this.onStateChange.bind(this));
    this.on('unload', this.onUnload.bind(this));
  }

  async onMessage(obj) {
    if (!obj) return;

    if (obj.command === 'listTimetableUsers') {
      try {
        if (!String(this.config.identifier || '').trim() ||
            !String(this.config.password || '') ||
            !String(this.config.slink || '').trim()) {
          this.sendTo(obj.from, obj.command, [], obj.callback);
          return;
        }
        const result = await this.timetableRequest(
          'https://api.sdui.app/v1/users/self/family'
        );

        if (result.status !== 'SUCCESS' || !Array.isArray(result.data)) {
          throw new Error('Unexpected family response');
        }

        const users = result.data
          .filter(user => Number.isSafeInteger(Number(user.id)) && Number(user.id) > 0)
          .map(user => ({
            label: [user.firstname, user.lastname].filter(Boolean).join(' ') || 'Benutzer',
            value: String(user.id)
          }));

        this.sendTo(obj.from, obj.command, users, obj.callback);
      } catch (error) {
        this.log.warn(`Timetable user lookup failed: ${error.message}`);
        this.sendTo(obj.from, obj.command, [], obj.callback);
      }
      return;
    }

    if (
      obj.command === 'inspectHistoricalHolidays' ||
      (obj.command === 'send' &&
       String(obj.message || '').trim() === 'inspectHistoricalHolidays')
    ) {
      try {
        const userId = String(this.config.userId || '').trim();
        const dates = ['2026-09-29', '2026-10-08'];

        await this.ensureLogin();

        for (const date of dates) {
          const url = new URL(
            `https://api.sdui.app/v1/timetables/users/${userId}/timetable`
          );
          url.searchParams.set('begins_at', date);
          url.searchParams.set('ends_at', date);

          const payload = await this.timetableRequest(url);
          const lessons = payload?.data?.lessons;

          if (!Array.isArray(lessons)) {
            throw new Error('Ungültige Sdui-Antwort für ' + date);
          }

          const entries = lessons.filter(raw => {
            const begin = Number(raw.begins_at);
            return Number.isFinite(begin) &&
              localDate(new Date(begin * 1000)) === date;
          }).map(raw => ({
            id: raw.id,
            kind: raw.kind,
            meta: raw.meta || {},
            comment: raw.comment || '',
            subject: raw.course?.subject?.name || '',
            begins_at: raw.begins_at,
            ends_at: raw.ends_at
          }));

          this.log.info(
            `Sdui-Historien-Diagnose ${date}: ${JSON.stringify(entries)}`
          );
        }

        if (obj.callback) this.sendTo(obj.from, obj.command, {success: true}, obj.callback);
      } catch (error) {
        this.log.warn(`Sdui-Historien-Diagnose fehlgeschlagen: ${error.message}`);
        if (obj.callback) this.sendTo(obj.from, obj.command, {success: false, error: error.message}, obj.callback);
      }
      return;
    }

    if (obj.command !== 'searchSchools') return;

    try {
      const term = String(obj.message?.search ?? obj.message?.keyword ?? obj.message ?? '').trim();
      if (term.length < 2 || term.length > 100) {
        this.sendTo(obj.from, obj.command, [], obj.callback);
        return;
      }

      const url = new URL('https://api.sdui.app/v1/leads');
      url.searchParams.set('search', term);

      const response = await this.request(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) throw new Error(`School search HTTP ${response.status}`);

      const result = await response.json();
      if (result.status !== 'SUCCESS' || !Array.isArray(result.data)) {
        throw new Error('Unexpected school search response');
      }

      const schools = result.data
        .filter(school => school.name && school.slink)
        .map(school => ({
          label: `${school.name}${school.city ? ' (' + school.city + ')' : ''}`,
          value: school.slink
        }));

      this.sendTo(obj.from, obj.command, schools, obj.callback);
    } catch (error) {
      this.log.warn(`School search failed: ${error.message}`);
      this.sendTo(obj.from, obj.command, [], obj.callback);
    }
  }

  async onStateChange(id, state) {
    if (!state || state.ack || this.stopping) return;
    if (id === `${this.namespace}.news.markRead`) {
      const newsId = String(state.val || '').trim();
      if (newsId) await this.markNewsRead(newsId);
      await this.setStateAsync('news.markRead', {val: '', ack: true});
      return;
    }
    if (id === `${this.namespace}.news.markAllRead` && state.val === true) {
      await this.markAllNewsRead();
      await this.setStateAsync('news.markAllRead', {val: false, ack: true});
      return;
    }
    if (id !== `${this.namespace}.control.refresh` || state.val !== true) return;
    try {
      if (!this.pollRunning) await this.poll();
    } finally {
      if (!this.stopping) {
        try {
          await this.setStateAsync("control.refresh", {val: false, ack: true});
        } catch (err) {
          this.log.warn(`Sdui-Aktualisierungsbefehl konnte nicht zurückgesetzt werden: ${err.message}`);
        }
      }
    }
  }

  async onReady() {
    await this.createStates();
    await this.subscribeStatesAsync("control.refresh");
    await this.subscribeStatesAsync('news.markRead');
    await this.subscribeStatesAsync('news.markAllRead');
    await this.setStateAsync('info.connection', {val: false, ack: true});
    if (!/^\d+$/.test(String(this.config.userId || '').trim()) ||
        !String(this.config.identifier || '').trim() ||
        !String(this.config.password || '') ||
        !String(this.config.slink || '').trim()) {
      await this.setStateAsync('info.error', {val: 'Missing user ID, identifier, password or school identifier', ack: true});
      this.log.warn('Complete Sdui login settings (identifier, password, slink and timetable user ID).');
      return;
    }
    await this.poll();
  }

  async createStates() {
    const states = {
      'info.connection': ['Connection established', 'boolean', 'indicator.connected', false],
      'info.lastUpdate': ['Last successful update', 'string', 'text', ''],
      'info.error': ['Last error', 'string', 'text', ''],
      'news.items': ['SDUI news as JSON', 'string', 'json', '[]'],
      'news.count': ['Number of fetched SDUI news', 'number', 'value', 0],
      'news.unread': ['Number of locally unread news', 'number', 'value', 0],
      'news.lastUpdate': ['Last successful news fetch', 'string', 'text', ''],
      'news.error': ['Last news fetch error', 'string', 'text', ''],
      'news.seenIds': ['Locally read news IDs as JSON', 'string', 'json', '[]'],
      'news.initialized': ['News first-fetch baseline created', 'boolean', 'indicator', false],
      'timetable.raw.today': ['Original data today JSON', 'string', 'json', '[]'],
      'timetable.raw.tomorrow': ['Original data tomorrow JSON', 'string', 'json', '[]'],
      'timetable.raw.all': ['Original data period JSON', 'string', 'json', '[]'],
      'substitutions.raw.today': ['Original substitutions today JSON', 'string', 'json', '[]'],
      'substitutions.raw.tomorrow': ['Original substitutions tomorrow JSON', 'string', 'json', '[]'],
      'timetable.today': ['Today lessons JSON', 'string', 'json', '[]'],
      'timetable.tomorrow': ['Tomorrow lessons JSON', 'string', 'json', '[]'],
      'timetable.all': ['Requested period lessons JSON', 'string', 'json', '[]'],
      'timetable.count': ['Number of entries in period', 'number', 'value', 0],
      'substitutions.today': ['Today substitutions and changed lessons JSON', 'string', 'json', '[]'],
      'substitutions.tomorrow': ['Tomorrow substitutions and changed lessons JSON', 'string', 'json', '[]'],
      'cancellations.today': ['Today cancellations JSON', 'string', 'json', '[]'],
      'cancellations.tomorrow': ['Tomorrow cancellations JSON', 'string', 'json', '[]'],
      'holidays.upcoming': ['Upcoming holiday periods JSON', 'string', 'json', '[]'],
      'holidays.days': ['Upcoming holiday days JSON', 'string', 'json', '[]'],
      'holidays.event': ['School events with cancelled lessons JSON', 'string', 'json', '[]'],
      'holidays.html': ['Upcoming holidays HTML for VIS', 'string', 'html', ''],
      'holidays.nextName': ['Next holiday name', 'string', 'text', ''],
      'holidays.nextStart': ['Next holiday beginning', 'string', 'text', ''],
      'holidays.nextEnd': ['Next holiday last reported day', 'string', 'text', ''],
      'holidays.daysUntilNext': ['Days until next holiday', 'number', 'value', -1],
      'holidays.lastUpdate': ['Last successful holiday synchronization', 'string', 'text', ''],
      'holidays.error': ['Last holiday query error', 'string', 'text', ''],
      'timetable.weekGrid.json': ['Wochenraster als JSON (Montag bis Freitag)', 'string', 'json', '{}'],
      'timetable.weekGrid.html': ['Wochenraster als HTML für VIS', 'string', 'html', ''],
      'timetable.weekGrid.navigationHtml': ['Wochenraster mit Pfeilnavigation als HTML für VIS', 'string', 'html', ''],
      'timetable.weekGrid.weeks.json': ['Wochenraster aller geladenen Wochen als JSON für VIS 2', 'string', 'json', '{}'],
      'timetable.html.today': ['Stundenplan heute (HTML für VIS)', 'string', 'html', ''],
      'timetable.html.tomorrow': ['Stundenplan morgen (HTML für VIS)', 'string', 'html', ''],
      'timetable.html.week': ['Stundenplan nächste 7 Tage (HTML für VIS)', 'string', 'html', ''],
      'substitutions.html.today': ['Vertretungen heute (HTML für VIS)', 'string', 'html', ''],
      'substitutions.html.tomorrow': ['Vertretungen morgen (HTML für VIS)', 'string', 'html', ''],
      'substitutions.html.week': ['Vertretungen nächste 7 Tage (HTML für VIS)', 'string', 'html', '']
    };
    await this.setObjectNotExistsAsync("control.refresh", {
      type: "state",
      common: {name: "Stundenplan jetzt aktualisieren", type: "boolean", role: "button", read: true, write: true, def: false},
      native: {}
    });
    await this.setObjectNotExistsAsync('news.markRead', {
      type: 'state',
      common: {name: 'Mark one SDUI news item read (ID)', type: 'string', role: 'text', read: true, write: true, def: ''},
      native: {}
    });
    await this.setObjectNotExistsAsync('news.markAllRead', {
      type: 'state',
      common: {name: 'Mark all loaded SDUI news read', type: 'boolean', role: 'button', read: true, write: true, def: false},
      native: {}
    });
    for (const [id, [name, type, role, def]] of Object.entries(states)) {
      await this.setObjectNotExistsAsync(id, {
        type: 'state', common: {name, type, role, read: true, write: false, def}, native: {}
      });
    }
  }

  async updateLessonStates(lessons) {
    // Stable date + API lesson ID: lessons don't shift when the timetable changes.
    // Clean up stale states from removed lessons or outdated days after a successful API fetch.
    const desired = new Set();
    for (const lesson of lessons) {
      const lessonId = String(lesson.id);
      if (!/^\d+$/.test(lessonId)) continue;
      const dayId = `d${lesson.date.replace(/-/g, '')}`;
      const base = `timetable.lessons.${dayId}.lesson_${lessonId}`;
      const values = lessonStateValues(lesson);
      for (const [field, val] of Object.entries(values)) {
        const id = `${base}.${field}`;
        desired.add(id);
        const [name, type, role] = lessonFields[field];
        await this.setObjectNotExistsAsync(id, {
          type: 'state', common: {name, type, role, read: true, write: false}, native: {}
        });
        await this.setStateAsync(id, {val, ack: true});
      }
    }
    const objects = await this.getAdapterObjectsAsync();
    for (const id of Object.keys(objects)) {
      const rel = id.startsWith(`${this.namespace}.`) ? id.slice(this.namespace.length + 1) : id;
      if (rel.startsWith('timetable.lessons.') && !desired.has(rel) && objects[id].type === 'state') {
        await this.delObjectAsync(rel);
      }
    }
  }

  async request(url, init, timeoutMs = 20000) {
    const controller = new AbortController();
    const timeout = this.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {...init, signal: controller.signal, redirect: 'error'});
    } finally {
      this.clearTimeout(timeout);
    }
  }

  async login() {
    const response = await this.request('https://api.sdui.app/v1/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify(loginBody(this.config))
    });
    if (!response.ok) {
      this.log.warn(`Sdui login HTTP ${response.status}`);
      throw new Error(`Sdui login HTTP ${response.status}`);
    }
    const loginPayload = await response.json();
    const data = loginPayload?.data;
    this.log.info('SDUI login structure: ' + JSON.stringify({
      rootFields: loginPayload && typeof loginPayload === 'object'
        ? Object.keys(loginPayload) : [],
      dataFields: data && typeof data === 'object'
        ? Object.keys(data) : []
    }));
    const auth = parseLoginResponse(loginPayload);
    const tokenParts = auth.accessToken.split('.');
    const isJwt = tokenParts.length === 3 &&
      tokenParts.every(part => /^[A-Za-z0-9_-]+$/.test(part));

    this.log.info('SDUI access token format: ' + (isJwt ? 'JWT candidate' : 'not JWT'));

    if (isJwt) {
      try {
        const jwtPayload = JSON.parse(
          Buffer.from(tokenParts[1], 'base64url').toString('utf8')
        );

        const fields = Object.keys(jwtPayload);
        this.log.info('SDUI JWT payload fields: ' + JSON.stringify(fields));
        const subject = String(jwtPayload.sub ?? '');
        this.log.info('SDUI JWT subject matches News user: ' +
          (subject === '4345498'));
      } catch {
        this.log.info('SDUI JWT payload could not be decoded');
      }
    }

    this.accessToken = auth.accessToken;
    try {
      const tokenPayload = JSON.parse(
        Buffer.from(auth.accessToken.split('.')[1], 'base64url').toString('utf8')
      );
      const newsUserId = String(tokenPayload.sub ?? '').trim();
      if (!/^\d+$/.test(newsUserId)) {
        throw new Error('Invalid JWT subject');
      }
      this.newsUserId = newsUserId;
      this.log.debug('SDUI News user ID automatically detected');
    } catch (err) {
      this.newsUserId = '';
      this.log.warn('SDUI News user ID could not be detected');
    }
    this.expiresAt = auth.expiresAt;
    this.log.debug('Sdui login successful');
  }

  async ensureLogin(force = false) {
    // Re-authenticate at least five minutes before the access token expires.
    if (force || !this.accessToken || Date.now() >= this.expiresAt - 5 * 60000) {
      this.accessToken = '';
      this.expiresAt = 0;
      await this.login();
    }
  }

  async timetableRequest(url) {
    await this.ensureLogin();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.request(url, {
        method: 'GET',
        headers: {Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json'}
      });
      if (response.status === 401 && attempt === 0) {
        // Bearer token was invalidated early. Log in once again, then retry.
        await this.ensureLogin(true);
        continue;
      }
      if (!response.ok) throw new Error(`Sdui timetable HTTP ${response.status}`);
      return response.json();
    }
    throw new Error('Sdui timetable unauthorized');
  }

  async markNewsRead(newsId) {
    const items = JSON.parse((await this.getStateAsync('news.items'))?.val || '[]');
    if (!Array.isArray(items) || !items.some(item => String(item.id) === newsId)) return;
    const seen = parseSeenIds((await this.getStateAsync('news.seenIds'))?.val);
    seen.add(newsId);
    await this.setStateAsync('news.seenIds', {val: JSON.stringify([...seen].slice(-2000)), ack: true});
    await this.setStateAsync('news.unread', {val: items.filter(item => !seen.has(String(item.id))).length, ack: true});
  }

  async markAllNewsRead() {
    const items = JSON.parse((await this.getStateAsync('news.items'))?.val || '[]');
    if (!Array.isArray(items)) return;
    const seen = parseSeenIds((await this.getStateAsync('news.seenIds'))?.val);
    for (const item of items) seen.add(String(item.id));
    await this.setStateAsync('news.seenIds', {val: JSON.stringify([...seen].slice(-2000)), ack: true});
    await this.setStateAsync('news.unread', {val: 0, ack: true});
  }

  async refreshNews() {
    if (this.stopping) return;
    try {
      const userId = String(this.newsUserId || '').trim();
      if (!/^\d+$/.test(userId)) throw new Error('Missing valid SDUI user ID');
      // Only page 1 is verified. Pagination can be added after API testing.
      const url = new URL(`https://api.sdui.app/v1/users/${userId}/feed/news`);
      url.searchParams.set('page', '1');
      url.searchParams.set('search', '');
      const payload = await this.timetableRequest(url.toString());
      if (payload?.status !== 'SUCCESS' || !Array.isArray(payload.data)) {
        this.log.warn('SDUI news response structure: ' + JSON.stringify({
          fields: payload && typeof payload === 'object' ? Object.keys(payload) : [],
          metaStatus: payload?.meta?.status ?? null,
          dataIsArray: Array.isArray(payload?.data),
          dataType: typeof payload?.data
        }));
        throw new Error('Unexpected SDUI news response');
      }
      const items = normalizeNews(payload.data);
      const initialized = (await this.getStateAsync('news.initialized'))?.val === true;
      const seen = parseSeenIds((await this.getStateAsync('news.seenIds'))?.val);
      // On the first successful fetch, existing messages should not trigger a notification.
      if (!initialized) for (const item of items) seen.add(String(item.id));
      const unread = items.filter(item => !seen.has(String(item.id))).length;
      await this.setStateAsync('news.items', {val: JSON.stringify(items), ack: true});
      await this.setStateAsync('news.count', {val: items.length, ack: true});
      await this.setStateAsync('news.seenIds', {val: JSON.stringify([...seen].slice(-2000)), ack: true});
      await this.setStateAsync('news.unread', {val: unread, ack: true});
      await this.setStateAsync('news.lastUpdate', {val: new Date().toISOString(), ack: true});
      await this.setStateAsync('news.error', {val: '', ack: true});
      if (!initialized) await this.setStateAsync('news.initialized', {val: true, ack: true});
    } catch (err) {
      const msg = err?.name === 'AbortError' ? 'Request timeout' : String(err?.message || 'News fetch failed');
      await this.setStateAsync('news.error', {val: msg, ack: true});
      this.log.warn(`Sdui news update failed: ${msg}`);
    }
  }

  async refreshHolidays(now) {
    // Sdui has no verified dedicated holidays API. Fetch timetable chunks instead,
    // limiting each request to 28 days so a server-side range cap is respected.
    // Do not run this full scan every 15-minute timetable update.
    if (this.lastHolidayFetch && Date.now() - this.lastHolidayFetch < 24 * 60 * 60000) return;
    const userId = String(this.config.userId).trim();
    const windows = [];
    for (let offset=0;offset<210;offset+=28) {
      const start=localDate(addDaysLocal(now,offset));
      const end=localDate(addDaysLocal(now,Math.min(offset+27,209)));
      const url=new URL(`https://api.sdui.app/v1/timetables/users/${userId}/timetable`);
      url.searchParams.set('begins_at',start);
      url.searchParams.set('ends_at',end);
      windows.push(url);
    }
    try {
      const responses=[];
      for (const url of windows) {
        if (this.stopping) return;
        const payload=await this.timetableRequest(url);
        responses.push(payload.data);
      }
      const result=normalizeHolidays(responses,now);
      this.cachedHolidayDays=result.days.map(day => ({
        id:`holiday-${day.date}`,date:day.date,kind:'HOLIDAY',subject:day.name,shortname:'Ferien',
        startTime:'',endTime:'',teachers:[],rooms:[],begins_at:0,ends_at:0
      }));
      this.cachedSchoolEvents=result.events.map(day => ({
        id:`school-event-${day.date}`,date:day.date,kind:'SCHOOL_EVENT',
        subject:day.name,shortname:'Schulveranstaltung',
        startTime:'',endTime:'',teachers:[],rooms:[],begins_at:0,ends_at:0
      }));
      const first=result.periods[0];
      const values={
        'holidays.upcoming':JSON.stringify(result.periods),
        'holidays.days':JSON.stringify(result.days),
        'holidays.event':JSON.stringify(result.events),
        'holidays.html':renderHolidayHtml(result.periods),
        'holidays.nextName':first?.name||'',
        'holidays.nextStart':first?.start||'',
        'holidays.nextEnd':first?.end||'',
        'holidays.daysUntilNext':first?daysBetween(localDate(now),first.start):-1,
        'holidays.lastUpdate':new Date().toISOString(),
        'holidays.error':''
      };
      for (const [id,val] of Object.entries(values)) await this.setStateAsync(id,{val,ack:true});
      this.lastHolidayFetch=Date.now();
    } catch (err) {
      const message=err?.name==='AbortError'?'Request timeout':String(err?.message||'Holiday fetch failed');
      await this.setStateAsync('holidays.error',{val:message,ack:true});
      this.log.warn(`Sdui holidays update failed: ${message}`);
      // Keep last successful holiday cache; the timetable can still update normally.
    }
  }

  async requestTimetableChunks(userId, now, startDay, endDay) {
    // Inclusive dates, with no more than 28 days per API request.
    const results = [];
    for (let offset = startDay; offset <= endDay; offset += 28) {
      if (this.stopping) throw new Error('Adapter stopping');
      const from = localDate(addDaysLocal(now, offset));
      const to = localDate(addDaysLocal(now, Math.min(offset + 27, endDay)));
      const url = new URL(`https://api.sdui.app/v1/timetables/users/${userId}/timetable`);
      url.searchParams.set('begins_at', from);
      url.searchParams.set('ends_at', to);
      const payload = await this.timetableRequest(url);
      if (!Array.isArray(payload?.data?.lessons)) throw new Error('Unexpected Sdui response: data.lessons missing');
      results.push(...payload.data.lessons);
    }
    return results;
  }

  async poll() {
    if (this.stopping || this.pollRunning) return;
    this.pollRunning = true;
    if (this.pollTimer) {
      this.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    try {
      const userId = String(this.config.userId).trim();
      const now = new Date();
      const daysPast = Math.min(21, Math.max(0, Number(this.config.daysPast) || 0));
      const daysFuture = Math.min(210, Math.max(1, Number(this.config.daysFuture) || 14));
      // Recent lessons and changes update on every poll; distant timetable
      // information refreshes daily to avoid excessive requests to Sdui.
      const recent = await this.requestTimetableChunks(userId, now, -daysPast, Math.min(daysFuture, 35));
      let future = [];
      if (daysFuture > 35) {
        const cacheKey = `${localDate(now)}:${daysFuture}:${userId}`;
        if (this.futureCacheKey !== cacheKey || Date.now() - this.lastFutureFetch >= 24 * 60 * 60000) {
          try {
            const fetched = await this.requestTimetableChunks(userId, now, 36, daysFuture);
            this.cachedFutureLessons = fetched;
            this.lastFutureFetch = Date.now();
            this.futureCacheKey = cacheKey;
          } catch (err) {
            this.log.warn(`Sdui distant timetable refresh failed: ${String(err?.message || err)}`);
            // Keep existing future data until the next successful refresh.
          }
        }
        future = this.cachedFutureLessons;
      } else {
        this.cachedFutureLessons = [];
        this.futureCacheKey = '';
        this.lastFutureFetch = 0;
      }
      const unique = new Map();
      for (const lesson of [...recent, ...future]) {
        if (lesson?.id != null) unique.set(String(lesson.id), lesson);
      }
      const items = transform({lessons: [...unique.values()]}, now);
      await this.refreshHolidays(now);
      const vals = {
        'timetable.today': JSON.stringify(simpleLessons(items.today)),
        'timetable.raw.today': JSON.stringify(items.today),
        'timetable.raw.tomorrow': JSON.stringify(items.tomorrow),
        'timetable.raw.all': JSON.stringify(items.all),
        'substitutions.raw.today': JSON.stringify(items.substitutionsToday),
        'substitutions.raw.tomorrow': JSON.stringify(items.substitutionsTomorrow),
        'timetable.tomorrow': JSON.stringify(simpleLessons(items.tomorrow)),
        'timetable.all': JSON.stringify(simpleLessons(items.all)),
        'timetable.count': items.totalCount,
        'substitutions.today': JSON.stringify(simpleLessons(items.substitutionsToday)),
        'substitutions.tomorrow': JSON.stringify(simpleLessons(items.substitutionsTomorrow)),
        'cancellations.today': JSON.stringify(simpleLessons(items.cancellationsToday)),
        'cancellations.tomorrow': JSON.stringify(simpleLessons(items.cancellationsTomorrow))
      };
      // Beide Wochenraster verwenden dieselben Unterrichts- und Sondertage.
      // Die gemeinsame Liste wird nach dem Duplikatfilter erstellt.
      // The separate holiday scan supplies future holiday days beyond the 35-day normal timetable range.
      // Prefer timetable holiday entries for the near term, and do not duplicate dates.
      const knownDates=new Set(items.all.filter(l=>l.kind==='HOLIDAY').map(l=>l.date));
      const holidayExtras=this.cachedHolidayDays.filter(l=>!knownDates.has(l.date));
      const eventExtras=this.cachedSchoolEvents.filter(l =>
        !knownDates.has(l.date) &&
        !items.all.some(x => x.date === l.date && x.kind === 'SCHOOL_EVENT')
      );
      const allWeekLessons = [...items.all, ...holidayExtras, ...eventExtras];
      const grid = weekSchedule(allWeekLessons, now);
      vals['timetable.weekGrid.json'] = JSON.stringify(grid);
      vals['timetable.weekGrid.html'] = renderWeekGrid(grid, this.config);
      vals['timetable.weekGrid.navigationHtml'] = renderWeekNavigator(allWeekLessons, now, {...this.config, daysFuture});
      const weeksPast = Math.min(3, Math.max(0, Math.ceil((Number(this.config.daysPast) || 0) / 7)));
      const weeksFuture = Math.ceil(Math.min(210, Math.max(1, Number(daysFuture) || 14)) / 7);
      vals['timetable.weekGrid.weeks.json'] = JSON.stringify({
        weeks: Array.from({length: weeksPast + weeksFuture + 1}, (_, i) => {
          const offset = i - weeksPast;
          return {offset, grid: weekSchedule(allWeekLessons, addDaysLocal(now, offset * 7))};
        })
      });
      const weekEnd = addDaysLocal(now, 7);
      const sevenDayEnd = localDate(weekEnd);
      const dateToday = localDate(now);
      const week = items.all.filter(l => l.date >= dateToday && l.date < sevenDayEnd);
      const changes = week.filter(l => ['SUBSTITUTION', 'TEACHER_SWITCH', 'GRADE_MISSING'].includes(l.kind));
      Object.assign(vals, {
        'timetable.html.today': renderTable(items.today, 'Stundenplan heute'),
        'timetable.html.tomorrow': renderTable(items.tomorrow, 'Stundenplan morgen'),
        'timetable.html.week': renderTable(week, 'Stundenplan nächste 7 Tage'),
        'substitutions.html.today': renderTable(items.substitutionsToday, 'Vertretungen heute'),
        'substitutions.html.tomorrow': renderTable(items.substitutionsTomorrow, 'Vertretungen morgen'),
        'substitutions.html.week': renderTable(changes, 'Vertretungen nächste 7 Tage')
      });
      for (const [id, val] of Object.entries(vals)) await this.setStateAsync(id, {val, ack: true});
      // Keep individually created ioBroker objects to a manageable range.
      // Complete future results remain in timetable.all and weekGrid outputs.
      const individualCutoff = localDate(addDaysLocal(now, 35));
      await this.updateLessonStates(items.all.filter(l => l.date <= individualCutoff));
      await this.setStateAsync('info.lastUpdate', {val: now.toISOString(), ack: true});
      await this.setStateAsync('info.error', {val: '', ack: true});
      await this.setStateAsync('info.connection', {val: true, ack: true});
      this.log.debug(`Fetched ${items.totalCount} timetable entries`);
    } catch (err) {
      await this.setStateAsync('info.connection', {val: false, ack: true});
      // Do not print response bodies, login payloads, authorization headers or tokens.
      const safeMessage = err?.name === 'AbortError' ? 'Request timeout' : String(err?.message || 'Unknown error');
      await this.setStateAsync('info.error', {val: safeMessage, ack: true});
      this.log.warn(`Sdui update failed: ${safeMessage}`);
    } finally {
      if (!this.stopping) await this.refreshNews();
      this.pollRunning = false;
      if (!this.stopping) {
        const mins = Math.min(1440, Math.max(15, Number(this.config.intervalMinutes) || 30));
        this.pollTimer = this.setTimeout(() => this.poll(), mins * 60000);
      }
    }
  }
  onUnload(callback) {
    this.stopping = true;
    try {
      if (this.pollTimer) this.clearTimeout(this.pollTimer);
      this.accessToken = '';
      this.expiresAt = 0;
    } finally { callback(); }
  }
}
if (require.main !== module) module.exports = options => new Sdui(options);
else new Sdui();
