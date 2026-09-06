import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

const names = [
  'Where Max lives',
  'Outside Hire',
  'In your Armor',
  'Captivating',
  'Curious Whales',
  'The Martinses',
  'Visiting the Martinses',
  'Happy to Kill',
  'At my Induction',
  'Gérard spoke of you',
  "How's Murphy",
  'Like my Brother',
  'Going to the Arcade',
  'Seen you before',
  'Sorry for your Doctor',
  'Looking Back',
  'Try Dying again',
  'Helping those in need',
];

for (const name of names) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISSING', name);
    continue;
  }
  console.log('===', c.name, '===');
  for (const l of c.lines || []) {
    console.log(' ', l.hero + ':', (l.subtitles || '').slice(0, 160));
  }
}

const re =
  /Maximilien|Maximillien|hostile to life|survive the Reckoning|Helping those in need|My home and native|sparrow has finally|So peaceful here|Who should I kill first|hungry for this/i;
for (const c of convs) {
  if (!isChatterEntry(c)) continue;
  for (const l of c.lines || []) {
    if (!isActiveChatterLineForCommentary(l)) continue;
    if (re.test(l.subtitles || '')) {
      console.log(
        'CHAT',
        buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer),
      );
    }
  }
}
