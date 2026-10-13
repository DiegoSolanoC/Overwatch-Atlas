#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const list = JSON.parse(readFileSync('./src/data/dialogue-theater/conversations.json', 'utf8')).conversations;

function show(c) {
    console.log(`\n=== ${c.name} | id=${c.id}`);
    for (const [i, l] of (c.lines || []).entries()) {
        console.log(i, l.hero, '|', String(l.subtitles || '').slice(0, 140), '|', l.voice || '');
    }
    if (c.paths?.length) {
        console.log(
            'PATHS',
            c.paths.map((p) => `${p.label}:${(p.lineIds || []).length}`).join(' | '),
        );
    }
}

const names = [
    'Junker Planet',
    '11',
    'Blasfemous Contradiction',
    'Blasphemous Contradiction',
    '39',
    'Missing the Moon',
    'Fox girl intel',
    'Truce',
    'Taking Action',
    'Sinking Ship',
    'Aimless Chaos',
    'Real Monster',
    'Misjudge my Competence',
    'Stayed Retired',
    'Comms Clear',
    'Coming with Us',
    'Cover Me',
    'Lab Rat',
    'You are the Variable',
    'Threat to myself and others',
];

for (const n of names) {
    const c = list.find((x) => String(x.name) === n);
    if (c) show(c);
}

console.log('\n--- keyword hits ---');
const keys = [
    /IJC|International Justice Commission/i,
    /war of yours ends now|History will remember which of us/i,
    /shutdown order|little darkness to help us see/i,
    /wanted for heists|You ain't taking us alive|WHAT HE SAID/i,
    /remind me of a crow|birds of a feather|broke you out of jail/i,
    /Hashimoto boss|asking around about me|More like demanding/i,
    /what do you think of the new guy|Nothing stays secret with you|Akande keeps us/i,
    /Finally,? some quiet|chaotic yowl|excited beep/i,
    /EMP's in place|cannot hold together|Pull your weight/i,
    /good to see you again after so long|Do not push your luck|word of caution|came from/i,
    /more equal partnership|Speak your terms|Consider it done/i,
];

for (const re of keys) {
    const hits = list.filter(
        (c) =>
            !/favorite/i.test(c.name || '') &&
            (re.test(c.name || '') || re.test(JSON.stringify(c.lines || []))),
    );
    console.log(`\n* ${re} => ${hits.map((h) => h.name).join(' ; ') || '(none)'}`);
    hits.slice(0, 3).forEach(show);
}
