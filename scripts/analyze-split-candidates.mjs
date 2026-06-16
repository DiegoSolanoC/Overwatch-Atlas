import fs from 'fs';

const { events } = JSON.parse(
    fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
);

const endIdx = events.findIndex((e) => e.name === 'Failure at Sea');
const slice = events.slice(0, endIdx + 1);

function stripHtml(s) {
    return String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
}

function countWords(text) {
    const t = stripHtml(text).replace(/\s+/g, ' ').trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
}

function countParagraphs(text) {
    const t = stripHtml(text).trim();
    if (!t) return 0;
    const parts = t.split(/\n\s*\n+|\n/).filter((p) => p.trim().length > 20);
    return parts.length || 1;
}

function getLocations(event) {
    const locs = new Set();
    if (event.cityDisplayName) locs.add(event.cityDisplayName);
    for (const key of ['secondaryCountryPlaces', 'heroFilterPlaces', 'factionFilterPlaces']) {
        if (!Array.isArray(event[key])) continue;
        for (const p of event[key]) {
            if (p?.locationName) locs.add(String(p.locationName).trim());
        }
    }
    if (Array.isArray(event.variants)) {
        for (const v of event.variants) {
            if (v.cityDisplayName) locs.add(v.cityDisplayName);
            if (v.locationName) locs.add(v.locationName);
        }
    }
    const desc = stripHtml(event.description || '');
    const re = /\b([A-Z][\w'.-]+(?: [A-Z][\w'.-]+)*),\s*([A-Z][\w'. -]+)\b/g;
    let m;
    while ((m = re.exec(desc))) {
        locs.add(`${m[1]}, ${m[2]}`);
    }
    return [...locs].filter(Boolean);
}

function countBeats(text) {
    const t = stripHtml(text);
    if (!t) return 0;
    const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
    let beats = sentences.length;
    const paras = stripHtml(text).split(/\n\s*\n+|\n/).filter((p) => p.trim().length > 20);
    if (paras.length > 1) beats = Math.max(beats, paras.length * 2);
    const seq = (t.match(
        /\b(first|then|after|later|meanwhile|following|next|eventually|finally|second|third|months later|years later|weeks later|would|began|deployed|mission|attack|battle|recruit|formed|built|founded|escaped|destroyed)\b/gi,
    ) || []).length;
    beats += Math.floor(seq / 2);
    return beats;
}

function suggestSplits(event, locs, paras, beats) {
    const hints = [];
    const desc = stripHtml(event.description || '').toLowerCase();
    const name = event.name;

    if (locs.length >= 3) {
        hints.push(`Multiple places (${locs.length}): consider one event per location or per theater`);
    }
    if (paras >= 3) {
        hints.push(`${paras} narrative blocks — natural paragraph breaks for separate entries`);
    }
    if (beats >= 10) {
        hints.push(`Dense timeline (~${beats} story beats) — several distinct phases`);
    }
    if (Array.isArray(event.variants) && event.variants.length > 1) {
        hints.push(`Already has ${event.variants.length} variants — may warrant standalone events instead`);
    }

    const missionWords = (desc.match(/\b(mission|operation|deployment|battle|siege|raid|strike|assault|campaign)\b/g) || []).length;
    if (missionWords >= 2) hints.push('Multiple missions/operations referenced');

    const recruitWords = (desc.match(/\b(recruit|joined|hired|enlisted|added to|approached)\b/g) || []).length;
    if (recruitWords >= 2) hints.push('Multiple recruitments or roster additions');

    const timeJumps = (desc.match(/\b(years? later|months? later|weeks? later|following|after the|decade)\b/g) || []).length;
    if (timeJumps >= 2) hints.push('Multiple time jumps — could anchor separate dated events');

    if (/born|is born/i.test(name) && countWords(event.description) > 80) {
        hints.push('Birth event with extended backstory — childhood/setup could be its own event');
    }

    return hints;
}

function score(r) {
    let s = 0;
    if (r.words >= 220) s += 3;
    else if (r.words >= 160) s += 2;
    else if (r.words >= 120) s += 1;
    if (r.paras >= 4) s += 3;
    else if (r.paras >= 3) s += 2;
    else if (r.paras >= 2) s += 1;
    if (r.locs >= 4) s += 3;
    else if (r.locs >= 3) s += 2;
    else if (r.locs >= 2) s += 1;
    if (r.beats >= 12) s += 3;
    else if (r.beats >= 9) s += 2;
    else if (r.beats >= 7) s += 1;
    if (r.hasVariants) s += 1;
    return s;
}

const rows = slice.map((e, i) => {
    const locList = getLocations(e);
    const row = {
        idx: i + 1,
        name: e.name,
        year: e.yearStart,
        era: e.eraName,
        words: countWords(e.description),
        paras: countParagraphs(e.description),
        locs: locList.length,
        locList,
        beats: countBeats(e.description),
        hasVariants: Array.isArray(e.variants) && e.variants.length > 1,
    };
    row.score = score(row);
    row.hints = suggestSplits(e, locList, row.paras, row.beats);
    return row;
});

const pct = (arr, p) => arr[Math.floor((arr.length * p) / 100)] || 0;
const words = rows.map((r) => r.words).sort((a, b) => a - b);
const paras = rows.map((r) => r.paras).sort((a, b) => a - b);
const locs = rows.map((r) => r.locs).sort((a, b) => a - b);
const beats = rows.map((r) => r.beats).sort((a, b) => a - b);

console.log(JSON.stringify({
    analyzed: rows.length,
    through: 'Failure at Sea',
    benchmarks: {
        words: { p50: pct(words, 50), p75: pct(words, 75), p90: pct(words, 90), max: words.at(-1) },
        paras: { p50: pct(paras, 50), p75: pct(paras, 75), p90: pct(paras, 90), max: paras.at(-1) },
        locs: { p50: pct(locs, 50), p75: pct(locs, 75), p90: pct(locs, 90), max: locs.at(-1) },
        beats: { p50: pct(beats, 50), p75: pct(beats, 75), p90: pct(beats, 90), max: beats.at(-1) },
    },
    candidates: rows
        .filter((r) => r.score >= 5 && r.words >= 100)
        .sort((a, b) => b.score - a.score || b.words - a.words)
        .map((r) => ({
            idx: r.idx,
            name: r.name,
            year: r.year,
            era: r.era,
            score: r.score,
            words: r.words,
            paras: r.paras,
            locs: r.locs,
            locList: r.locList,
            beats: r.beats,
            hasVariants: r.hasVariants,
            hints: r.hints,
        })),
    watchlist: rows
        .filter((r) => r.score >= 4 && r.score < 5 && r.words >= 90)
        .sort((a, b) => b.score - a.score || b.words - a.words)
        .map((r) => ({
            idx: r.idx,
            name: r.name,
            year: r.year,
            score: r.score,
            words: r.words,
            paras: r.paras,
            locs: r.locs,
            beats: r.beats,
        })),
}, null, 2));
