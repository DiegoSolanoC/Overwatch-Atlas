#!/usr/bin/env node
/**
 * Scout new Hero Chatter from Midseason 5 + prior S4.5/S5 HeroVoice diffs
 * against timeline events for commentary placement suggestions (no writes).
 *
 * Usage: node scripts/_cache/scout-midseason-chatter-commentary.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
    buildChatterCommentaryLabel,
    isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../..');
const SNAP = path.join(
    os.homedir(),
    'OneDrive',
    'Escritorio',
    'interactions',
    'overwatch-atlas-audits',
    'herovoice-snapshots',
);

const BATCHES = [
    {
        id: 'midseason5',
        label: 'Midseason 5 (this extract)',
        file: path.join(
            SNAP,
            'diff_baseline_pre-next-extract_vs_post_after-next-extract',
            'focus-added-chatter.txt',
        ),
    },
    {
        id: 's4.5-s5',
        label: 'Season 4.5 + Season 5 (previous extract)',
        file: path.join(
            SNAP,
            'diff_baseline_pre-s4.5-s5_vs_post_after-s4.5-s5',
            'focus-added-chatter.txt',
        ),
    },
];

const GENERIC_CATS = new Set([
    'HealthPack',
    'HealthRestoredFriendly',
    'DamageBoosted',
    'Discorded',
    'NanoBoosted',
    'VotedEpic',
    'VotedLegendary',
    'EnemyResurrect',
    'KillStreak',
    'Multikill',
    'TeamKill',
    'Revenge',
    'MeleeEnemyKilledRemark',
    'LookingAtEarth',
    'OnFire',
    'Resurrected',
    'Turret',
    'Teleporter',
    'ShieldGenerator',
]);

/** Named figures / lore that make a chatter line commentary-worthy. */
const STORY_RE =
    /\b(Marzia|Vendetta|Emre|Niran|Fareeha|Akande|Elaine|Ogundimu|Pharah|Ana|Doomfist|Talon|Overwatch|Blackwatch|Omnic|Null\s*Sector|Shambali|Iris|Vishkar|Deadlock|Grand\s*Mesa|Rome|Gibraltar|Helix|Hashimoto|Kanezaka|Mondatta|Aurora|Anubis|Numbani|Busan|MEKA|Oasis|Suravasa|Lifeweaver|Doctrine|D\.?\s*Mon|Shion|Sierra|Domina|Juno|Mars|Reyes|Morrison|Winston|Tracer|Sojourn|Baptiste|Mauga|Hazard|Freja|Wuyang|Illari|Ramattra|Reaper|Widow|Sombra|Symmetra|Zenyatta|Mei|Kiriko|Genji|Hanzo|Ashe|Cassidy|Junker\s*Queen|Junkrat|Roadhog|Orisa|Echo|Sigma|Brigitte|Reinhardt|Torb|Mercy|Moira|Venture|L[uú]cio|Soldier|enhancement|atrophy|mortal\s+coil|eternity|requiem|fate|demise|legion|good\s+kitty|lost\s+your\s+way|comes?\s+to\s+her\s+senses|bested|challenge|grow\s+stronger|putting\s+you\s+away|adoring\s+fans|flare\s+for\s+the\s+dramatic|target\s+slip|nine\s+lives|potential|monk|license)\b/i;

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function parseAdded(file) {
    return fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((rel) => {
            const parts = rel.replace(/\\/g, '/').split('/');
            const hero = parts[0];
            const cat = parts[1];
            const rest = parts.slice(2).join('/');
            const base = parts[parts.length - 1];
            let spoken = base
                .replace(/^[0-9A-Fa-f]+\.[0-9A-Za-z]+-/i, '')
                .replace(/\.ogg$/i, '')
                .replace(/_/g, ' ');
            const meowFolder = rest.match(/\(([^)]*meow[^)]*)\)/i);
            if (meowFolder) spoken = `(${meowFolder[1]})`;
            return { rel, hero, cat, rest, spoken };
        });
}

function loadTheater() {
    const { conversations } = JSON.parse(
        fs.readFileSync(path.join(REPO, 'src/data/dialogue-theater/conversations.json'), 'utf8'),
    );
    /** @type {any[]} */
    const theater = [];
    const labelCounts = new Map();
    for (const row of conversations) {
        if (!isChatterEntry(row) || String(row.status || 'active') === 'removed') continue;
        for (const line of row.lines || []) {
            if (!isActiveChatterLineForCommentary(line)) continue;
            const hero = String(line.hero || row.name || '').trim();
            const base = buildChatterCommentaryLabel(hero, line.subtitles, line.disclaimer);
            if (!base) continue;
            const n = (labelCounts.get(base) || 0) + 1;
            labelCounts.set(base, n);
            const label = n === 1 ? base : `${base} (${n})`;
            theater.push({
                hero,
                text: String(line.subtitles || ''),
                voice: String(line.voice || ''),
                disclaimer: String(line.disclaimer || ''),
                id: String(line.id || ''),
                theaterId: String(row.id || ''),
                label,
                blob: `${hero} ${line.subtitles || ''} ${line.disclaimer || ''}`.toLowerCase(),
            });
        }
    }
    return theater;
}

function heroEq(a, b) {
    const na = norm(a).replace(/^dmon$/, 'dmon').replace(/^dva$/, 'dva');
    const nb = norm(b).replace(/^dmon$/, 'dmon').replace(/^dva$/, 'dva');
    return na === nb;
}

function findTheater(entry, theater) {
    const spokenN = norm(entry.spoken);
    const pool = theater.filter((t) => heroEq(t.hero, entry.hero));
    if (/meow/i.test(entry.spoken) || /meow/i.test(entry.rest)) {
        const kind = norm(entry.spoken);
        const hits = pool.filter((t) => {
            const tn = norm(t.text);
            return /meow/i.test(t.text) && (tn.includes(kind) || kind.includes(tn.slice(0, 12)));
        });
        return { match: hits[0] || null, multi: hits.length };
    }
    let hits = pool.filter((t) => {
        const tn = norm(t.text);
        const vn = norm(t.voice);
        return tn === spokenN || (spokenN.length > 12 && (vn.includes(spokenN.slice(0, 18)) || tn.includes(spokenN.slice(0, 18))));
    });
    if (!hits.length) {
        hits = pool.filter((t) => {
            const tn = norm(t.text);
            if (!tn || !spokenN) return false;
            return tn.includes(spokenN.slice(0, 20)) || spokenN.includes(tn.slice(0, 20));
        });
    }
    // Prefer lines whose disclaimer roughly matches category
    const catHint = String(entry.cat || '').toLowerCase();
    hits.sort((a, b) => {
        const as = norm(a.disclaimer).includes(catHint.slice(0, 6)) ? 0 : 1;
        const bs = norm(b.disclaimer).includes(catHint.slice(0, 6)) ? 0 : 1;
        return as - bs;
    });
    return { match: hits[0] || null, multi: hits.length };
}

function isStoryish(entry) {
    const blob = `${entry.hero} ${entry.cat} ${entry.spoken} ${entry.rest}`;
    if (/Jetpack Cat/i.test(entry.hero) && /meow/i.test(blob)) return false;
    if (STORY_RE.test(entry.spoken)) return true;
    if (GENERIC_CATS.has(entry.cat) && !STORY_RE.test(entry.spoken)) return false;
    if (/HeroSelect/i.test(entry.cat) && !STORY_RE.test(entry.spoken)) return false;
    if (/Match\/MatchStart|MatchStartTalk|Elimination|Respawn|Teammate/i.test(`${entry.cat}/${entry.rest}`)) {
        // Keep non-generic combat lines that name someone or have lore tone
        if (STORY_RE.test(blob)) return true;
        if (/Elimination|MatchStartTalk|Respawn|KillSeen/i.test(entry.cat + entry.rest) && entry.spoken.length > 18) {
            return STORY_RE.test(entry.spoken) || /[A-Z][a-z]+/.test(entry.spoken);
        }
    }
    return false;
}

function loadEvents() {
    const { events } = JSON.parse(
        fs.readFileSync(path.join(REPO, 'src/data/event-system/timeline-events.json'), 'utf8'),
    );
    return events.map((e, i) => {
        const page = Math.floor(i / 10) + 1;
        const sources = [];
        for (const s of e.sources || []) {
            if (s?.text) sources.push(String(s.text));
            for (const u of s?.urls || []) if (u) sources.push(String(u));
        }
        for (const v of e.variants || []) {
            for (const s of v?.sources || []) {
                if (s?.text) sources.push(String(s.text));
            }
            if (v?.description) sources.push(String(v.description));
            if (v?.name) sources.push(String(v.name));
        }
        const story = `${e.name || ''} ${e.description || ''} ${(e.heroFilterPlaces || [])
            .map((h) => h?.locationName || '')
            .join(' ')}`;
        return {
            index: i + 1,
            page,
            name: String(e.name || ''),
            year: e.yearStart,
            story,
            source: sources.join(' '),
            blob: `${story} ${sources.join(' ')}`.toLowerCase(),
            existing: collectCommentary(e),
        };
    });
}

function collectCommentary(e) {
    /** @type {string[]} */
    const names = [];
    const push = (c) => {
        if (c && typeof c === 'object') {
            const n = String(c.name || c.label || '').trim();
            if (n) names.push(n);
            return;
        }
        const n = String(c || '').trim();
        if (n) names.push(n);
    };
    if (Array.isArray(e.commentary)) e.commentary.forEach(push);
    for (const v of e.variants || []) {
        if (Array.isArray(v?.commentary)) v.commentary.forEach(push);
    }
    return names;
}

function usedCommentarySet(events) {
    const used = new Set();
    for (const e of events) {
        for (const n of e.existing) used.add(norm(n));
    }
    // also load used-commentary.json if present
    const usedPath = path.join(REPO, 'scripts/_cache/used-commentary.json');
    if (fs.existsSync(usedPath)) {
        const raw = JSON.parse(fs.readFileSync(usedPath, 'utf8'));
        for (const k of Object.keys(raw)) used.add(norm(k));
    }
    return used;
}

/** Keyword bags: chatter text → event blob */
const THEME_PAIRS = [
    [/marzia|vendetta|bested at your own|try again,? marzia|reclaiming talon|wolf'?s mouth|final verdict|reign of talon/i, /vendetta|marzia|talon|rome|wolf|final verdict|reign/i],
    [/emre|lost your way|what has happened to him|doctrine/i, /emre|doctrine|deliverance|shambali|iris|zenyatta|mondatta/i],
    [/fareeha|pharah|won'?t be so lucky.*fareeha|helix/i, /fareeha|pharah|helix|raptora|egypt|cairo/i],
    [/niran|lifeweaver|can'?t hide from me,? niran|suravasa/i, /niran|lifeweaver|suravasa|vishkar|architech/i],
    [/akande|doomfist|ogundimu|elaine|grow stronger|rise to my challenge|potential.*akande|rest in reverence,? akande/i, /akande|doomfist|ogundimu|talon|nuumbani|numbani|talon/i],
    [/domina|vishkar|adoring fans|embarrassment/i, /domina|vishkar|colosseo|rome|architect/i],
    [/ana|otta|honor.*otta|target slip|flare for the dramatic/i, /ana|amari|overwatch|cairo|egypt|widow|talon/i],
    [/good kitty|jetpack|juno|mars|stars|space/i, /juno|jetpack|mars|space|luna|satellite|teotihuacan|mexico/i],
    [/junker queen|junkertown|outback|flopping/i, /junker|junkertown|outback|australia|queen/i],
    [/sojourn|putting you away|long time|gibraltar|ijc/i, /sojourn|gibraltar|overwatch|ijc|justice/i],
    [/shion|hashimoto|kanezaka|tiger/i, /shion|hashimoto|kanezaka|japan|tiger/i],
    [/sierra|ashe|deadlock|grand mesa|cutting ties/i, /ashe|deadlock|sierra|grand mesa|cassidy/i],
    [/d\.?\s*mon|meka|busan|d\.?\s*va/i, /d\.?\s*mon|meka|busan|korea|d\.?\s*va/i],
    [/hazard|monk|keep away from the monk/i, /hazard|scrapyard|junker|scotland|glasgow/i],
    [/null sector|omnic|ramattra|iris|aurora/i, /null sector|omnic|ramattra|iris|aurora|uprising/i],
    [/baptiste|talon|coalition|caribbean/i, /baptiste|talon|caribbean|haiti/i],
    [/mauga|samoa|talon/i, /mauga|samoa|talon/i],
    [/tracer|overwatch|lena/i, /tracer|overwatch|london|king'?s row/i],
    [/winston|lunar|horizon|gorilla/i, /winston|horizon|lunar|gibraltar/i],
    [/reaper|reyes|blackwatch|death/i, /reaper|reyes|blackwatch|talon/i],
    [/sombra|dorado|los muertos/i, /sombra|dorado|mexico|los muertos/i],
    [/illari|inti|runasapi|carrion/i, /illari|inti|runasapi|peru/i],
    [/freja|vigilante|denmark/i, /freja|denmark|vigilante/i],
    [/wuyang|china|shore leave/i, /wuyang|china|coast/i],
    [/soldier|morrison|enhancement|sep/i, /soldier|morrison|enhancement|sep|bland/i],
    [/echo|mina|liao|china/i, /echo|mina|liao|china/i],
    [/mercy|angela|swiss|overwatch/i, /mercy|angela|switzerland|overwatch/i],
    [/genji|shimada|cyborg|hanzo/i, /genji|shimada|hanzo|japan/i],
    [/hanzo|shimada|dragon/i, /hanzo|shimada|dragon|japan/i],
    [/kiriko|kanezaka|fox|kitsune/i, /kiriko|kanezaka|fox|japan/i],
    [/orisa|numbani|efi|adawe/i, /orisa|numbani|efi|adawe/i],
    [/zarya|volskaya|russia/i, /zarya|volskaya|russia/i],
    [/mei|ecopoint|antarctica|climate/i, /mei|ecopoint|antarctica|climate/i],
    [/sigma|oasis|gravity|talha/i, /sigma|oasis|gravity|talha/i],
    [/roadhog|junkrat|australia/i, /roadhog|junkrat|australia|junkertown/i],
    [/brigitte|reinhardt|crusader|eichenwalde/i, /brigitte|reinhardt|crusader|eichenwalde|germany/i],
    [/torbj|torbjorn|turret|sweden/i, /torbj|sweden|turret/i],
    [/lucio|brazil|hard light|viskar/i, /l[uú]cio|brazil|rio|viskar/i],
    [/widow|amethyst|talon|france/i, /widow|talon|france|guillard/i],
    [/cassidy|cole|deadlock|blackwatch/i, /cassidy|cole|deadlock|blackwatch/i],
    [/venture|archaeology|wayfinder/i, /venture|archaeology|wayfinder/i],
    [/wrecking ball|hamster|junker/i, /wrecking ball|hamster|junkertown|horizon/i],
    [/bastion|omnic|forest|garnison/i, /bastion|omnic|forest|garnison/i],
];

function scoreEvent(chatterBlob, event) {
    let score = 0;
    const reasons = [];
    // Hero name in event
    const heroMatch = chatterBlob.match(/^([a-z0-9 .'-]+)/i);
    const hero = heroMatch ? heroMatch[1].trim() : '';
    if (hero && new RegExp(`\\b${hero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(event.blob)) {
        score += 3;
        reasons.push('hero in event');
    }
    for (const [cRe, eRe] of THEME_PAIRS) {
        if (cRe.test(chatterBlob) && eRe.test(event.blob)) {
            score += 4;
            reasons.push('theme');
            break;
        }
    }
    // Shared rare tokens
    const cTokens = String(chatterBlob)
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .filter((t) => t.length > 4);
    const stop = new Set([
        'about', 'their', 'there', 'these', 'those', 'would', 'could', 'should',
        'which', 'where', 'after', 'before', 'being', 'other', 'through', 'every',
        'never', 'always', 'still', 'again', 'because', 'while', 'around', 'against',
        'elimination', 'respawn', 'match', 'start', 'talk', 'teammate', 'scenario',
    ]);
    let shared = 0;
    for (const t of cTokens) {
        if (stop.has(t)) continue;
        if (event.blob.includes(t)) shared += 1;
    }
    if (shared >= 2) {
        score += Math.min(4, shared);
        reasons.push(`tokens:${shared}`);
    }
    // Prefer events with real story text over stubs
    if ((event.story || '').trim().length > 80) score += 1;
    if ((event.source || '').trim().length > 40) score += 1;
    return { score, reasons };
}

function pickPlacements(entry, theaterLine, events, used) {
    const blob = `${entry.hero} ${entry.spoken} ${theaterLine?.text || ''} ${theaterLine?.disclaimer || ''}`;
    /** @type {{ event: any, score: number, reasons: string[] }[]} */
    const ranked = [];
    for (const ev of events) {
        const { score, reasons } = scoreEvent(blob, ev);
        if (score < 5) continue;
        ranked.push({ event: ev, score, reasons });
    }
    ranked.sort((a, b) => b.score - a.score || a.event.index - b.event.index);
    return ranked.slice(0, 3).map((r) => ({
        event: `#${r.event.index} ${r.event.name}`,
        page: r.event.page,
        score: r.score,
        why: r.reasons.join(', '),
        alreadyHas: r.event.existing.length
            ? r.event.existing.slice(0, 3).join(' | ')
            : '',
    }));
}

function fitFromPlacements(placements, theaterFound) {
    if (!theaterFound) return 'missing';
    if (!placements.length) return 'none';
    if (placements[0].score >= 9) return 'strong';
    if (placements[0].score >= 6) return 'possible';
    return 'weak';
}

function main() {
    const theater = loadTheater();
    const events = loadEvents();
    const used = usedCommentarySet(events);

    /** @type {any} */
    const report = { generatedAt: new Date().toISOString(), batches: [] };

    for (const batch of BATCHES) {
        const rows = parseAdded(batch.file);
        const storyRows = [];
        const meowSamples = [];
        const meowKeys = new Set();

        for (const r of rows) {
            if (/Jetpack Cat/i.test(r.hero) && /meow/i.test(`${r.rest} ${r.spoken}`)) {
                const key = `${r.cat}|${(r.rest.match(/\([^)]+\)/) || [r.spoken])[0]}`;
                if (!meowKeys.has(key)) {
                    meowKeys.add(key);
                    meowSamples.push(r);
                }
                continue;
            }
            if (isStoryish(r)) storyRows.push(r);
        }

        // Deduplicate by hero+spoken
        const seen = new Set();
        const unique = [];
        for (const r of storyRows) {
            const k = `${norm(r.hero)}|${norm(r.spoken)}|${r.cat}`;
            if (seen.has(k)) continue;
            seen.add(k);
            unique.push(r);
        }

        const entries = [];
        for (const r of unique) {
            const found = findTheater(r, theater);
            const placements = pickPlacements(r, found.match, events, used);
            const label = found.match?.label || `${r.hero} · ${r.cat} — ${r.spoken}`;
            const alreadyUsed = used.has(norm(label)) || used.has(norm(found.match?.text || ''));
            entries.push({
                batch: batch.id,
                hero: r.hero,
                cat: r.cat,
                spoken: r.spoken,
                rel: r.rel,
                theaterLabel: found.match?.label || null,
                theaterId: found.match?.theaterId || null,
                lineId: found.match?.id || null,
                theaterHits: found.multi,
                fit: alreadyUsed ? 'used' : fitFromPlacements(placements, !!found.match),
                placements,
                alreadyUsed,
            });
        }

        // Sort: strong first, then possible, by hero
        const fitOrder = { strong: 0, possible: 1, weak: 2, used: 3, none: 4, missing: 5 };
        entries.sort(
            (a, b) =>
                (fitOrder[a.fit] ?? 9) - (fitOrder[b.fit] ?? 9)
                || a.hero.localeCompare(b.hero)
                || a.spoken.localeCompare(b.spoken),
        );

        report.batches.push({
            id: batch.id,
            label: batch.label,
            addedFiles: rows.length,
            storyishUnique: unique.length,
            meowSampleCount: meowSamples.length,
            meowSamples: meowSamples.map((r) => `${r.cat}: ${r.spoken}`),
            fitCounts: entries.reduce((acc, e) => {
                acc[e.fit] = (acc[e.fit] || 0) + 1;
                return acc;
            }, {}),
            entries,
        });
    }

    const outJson = path.join(__dirname, 'midseason-chatter-commentary-scout.json');
    fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);

    // Console summary
    for (const b of report.batches) {
        console.log(`\n=== ${b.label} ===`);
        console.log(`files=${b.addedFiles} storyish=${b.storyishUnique} meowTypes=${b.meowSampleCount}`);
        console.log('fits', b.fitCounts);
        const show = b.entries.filter((e) => e.fit === 'strong' || e.fit === 'possible');
        console.log(`strong+possible: ${show.length}`);
        for (const e of show.slice(0, 40)) {
            const pl = e.placements.map((p) => p.event).join(' · ');
            console.log(`  [${e.fit}] ${e.theaterLabel || e.spoken}`);
            console.log(`      → ${pl || '(no event)'}`);
        }
        if (show.length > 40) console.log(`  … +${show.length - 40} more`);
    }
    console.log(`\nWrote ${outJson}`);
}

main();
