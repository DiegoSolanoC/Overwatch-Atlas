import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';
import { normalizeCommentaryEntries } from '../../src/features/system-interface/interface-shared/storyEventCommentary.js';

const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;
const used = new Map();
events.forEach((e, i) => {
  for (const ent of normalizeCommentaryEntries(e.commentary)) {
    const k = ent.name.toLowerCase();
    if (!used.has(k)) used.set(k, []);
    used.get(k).push(`#${i + 1} ${e.name}`);
  }
  for (const v of e.variants || []) {
    for (const ent of normalizeCommentaryEntries(v?.commentary)) {
      const k = ent.name.toLowerCase();
      if (!used.has(k)) used.set(k, []);
      used.get(k).push(`#${i + 1} ${e.name} (v)`);
    }
  }
});
fs.writeFileSync(
  'scripts/_cache/used-commentary.json',
  JSON.stringify(Object.fromEntries(used), null, 2),
);

console.log('=== EVENTS #101-150 ===');
events.slice(100, 150).forEach((e, i) => {
  const n = i + 101;
  const ents = normalizeCommentaryEntries(e.commentary);
  const birth = /is Born|is Made/i.test(e.name);
  console.log(`\n#${n} ${e.name}${birth ? ' [BIRTH/MADE]' : ''}`);
  console.log(' ', e.yearStart, e.cityDisplayName || '');
  if (ents.length) {
    console.log(
      '  EXISTING:',
      ents.map((x) => x.label || x.name).join(' | '),
    );
  }
  if (!birth) {
    const desc = String(e.description || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 280);
    console.log('  DESC:', desc);
  }
});

const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;
const chatters = [];
for (const row of convs) {
  if (!isChatterEntry(row) || row.status === 'removed') continue;
  for (const line of row.lines || []) {
    if (!isActiveChatterLineForCommentary(line)) continue;
    const label = buildChatterCommentaryLabel(
      line.hero || row.name,
      line.subtitles,
      line.disclaimer,
    );
    if (!label) continue;
    chatters.push({
      label,
      text: String(line.subtitles || ''),
      map: String(line.disclaimer || ''),
      hero: String(line.hero || row.name || ''),
      used: used.has(label.toLowerCase()),
      where: used.get(label.toLowerCase()) || [],
    });
  }
}

function dump(title, pred, n = 25) {
  console.log(`\n#### ${title}`);
  const hits = chatters.filter(pred);
  for (const h of hits.slice(0, n)) {
    const u = h.used ? `USED ${h.where.join('; ')}` : 'free';
    console.log(u.padEnd(40), '|', h.label);
  }
}

// Build keyword list from event names/desc for 101-150 non-birth
const page = events.slice(100, 150).filter((e) => !/is Born|is Made/i.test(e.name));
const blob = page
  .map((e) => `${e.name} ${e.description} ${e.cityDisplayName}`)
  .join(' ')
  .toLowerCase();

const bags = [
  ['busan/meka/gwishin/dva/korea', /busan|meka|gwishin|korea|d\.?va|dae-hyun|colossus|xining/i],
  ['null sector/london/king.?s row/mondatta', /null.?sector|king.?s.?row|mondatta|london underworld|uprising/i],
  ['blackwatch/reyes/reaper/retaliation', /blackwatch|reyes|reaper|retribution|venice/i],
  ['tracer/chronal/slipstream/oxton', /tracer|chronal|slipstream|oxton|lena/i],
  ['genji/hanzo/shimada/hanamura/sparrow', /genji|hanzo|shimada|hanamura|sparrow|dragon/i],
  ['winston/recall/gibraltar/overwatch', /winston|recall|gibraltar|overwatch \(group\)|from the ashes/i],
  ['mei/ecopoint/antarctica/climate', /ecopoint|antarctica|antarctic|mei|climate|martins/i],
  ['doomfist/numbani/gauntlet/prison', /doomfist|numbani|gauntlet|akinjide|ogundimu|helsinki|prison/i],
  ['sombra|dorado|mexico|hack', /sombra|dorado|mexico|colomar|hack/i],
  ['widow|am[eé]lie|talon|assassin', /widow|am[eé]lie|lacroix|talon/i],
  ['mercy|angela|swiss|overwatch medical', /mercy|angela|zeigler|switzerland/i],
  ['cassidy|deadlock|ashe|route 66', /cassidy|deadlock|ashe|route.?66|cole/i],
  ['pharah|fareeha|helwan|egypt', /pharah|fareeha|helwan|egypt|cairo/i],
  ['brigitte|torbj|reinhardt|armor', /brigitte|lindholm|reinhardt|jetpack|armor/i],
  ['echo|liao|athena', /echo|liao|athena|aurora/i],
  ['kiriko|kanezaka|fox|kitsune', /kiriko|kanezaka|fox|kitsune|hashimoto/i],
  ['baptiste|talon medic|caribbean', /baptiste|talon|caribbean|havana/i],
  ['illari|runasapi|inti', /illari|runasapi|inti/i],
  ['mauga|samoa|baptiste', /mauga|samoa/i],
  ['venture|archaeolog|omnic archaeology', /venture|archaeolog/i],
  ['sierra|sep|naughton|on the run', /sierra|naughton|soldier.?00|sep/i],
  ['lifeweaver|suravasa|thailand|vishkar', /lifeweaver|suravasa|thailand|vishkar|pruksamanee/i],
  ['junker|junkertown|outback|odessa', /junker|junkertown|outback|queen/i],
  ['zarya|volskaya|russia', /zarya|volskaya|russia|motherland/i],
  ['symmetra|vishkar|utopaea', /symmetra|vishkar|utopaea|hardlight/i],
  ['lucio|brazil|rio|viskar|hardlight', /l[uú]cio|brazil|rio|para[ií]so/i],
  ['orisa|efi|numbani', /orisa|efi|numbani|junie/i],
  ['sigma|talon|gravity|de kuiper', /sigma|gravity|siebren|de kuiper/i],
  ['moira|oasis|genetics', /moira|oasis|genetics/i],
  ['sojourn|toronto|canada', /sojourn|toronto|new queen street|canada/i],
];

console.log('\n=== DIRECT BAG SEARCH ===');
for (const [name, re] of bags) {
  const hits = chatters.filter((c) => re.test(`${c.label} ${c.text} ${c.map}`));
  if (!hits.length) continue;
  console.log(`\n## ${name} (${hits.length})`);
  for (const h of hits.slice(0, 16)) {
    const u = h.used ? `USED ${h.where[0]}` : 'free';
    console.log(u.padEnd(36), '|', h.label.slice(0, 120));
  }
}

// Extra literal searches tied to likely page 11-15 topics
console.log('\n=== EXTRA LITERALS ===');
for (const [t, re] of [
  ['Recall', /\brecall\b/i],
  ['Slipstream|chronal', /slipstream|chronal/i],
  ['Null Sector', /null.?sector/i],
  ["King's Row", /king.?s.?row/i],
  ['Mondatta', /mondatta/i],
  ['Hanamura', /hanamura/i],
  ['Shimada', /shimada/i],
  ['Ecopoint|Antarctic', /ecopoint|antarctic/i],
  ['Gauntlet', /gauntlet/i],
  ['Blackwatch', /blackwatch/i],
  ['Retribution', /retribution/i],
  ['Kanezaka|Hashimoto|fox', /kanezaka|hashimoto|kitsune|\bfox\b/i],
  ['Athena', /\bathena\b/i],
  ['Helwan', /helwan/i],
  ['Watchpoint', /watchpoint/i],
  ['Uprising', /uprising/i],
  ['Deadlock', /deadlock/i],
  ['Route 66', /route.?66/i],
]) {
  const hits = chatters.filter((c) => re.test(c.label));
  console.log(`\n~ ${t} (${hits.length})`);
  hits.slice(0, 10).forEach((h) => {
    console.log((h.used ? 'USED' : 'free').padEnd(6), '|', h.label.slice(0, 120));
  });
}
