#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');

function walk(dir, acc = []) {
    if (!fs.existsSync(dir)) return acc;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, acc);
        else if (/\.ogg$/i.test(e.name)) acc.push(p);
    }
    return acc;
}

const queries = [
    ['Roadhog', /moon|Mars|Junker planet|vacation|Talon/i],
    ['Sojourn', /Vendetta|war of yours|shutdown|Winston|Busan|heists|wanted|mercy|priority/i],
    ['Vendetta', /History will remember|war of yours|forgotten|never be forgotten|claims victory/i],
    ['Winston', /leaders need|difficult decisions|darkness|light|shutdown|Hammond|push your luck|family|came from/i],
    ['Junkrat', /mercy|Overwatch queen|changed|returned|never ever/i],
    ['Sombra', /crow|jail|friends|Hashimoto|new guy|between us|Grimsvotn|old self|information for free|demanding/i],
    ['Doctrine', /crow|birds of a feather|brother|blasphemous|harmonious|codger/i],
    ['Mizuki', /asking around|Hashimoto|unapproachable/i],
    ['Widowmaker', /allies|judgment|secret|equal partnership|targets|leash|financial|loyalty/i],
    ['Doomfist', /equal partnership|Speak your terms|Consider it done|loyalty|adapt/i],
    ['Sigma', /cannot hold|no use|EMP|subject/i],
    ['Bastion', /excited|quiet/i],
    ['Jetpack Cat', /chaotic|yowl/i],
    ['Wrecking Ball', /Likewise|grateful|came from|violence|caution/i],
    ['Brigitte', /IJC|International Justice|Commission/i],
    ['Torbjörn', /IJC|International Justice/i],
];

for (const [hero, re] of queries) {
    console.log(`\n## ${hero}`);
    const root = path.join(EXTRACT, hero);
    if (!fs.existsSync(root)) {
        console.log(' missing hero folder');
        continue;
    }
    for (const f of walk(root)) {
        if (re.test(f)) console.log(' ', path.relative(EXTRACT, f));
    }
}
