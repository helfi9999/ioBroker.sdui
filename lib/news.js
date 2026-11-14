'use strict';

/** Only data required for the widget; never copy credentials or auth headers. */
function normalizeNews(entries) {
  if (!Array.isArray(entries)) return [];
  const unique = new Map();
  for (const raw of entries) {
    if (!raw || raw.id == null || !/^\d+$/.test(String(raw.id))) continue;
    const id = String(raw.id);
    if (unique.has(id)) continue;
    const user = raw.user && typeof raw.user === 'object' ? raw.user : {};
    const sender = [user.firstname, user.lastname].filter(v => typeof v === 'string').join(' ');
    unique.set(id, {
      id,
      title: String(raw.title || ''),
      content: String(raw.content || ''),
      published_at: raw.published_at == null ? '' : String(raw.published_at),
      sender,
      has_attachments: Boolean(raw.has_attachments)
    });
  }
  return [...unique.values()];
}

function parseSeenIds(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return new Set(Array.isArray(parsed) ? parsed.filter(id => /^\d+$/.test(String(id))).map(String) : []);
  } catch (_) {
    return new Set();
  }
}

module.exports = { normalizeNews, parseSeenIds };
