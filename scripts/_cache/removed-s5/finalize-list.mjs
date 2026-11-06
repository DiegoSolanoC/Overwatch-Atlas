#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = 'scripts/_cache/removed-s5';
const out = JSON.parse(fs.readFileSync(path.join(ROOT, 'removed-map-v3.json'), 'utf8'));
const conv = JSON.parse(fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8')).conversations;

const psst = conv.find((c) => c.name === 'Psst psst');
if (!psst) throw new Error('Psst psst missing');

const already = out.interactions.some((x) => x.id === psst.id);
if (!already) {
    out.interactions.push({
        n: 0,
        id: psst.id,
        name: psst.name,
        status: psst.status || 'active',
        score: 99,
        chapterIndex: 6,
        chapterTime: '1:15',
        chapterTitle: 'Jetpack Cat & Wuyang',
        batch: 'S5 launch (first 7)',
        heroes: ['Jetpack Cat', 'Wuyang'],
        preview: (psst.lines || [])
            .slice(0, 3)
            .map((l) => `${l.hero}: ${String(l.subtitles || '').slice(0, 70)}`)
            .join(' / '),
        note: 'forced: caption match (little guy / uh sorry) — auto score failed on hiss',
    });
}

// Sort by chapter then score
out.interactions.sort((a, b) => {
    if (a.chapterIndex !== b.chapterIndex) return a.chapterIndex - b.chapterIndex;
    return (b.score || 0) - (a.score || 0);
});
out.interactions = out.interactions.map((row, i) => ({ ...row, n: i + 1 }));
out.uniqueMatched = out.interactions.length;
out.claimedTotal = 83;
out.note =
    'Psst psst manually confirmed from Jetpack Cat & Wuyang chapter captions. Negotiator / Control his fear / Shutdown Order / More than one Path / Cassidy father lines not present in VTT.';

fs.writeFileSync(path.join(ROOT, 'removed-map-final.json'), `${JSON.stringify(out, null, 2)}\n`);

const md = [];
md.push('# Season 5 Removed Interactions — Review List');
md.push('');
md.push(`Source: https://www.youtube.com/watch?v=qIJz7O5ZF_E`);
md.push(`Video claim: **83** · Mapped: **${out.interactions.length}**`);
md.push(`First 7 chapters = S5 launch; rest = Midseason 5.`);
md.push('');
md.push('> No theater statuses changed yet. Say the word and we archive these as `removed`.');
md.push('');
md.push('## S5 launch (first 7)');
md.push('');
for (const row of out.interactions.filter((x) => x.batch.startsWith('S5'))) {
    md.push(`${row.n}. [${row.chapterTime}] **${row.chapterTitle}** → \`${row.name}\``);
    md.push(`   ${row.preview}`);
}
md.push('');
md.push('## Midseason 5');
md.push('');
for (const row of out.interactions.filter((x) => x.batch.startsWith('Mid'))) {
    md.push(`${row.n}. [${row.chapterTime}] **${row.chapterTitle}** → \`${row.name}\``);
    md.push(`   ${row.preview}`);
}
md.push('');
md.push('## Notes');
md.push('- Jetpack Cat & Wuyang → `Psst psst` (captions weak on hiss; confirmed manually).');
md.push('- Vendetta & D.Va multipath replies (Tokki/Overlord/Casino/King/Demon) live inside `Mech Slayer` — one theater entry.');
md.push('- Not in this video (left active): Negotiator, Control his fear, Shutdown Order, More than one Path, Sorry for your Father, Righteous Outlaw.');

fs.writeFileSync(path.join(ROOT, 'removed-map-final.md'), `${md.join('\n')}\n`);
console.log('final count', out.interactions.length);
console.log(
    out.interactions
        .map((r) => `${r.n}. [${r.chapterTime}] ${r.chapterTitle} -> ${r.name}`)
        .join('\n'),
);
