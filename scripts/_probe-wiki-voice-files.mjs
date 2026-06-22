const USER_AGENT = 'OverwatchAtlas/1.0';

/** @param {string} title */
async function fileUrl(title) {
    const url = new URL('https://overwatch.fandom.com/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', title);
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const pages = Object.values((await res.json()).query.pages);
    const info = pages[0]?.imageinfo?.[0];
    return info ? { url: info.url, size: info.size, title: pages[0].title } : null;
}

/** @param {string} term */
async function searchFiles(term) {
    const url = new URL('https://overwatch.fandom.com/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', term);
    url.searchParams.set('srnamespace', '6');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    return ((await res.json()).query?.search || []).map((s) => s.title);
}

const candidates = [
    'File:Mizuki - If only you were a black cat, you could help me ward off evil.ogg',
    'File:Mizuki - Sorry, geez. You\'re fine the way you are, okay.ogg',
    'File:Wrecking Ball - Meow... meow.ogg',
    'File:Wuyang - Uh... shouldn\'t it be kitten me.ogg',
    'File:Reinhardt - A cat? In a jetpack?! You\'ve got to be catting me!.ogg',
    'File:Mercy - Reinhardt… I do believe it\'s "kitten" me.ogg',
    'File:Mercy - Reinhardt... I do believe it\'s kitten me.ogg',
    'File:Wrecking Ball - The hamster knows a suspicious mammal when he sees one.ogg',
    'File:Wrecking Ball - The cute act will not work on him. He is the master of it.ogg',
    'File:Wrecking Ball - He says, oh no you didn\'t.ogg',
    'File:Wrecking Ball - He says, the pot is calling the kettle black.ogg',
    'File:Wrecking Ball - He says, you take that back.ogg',
    'File:Reinhardt - Don\'t be ridiculous. She\'s not a baby!.ogg',
    'File:Reinhardt - Don\'t be ridiculous. She\'s not a baby.ogg',
];

console.log('=== Direct file probes ===');
for (const title of candidates) {
    const r = await fileUrl(title);
    console.log(r ? `OK  ${title}` : `MISS ${title}`);
}

console.log('\n=== Search probes ===');
for (const term of [
    'Mizuki black cat evil',
    'Mizuki Sorry geez',
    'Wrecking Ball hamster suspicious',
    'Wrecking Ball cute act master',
    'Wrecking Ball oh no you',
    'Wrecking Ball pot calling',
    'Reinhardt cat jetpack catting',
    'Mercy kitten me Reinhardt',
    'Reinhardt not a baby',
    'Jetpack Cat meows',
]) {
    const hits = await searchFiles(term);
    if (hits.length) {
        console.log(term);
        for (const h of hits.slice(0, 5)) console.log(' ', h);
    }
}
