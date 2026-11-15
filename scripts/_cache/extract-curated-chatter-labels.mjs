import fs from 'node:fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
    buildChatterCommentaryLabel,
    isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const needles = [
    'honor, otta',
    'lucky next time, Fareeha',
    'lost your way, Emre',
    'happened to him',
    'comes to her senses',
    'good kitty',
    'Bested at your own game',
    "can't hide from me, Niran",
    'adoring fans',
    'Try again, Marzia',
    'rise to my challenge',
    'Stand up. Grow stronger',
    'Keep away from the monk',
    'Impressive, Wuyang',
    'Thank you, Wuyang',
    'without you, Brigitte',
    'spectacular, Hana',
    'scary, Fika',
    'Here, kitty',
    'chose the wrong side',
    "Elaine's design",
    'Everything ventured',
    'Nine lives, laid to waste',
    'Rest in reverence, Akande',
    "Widowmaker is a fool",
    'Ogundimu name',
    'potential, Akande',
    'come far, Akande',
    "can't be beat, Fika",
    "still in there, Emre",
    'little astronaut',
    'Who will the void claim',
    'What does Max see',
    'Whoa there, Icarus',
    "DoR.O.T.H.y",
    'protocol down for good',
    'death sentence',
    "stopping my legion",
    'Dragon Emperor would compliment',
    'sword you can',
];

const { conversations } = JSON.parse(
    fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
);

const labelCounts = new Map();
for (const row of conversations) {
    if (!isChatterEntry(row)) continue;
    for (const line of row.lines || []) {
        if (!isActiveChatterLineForCommentary(line)) continue;
        const hero = line.hero || row.name;
        const text = String(line.subtitles || '');
        const hit = needles.find((n) => text.toLowerCase().includes(n.toLowerCase()));
        if (!hit) continue;
        const base = buildChatterCommentaryLabel(hero, text, line.disclaimer);
        const n = (labelCounts.get(base) || 0) + 1;
        labelCounts.set(base, n);
        const label = n === 1 ? base : `${base} (${n})`;
        console.log(
            JSON.stringify({
                needle: hit,
                label,
                hero,
                text,
                disclaimer: line.disclaimer || '',
                theaterId: row.id,
                lineId: line.id,
            }),
        );
    }
}
