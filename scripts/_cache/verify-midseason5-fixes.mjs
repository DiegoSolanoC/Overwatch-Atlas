import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../../src/data/registry.cjs');
const { conversations: list } = JSON.parse(fs.readFileSync(absFromPublic(FILES.dialogueTheater.conversations), 'utf8'));

function dump(name) {
    const c = list.find((x) => x.name === name);
    if (!c) {
        console.log('MISSING', name);
        return;
    }
    console.log(`\n==== ${c.name}`);
    for (const l of c.lines || []) {
        console.log(
            `  ${String(l.hero).padEnd(14)} ${JSON.stringify(l.subtitles)}`,
        );
        console.log(`                 voice=${l.voice || ''} prefix=${l.voicePrefix || ''}`);
    }
    if (c.paths?.length) {
        for (const p of c.paths) {
            const seq = p.lineIds.map((id) => {
                const l = c.lines.find((x) => x.id === id);
                return l ? `${l.hero}:${String(l.subtitles).slice(0, 28)}` : '?';
            });
            console.log(`  PATH ${p.label}: ${seq.join(' → ')}`);
        }
    }
}

dump('evasive meows');
dump('17');
dump('36');
dump('Waned over time');
dump('22');
dump('Busan was Nice');
dump('Loving the Bleach look');
dump('Turned In by Family');

console.log('\n=== Remaining suspicious truncations among Midseason-ish ===');
const focus = list.filter((c) => {
    if (/^[0-9]+$/.test(String(c.name))) return true;
    if ((c.tags || []).includes('Midseason 5')) return true;
    return [
        'evasive meows',
        'Turned In by Family',
        'Waned over time',
        'Busan was Nice',
        'Reclaiming Talon',
        'Enhanced Soldier Children',
        'Lock them up again',
        'Peace breeds Complacency',
        'Loving the Bleach look',
    ].includes(c.name);
});
for (const c of focus) {
    for (const l of c.lines || []) {
        const s = String(l.subtitles || '').trim();
        if (!s) {
            console.log('EMPTY', c.name, l.hero);
            continue;
        }
        if (/(healt|learn th|But is th|concern you$|all out$)$/i.test(s)) {
            console.log('STILL CUT', c.name, l.hero, JSON.stringify(s));
        }
    }
}
