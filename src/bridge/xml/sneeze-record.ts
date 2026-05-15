export type SneezeRecord = {
  userId: string;
  date: string; // ISO 8601 UTC, preserved verbatim for server-side matching
  comment?: string;
};

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

export function encodeSneezeRecord(r: SneezeRecord): string {
  const comment = r.comment ?? '';
  return `<SneezeRecord userId="${escapeXml(r.userId)}" date="${escapeXml(r.date)}">${escapeXml(comment)}</SneezeRecord>`;
}

const RE = /<SneezeRecord\s+userId="([^"]*)"\s+date="([^"]*)"\s*>([\s\S]*?)<\/SneezeRecord>/;
const SELF_CLOSE_RE = /<SneezeRecord\s+userId="([^"]*)"\s+date="([^"]*)"\s*\/>/;

export function decodeSneezeRecord(xml: string): SneezeRecord {
  const m = xml.match(RE);
  if (m) {
    return {
      userId: unescapeXml(m[1]),
      date: unescapeXml(m[2]),
      comment: unescapeXml(m[3]),
    };
  }
  const sc = xml.match(SELF_CLOSE_RE);
  if (sc) {
    return {
      userId: unescapeXml(sc[1]),
      date: unescapeXml(sc[2]),
      comment: '',
    };
  }
  throw new Error(`Invalid SneezeRecord XML: ${xml.slice(0, 200)}`);
}
