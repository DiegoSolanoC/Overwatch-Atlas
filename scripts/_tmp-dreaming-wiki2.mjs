#!/usr/bin/env node
import { resolveWikiFileDownloadUrl, downloadWikiVoicelineFile, wikiFileTitleToTheaterFilename } from './lib/wiki-voiceline-download.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VOICELINES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/audio/Theater/Voicelines');

const titles = [
    "File:Junkrat - The queen sure seems to have an interest to me. S'ppose she fancies me. I'd hate to break her heart.ogg",
    'File:Junker Queen - Haha. What-what was that, Fawkes. You wanna come say that to my fist.ogg',
    "File:Roadhog - You're dreaming.ogg",
    "File:Roadhog - (laughs) You're dreaming.ogg",
    "File:Junkrat - The queen sure seems to have an interest to me. S'ppose she fancies me.ogg",
];

async function searchBoth(term) {
    for (const host of ['https://overwatch.fandom.com', 'https://overwatch.weirdgloop.org']) {
        const q = new URL(`${host}/api.php`);
        q.searchParams.set('action', 'query');
        q.searchParams.set('list', 'search');
        q.searchParams.set('srsearch', term);
        q.searchParams.set('srnamespace', '6');
        q.searchParams.set('format', 'json');
        try {
            const res = await fetch(q, { headers: { 'User-Agent': 'OverwatchAtlas/1.0' } });
            const j = await res.json();
            console.log(host, term, '->', j.query?.search?.map((s) => s.title));
        } catch (e) {
            console.log(host, 'ERR', e.message);
        }
    }
}

for (const t of titles) {
    const r = await resolveWikiFileDownloadUrl(t);
    console.log(t, '->', r?.url || 'missing');
}

await searchBoth('interest to me');
await searchBoth("You're dreaming");
await searchBoth('break her heart');
await searchBoth('say that to my fist');

// Try weirdgloop direct imageinfo
for (const t of titles.slice(0, 3)) {
    const q = new URL('https://overwatch.weirdgloop.org/api.php');
    q.searchParams.set('action', 'query');
    q.searchParams.set('titles', t);
    q.searchParams.set('prop', 'imageinfo');
    q.searchParams.set('iiprop', 'url');
    q.searchParams.set('format', 'json');
    const res = await fetch(q, { headers: { 'User-Agent': 'OverwatchAtlas/1.0' } });
    const j = await res.json();
    const page = Object.values(j.query?.pages || {})[0];
    console.log('weirdgloop', t, page?.imageinfo?.[0]?.url || page?.missing !== undefined ? 'MISSING' : JSON.stringify(page)?.slice(0, 200));
}
