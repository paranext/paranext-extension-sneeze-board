export type UserInfo = {
  userId: string;
  color: string; // C# may emit either "#RRGGBB" or a named color token; decoder preserves verbatim.
  name: string;
};

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

export function encodeUserInfo(u: UserInfo): string {
  return `<UserInfo userId="${escapeXml(u.userId)}" color="${escapeXml(u.color)}">${escapeXml(u.name)}</UserInfo>`;
}

const RE = /<UserInfo\s+userId="([^"]*)"\s+color="([^"]*)"\s*>([\s\S]*?)<\/UserInfo>/;
const SELF_CLOSE_RE = /<UserInfo\s+userId="([^"]*)"\s+color="([^"]*)"\s*\/>/;

export function decodeUserInfo(xml: string): UserInfo {
  const m = xml.match(RE);
  if (m) {
    return {
      userId: unescapeXml(m[1]),
      color: unescapeXml(m[2]),
      name: unescapeXml(m[3]),
    };
  }
  const sc = xml.match(SELF_CLOSE_RE);
  if (sc) {
    return {
      userId: unescapeXml(sc[1]),
      color: unescapeXml(sc[2]),
      name: '',
    };
  }
  throw new Error(`Invalid UserInfo XML: ${xml.slice(0, 200)}`);
}
