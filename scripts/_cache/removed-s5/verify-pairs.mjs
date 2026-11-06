import fs from 'fs';

const vtt = fs
    .readFileSync('scripts/_cache/removed-s5/yt-qIJz7O5ZF_E.en.vtt', 'utf8')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ');

const mapped = new Set(
    JSON.parse(fs.readFileSync('scripts/_cache/removed-s5/removed-map-v3.json', 'utf8')).interactions.map(
        (x) => x.name,
    ),
);

const checks = [
    ['More than one Path', 'killing you myself'],
    ['Stand Aside', 'stand aside'],
    ['Serve Another\'s Vengeance', 'another'],
    ['Need your Praise', 'praise'],
    ['Sorry for your Father', 'sorry for your father'],
    ['Righteous Outlaw', 'righteous'],
    ['No Tyrant', 'tyrant'],
    ['Shutdown Order', 'shutdown'],
    ['Shutdown Order', 'jc'],
    ['Focus on Saving the World', 'saving the world'],
    ['Recruitment tokens', 'recruitment'],
    ['Declare your loyalty', 'loyalty'],
    ['Forgetting about me', 'forgetting about me'],
    ['Money before Loyalty', 'money before'],
    ['Not so Agreeable', 'agreeable'],
];

// Better: look up entry and test distinctive phrase from subtitles
const conv = JSON.parse(fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8')).conversations;
const names = [
    'More than one Path',
    'Stand Aside',
    "Serve Another's Vengeance",
    'Need your Praise',
    'Sorry for your Father',
    'Righteous Outlaw',
    'No Tyrant',
    'Shutdown Order',
    'Focus on Saving the World',
    'Recruitment tokens',
    'Declare your loyalty',
    'Forgetting about me',
    'Money before Loyalty',
    'Not so Agreeable',
    'War machine',
    'Psst psst',
];

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

for (const name of names) {
    const c = conv.find((x) => x.name === name);
    const inMap = mapped.has(name);
    if (!c) {
        console.log('NOENTRY', name);
        continue;
    }
    const subs = norm((c.lines || []).map((l) => l.subtitles).join(' '));
    const words = subs.split(' ').filter((w) => w.length > 2);
    let best = 0;
    let bestChunk = '';
    for (let size = 5; size >= 3; size--) {
        for (let i = 0; i <= words.length - size; i++) {
            const chunk = words.slice(i, i + size).join(' ');
            if (chunk.length < 12) continue;
            if (vtt.includes(chunk) && chunk.length > best) {
                best = chunk.length;
                bestChunk = chunk;
            }
        }
    }
    console.log(
        (best ? 'IN_VIDEO' : 'not_in_vtt').padEnd(10),
        (inMap ? 'MAPPED' : 'unmapped').padEnd(9),
        name,
        best ? `:: ${bestChunk}` : '',
    );
}
