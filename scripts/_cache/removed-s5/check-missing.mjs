import fs from 'fs';
const vtt = fs.readFileSync('scripts/_cache/removed-s5/yt-qIJz7O5ZF_E.en.vtt', 'utf8');
const blob = vtt
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ');

const phrases = [
    ['Psst psst', 'little guy'],
    ['Psst psst', 'psst'],
    ['Negotiator', 'skilled negotiator'],
    ['Negotiator', 'colosseo'],
    ['Control his fear', 'losing that boy'],
    ['Control his fear', 'value fealty'],
    ['Mech Slayer multipath', 'toki'],
    ['Mech Slayer multipath', 'casino would'],
    ['Mech Slayer multipath', 'demon'],
];

for (const [label, p] of phrases) {
    console.log(blob.includes(p) ? 'HIT ' : 'miss', label, '::', p);
}

// Also inspect Mech Slayer / Welcome Resistance structure
const conv = JSON.parse(fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8')).conversations;
for (const name of ['Mech Slayer', 'Welcome Resistance', 'Psst psst', 'Negotiator']) {
    const c = conv.find((x) => x.name === name);
    if (!c) {
        console.log('missing entry', name);
        continue;
    }
    console.log('\nENTRY', name, 'id=', c.id);
    console.log(JSON.stringify(c.lines, null, 2).slice(0, 1200));
}
