export function readStateValue(values, oid) {
  const entry = values?.[`${oid}.val`] ?? values?.[oid];
  return entry && typeof entry === 'object' && 'val' in entry ? entry.val : entry;
}

export function parseNews(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
  } catch { return []; }
}

export function safeNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function newsDate(item) {
  const raw = item.published_at ?? item.publishedAt ?? item.created_at ?? item.date;
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleString('de-DE');
}

export function newsText(item) {
  const raw = item.content ?? item.text ?? item.description ?? '';
  if (typeof raw !== 'string') return '';
  // Treat returned content as untrusted text, not executable HTML.
  return raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
