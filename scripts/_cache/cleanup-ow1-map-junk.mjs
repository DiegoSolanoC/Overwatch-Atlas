/**
 * Remove OW1 map-import parse artifacts (rowspan / bare map titles as subtitles).
 */
import fs from 'fs';

const path = 'src/data/dialogue-theater/conversations.json';
const raw = JSON.parse(fs.readFileSync(path, 'utf8'));

function isJunkSubtitle(s) {
  const text = String(s || '').trim();
  if (!text) return true;
  if (/rowspan\s*=/i.test(text)) return true;
  if (/^\|/.test(text)) return true;
  if (/^['"][^'"]+['"]$/.test(text) && text.length < 48) return true;
  if (/^Horizon Lunar Colony(\s*\([^)]+\))?$/i.test(text.replace(/^['"]|['"]$/g, ''))) return true;
  return false;
}

let dropped = 0;
for (const c of raw.conversations || []) {
  if (c.entryType !== 'chatter' || !Array.isArray(c.lines)) continue;
  const next = [];
  for (const line of c.lines) {
    if (
      String(line.era || '') === 'Classic'
      && String(line.disclaimer || '').trim()
      && isJunkSubtitle(line.subtitles)
    ) {
      dropped += 1;
      continue;
    }
    next.push(line);
  }
  c.lines = next;
}

fs.writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`Dropped ${dropped} junk OW1 map lines`);

const hanzo = raw.conversations.find((c) => c.name === 'Hanzo');
for (const l of hanzo?.lines || []) {
  if (l.era === 'Classic' && /numbani/i.test(l.disclaimer || '')) {
    console.log('OK:', l.disclaimer, '|', l.subtitles);
  }
}
