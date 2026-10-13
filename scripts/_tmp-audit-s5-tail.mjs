#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const list = JSON.parse(readFileSync('./src/data/dialogue-theater/conversations.json', 'utf8')).conversations;

function show(c) {
    console.log(`\n=== ${c.name}`);
    for (const [i, l] of (c.lines || []).entries()) {
        console.log(i, l.hero, '|', String(l.subtitles || '').slice(0, 120));
    }
    if (c.paths?.length) {
        console.log('paths', c.paths.length, c.paths.map((p) => p.label).join(', '));
    }
}

function hit(re) {
    return list.filter(
        (c) =>
            !/favorite animals?/i.test(c.name || '') &&
            (re.test(c.name || '') || re.test(JSON.stringify(c.lines || []))),
    );
}

const groups = [
    [/Junker Planet|ugly Talon|Junker planet|moon/i, 'Junker Planet / moon'],
    [/Sojourn.*Vendetta|Vendetta.*Sojourn|stand.down|IJC|International Justice/i, 'Sojourn/Vendetta/IJC'],
    [/Sojourn.*Winston|Winston.*Sojourn|should.?ve stayed retired/i, 'Sojourn/Winston'],
    [/Sojourn.*Junkrat|Junkrat.*Roadhog.*Sojourn|three of us/i, 'Sojourn/Junkrat/Roadhog'],
    [/Doctrine.*[Bb]ird|bird.*Doctrine|Sombra.*Doctrine|Doctrine.*Sombra/i, 'Doctrine/Sombra birds'],
    [/Sombra.*Mizuki|Mizuki.*Sombra/i, 'Sombra/Mizuki'],
    [/Sombra.*Widow|Widow.*Sombra/i, 'Sombra/Widow'],
    [/chaotic yowl|excited beep|Roadhog.*Bastion|Bastion.*Jetpack/i, 'Roadhog multipath'],
    [/Sigma.*Vendetta|Vendetta.*Sigma/i, 'Sigma/Vendetta'],
    [/Winston.*Wrecking|Wrecking.*Winston|hamster/i, 'Winston/WB'],
    [/Doomfist.*Widow|Widow.*Doomfist/i, 'Doomfist/Widow'],
];

for (const [re, label] of groups) {
    const rows = hit(re);
    console.log(`\n#### ${label} (${rows.length})`);
    rows.slice(0, 12).forEach(show);
}
