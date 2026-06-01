import type { SneezeRecord } from './sneeze-record';
import type { UserInfo } from './user-info';

export type SneezeDatabase = {
  version: number;
  countdownStart: number;
  sneezes: SneezeRecord[];
  users: UserInfo[];
};

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

function parseAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? unescapeXml(m[1]) : undefined;
}

function parseSneezeEntries(xml: string): SneezeRecord[] {
  const re = /<Sneeze\b([^>]*?)(\/>|>([\s\S]*?)<\/Sneeze>)/g;
  const out: SneezeRecord[] = [];
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    const attrs = m[1];
    const inner = m[3] ?? '';
    out.push({
      userId: parseAttr(attrs, 'userId') ?? '',
      date: parseAttr(attrs, 'date') ?? '',
      comment: unescapeXml(inner),
    });
    m = re.exec(xml);
  }
  return out;
}

function parseUserEntries(xml: string): UserInfo[] {
  const re = /<User\b([^>]*?)(\/>|>([\s\S]*?)<\/User>)/g;
  const out: UserInfo[] = [];
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    const attrs = m[1];
    const inner = m[3] ?? '';
    out.push({
      userId: parseAttr(attrs, 'userId') ?? '',
      color: parseAttr(attrs, 'color') ?? '',
      name: unescapeXml(inner),
    });
    m = re.exec(xml);
  }
  return out;
}

export function decodeSneezeDatabase(xml: string): SneezeDatabase {
  const versionAttr = xml.match(/<SneezeDatabase\b[^>]*Version="([0-9]+)"/);
  const version = versionAttr ? parseInt(versionAttr[1], 10) : 0;

  const cs = xml.match(/<CountdownStart>\s*([0-9]+)\s*<\/CountdownStart>/);
  const countdownStart = cs ? parseInt(cs[1], 10) : 27002;

  const sneezesBlock = xml.match(/<Sneezes>([\s\S]*?)<\/Sneezes>/);
  const usersBlock = xml.match(/<Users>([\s\S]*?)<\/Users>/);

  return {
    version,
    countdownStart,
    sneezes: sneezesBlock ? parseSneezeEntries(sneezesBlock[1]) : [],
    users: usersBlock ? parseUserEntries(usersBlock[1]) : [],
  };
}
