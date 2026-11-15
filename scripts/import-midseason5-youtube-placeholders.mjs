#!/usr/bin/env node
/**
 * Midseason 5 YouTube interactions → theater:
 *  - path updates on existing multipath dialogues (D.Mon/Vendetta, Hazard bleach)
 *  - numbered placeholders built from MatchTalk lines (not caption fragments)
 *  - multi-interaction YouTube chapters split into separate dialogues
 *
 * Video: https://www.youtube.com/watch?v=6KAmomizYRQ
 *
 * Usage:
 *   node scripts/import-midseason5-youtube-placeholders.mjs --dry-run
 *   node scripts/import-midseason5-youtube-placeholders.mjs --replace
 *   node scripts/import-midseason5-youtube-placeholders.mjs --replace --write
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    createDialoguePathId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { auditPath, ensureAuditWorkspace } from './lib/auditWorkspace.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--write');
const doReplace = process.argv.includes('--replace');

const VIDEO = {
    id: '6KAmomizYRQ',
    era: 'Midseason 5 (YouTube placeholder)',
    url: 'https://www.youtube.com/watch?v=6KAmomizYRQ',
};

/**
 * Explicit dialogues in video order.
 * Each `lines` entry: { folder, needle } → MatchTalk hit.
 * Optional `paths`: multipath branches sharing an opener (+ optional closer).
 * `note` is only for the import report / console.
 */
const DIALOGUES = [
    {
        note: 'Vendetta & Ashe',
        lines: [
            { folder: 'Ashe', needle: 'Looks like I made the right call cutting ties' },
            { folder: 'Vendetta', needle: 'Your pathetic outfit will fall in its own time' },
            { folder: 'Ashe', needle: 'Aw sweetheart I don t think anyone needs your help' },
        ],
    },
    {
        note: 'Vendetta & Domina',
        lines: [
            { folder: 'Domina', needle: 'How unfortunate things ended up this way' },
            { folder: 'Vendetta', needle: 'How terrible for you' },
            { folder: 'Domina', needle: 'Oh don t fret darling it s nothing Vishkar' },
        ],
    },
    {
        note: 'Vendetta & Doomfist (1/2)',
        lines: [
            { folder: 'Doomfist', needle: 'You have great potential Marzia' },
            { folder: 'Vendetta', needle: 'When I face you again I will make you choke' },
            { folder: 'Doomfist', needle: 'I speak the truth You may not have achieved' },
        ],
    },
    {
        note: 'Vendetta & Doomfist (2/2)',
        lines: [
            { folder: 'Vendetta', needle: 'Are you satisfied Akande Reclaiming Talon' },
            { folder: 'Doomfist', needle: 'On the contrary Your crusade has proven' },
        ],
    },
    {
        note: 'Vendetta & Junker Queen',
        lines: [
            { folder: 'Junker Queen', needle: 'Ooh must sting yeah Schemin' },
            { folder: 'Vendetta', needle: 'Know that when you next fall prey' },
        ],
    },
    {
        note: 'Vendetta & Mauga',
        lines: [
            { folder: 'Mauga', needle: 'Well it was fun while it lasted' },
            { folder: 'Vendetta', needle: 'You mock me Malosi' },
            { folder: 'Mauga', needle: 'Easy boss I was being genuine' },
        ],
    },
    {
        note: 'Vendetta & Shion',
        lines: [
            { folder: 'Shion', needle: 'Good thing I ditched you' },
            { folder: 'Vendetta', needle: 'All you did was hide The Hashimoto' },
            { folder: 'Shion', needle: 'well neither were you' },
            { folder: 'Vendetta', needle: 'If you wish to goad me' },
        ],
    },
    {
        note: 'Vendetta & Sojourn',
        lines: [
            { folder: 'Sojourn', needle: 'You re going away for a long time Marzia' },
            { folder: 'Vendetta', needle: 'Don t waste your breath condemning me' },
        ],
    },
    {
        note: 'Vendetta & Sombra',
        lines: [
            { folder: 'Sombra', needle: 'Pobre Vendetta' },
            { folder: 'Vendetta', needle: 'Silence Infame' },
            { folder: 'Sombra', needle: 'those fangs of yours are looking a little dull' },
        ],
    },
    {
        note: 'Vendetta & Widowmaker',
        lines: [
            { folder: 'Widowmaker', needle: 'it seems your hunt has ended right where it began' },
            { folder: 'Vendetta', needle: 'And what of yours For all your' },
            { folder: 'Widowmaker', needle: 'Whatever shame I feel I take comfort' },
        ],
    },
    {
        note: 'Juno & Ashe',
        lines: [
            { folder: 'Juno', needle: 'You and your Big Omnic Buddy seem very close' },
            { folder: 'Ashe', needle: 'Me and him have been through thick and thin' },
        ],
    },
    {
        note: 'Juno & Doctrine',
        lines: [
            { folder: 'Juno', needle: 'I used to believe there was nothing I would not do' },
            { folder: 'Doctrine', needle: 'Such naivete is to be expected of a child' },
        ],
    },
    {
        note: 'Juno & Jetpack Cat',
        lines: [
            { folder: 'Juno', needle: 'I cannot help thinking I have seen you somewhere before' },
            { folder: 'Juno', needle: 'But I had only travelled to a few places before Brigitte' },
        ],
    },
    {
        note: 'Juno & Sierra',
        lines: [
            { folder: 'Sierra', needle: 'I just love looking up at the stars once I hit a summit' },
            { folder: 'Juno', needle: 'I always loved looking down at Earth from the top of Olympus' },
            { folder: 'Sierra', needle: 'you ll just have to take a picture for me' },
        ],
    },
    {
        note: 'Juno & Tracer',
        lines: [
            { folder: 'Tracer', needle: 'You ve come so far since you landed Juno' },
            { folder: 'Juno', needle: 'Maybe I could visit the Arcology' },
            { folder: 'Tracer', needle: 'Maybe Athena could help you pick' },
        ],
    },
    {
        note: 'Juno & Winston',
        lines: [
            { folder: 'Winston', needle: 'from one extraterrestrial to another' },
            { folder: 'Juno', needle: 'thanks to the guidance of my space' },
            { folder: 'Winston', needle: 'we ll both be out of this world' },
        ],
    },
    {
        note: 'Juno & Wrecking Ball',
        lines: [
            { folder: 'Juno', needle: 'Dr Chao said she would have made a different decision' },
            { folder: 'Wrecking Ball', needle: 'habit of abandoning projects' },
        ],
    },
    {
        note: 'Juno & Wuyang',
        lines: [
            { folder: 'Wuyang', needle: 'we could do more combat training simulations' },
            { folder: 'Juno', needle: 'Sierra invited me just the other day' },
            { folder: 'Wuyang', needle: 'I was hoping it would just be' },
        ],
    },
    {
        note: 'Juno & Zarya',
        lines: [
            { folder: 'Zarya', needle: 'how did you like your first post mission pierogis' },
            { folder: 'Juno', needle: 'like dumplings but with potato' },
            { folder: 'Zarya', needle: 'Then we will have many more' },
        ],
    },
    {
        note: 'Ana & Doctrine (1/2)',
        lines: [
            { folder: 'Ana', needle: 'I ve apprehended plenty of criminals' },
            { folder: 'Doctrine', needle: 'My brother s reaction was hyperbolically rash' },
            { folder: 'Ana', needle: 'you ll realize you can t decide for others someday' },
        ],
        // Alternate Doctrine reply to the same opener
        paths: {
            openerNeedle: 'I ve apprehended plenty of criminals',
            closerNeedle: 'you ll realize you can t decide for others someday',
            branches: [
                {
                    label: 'Hyperbolically rash',
                    lines: [{ folder: 'Doctrine', needle: 'My brother s reaction was hyperbolically rash' }],
                },
                {
                    label: 'Rash mistake',
                    lines: [{ folder: 'Doctrine', needle: 'My brother s outburst was a rash mistake' }],
                },
            ],
        },
    },
    {
        note: 'Ana & Doctrine (2/2)',
        lines: [
            { folder: 'Doctrine', needle: 'Has your proficiency waned over time' },
            { folder: 'Ana', needle: 'Your own age is getting to you' },
            { folder: 'Doctrine', needle: 'My clarity of mind greatly surpasses' },
        ],
    },
    {
        note: 'Ana & Lúcio',
        lines: [
            { folder: 'Lúcio', needle: 'You ever try performing' },
            { folder: 'Ana', needle: 'I had to pose as a lounge singer' },
        ],
    },
    {
        note: 'Ana & Reaper (1/3)',
        lines: [
            { folder: 'Ana', needle: 'When I heard you left Talon after Vendetta' },
            { folder: 'Reaper', needle: 'Sorry to disappoint' },
            { folder: 'Ana', needle: 'holding onto hope you might change' },
        ],
    },
    {
        note: 'Ana & Reaper (2/3)',
        lines: [
            { folder: 'Ana', needle: 'I ve been working with the daughter of an enhanced soldier' },
            { folder: 'Reaper', needle: 'Didn t think they let anyone use the serum anymore' },
            { folder: 'Ana', needle: 'yet she still shows all the signs' },
            { folder: 'Reaper', needle: 'It didn t until now' },
        ],
    },
    {
        note: 'Ana & Reaper (3/3)',
        lines: [
            { folder: 'Ana', needle: 'We spent years throwing Doctrine and his like into' },
            { folder: 'Reaper', needle: 'You locked them up once Just do it again' },
        ],
    },
    {
        note: 'Ana & Sierra',
        lines: [
            { folder: 'Ana', needle: 'You and Fareeha made a good team in Lagos' },
            { folder: 'Sierra', needle: 'I just love working with her too' },
        ],
    },
    {
        note: 'Sojourn & D.Mon',
        lines: [
            { folder: 'D.Mon', needle: 'MEKA owes you for having our backs' },
            { folder: 'Sojourn', needle: 'after your help in Rome I d say we can call it even' },
        ],
    },
    {
        note: 'Sojourn & Doomfist (1/2)',
        lines: [
            { folder: 'Sojourn', needle: 'it s not lost on me that you saved my life back in Rome' },
            { folder: 'Doomfist', needle: 'my respect for you was never in question' },
        ],
    },
    {
        note: 'Sojourn & Doomfist (2/2)',
        lines: [
            { folder: 'Sojourn', needle: 'Guessing I can t convince you to stand down' },
            { folder: 'Doomfist', needle: 'peace breeds complacency' },
            { folder: 'Sojourn', needle: 'We ll just have to do things the hard way' },
        ],
    },
    {
        note: 'Sojourn & Orisa (1/2)',
        lines: [
            { folder: 'Orisa', needle: 'You had Doomfist in your sights' },
            { folder: 'Sojourn', needle: 'I had to make a choice Orisa' },
            { folder: 'Orisa', needle: 'There are things more important than survival' },
        ],
    },
    {
        note: 'Sojourn & Orisa (2/2)',
        lines: [
            { folder: 'Orisa', needle: 'Efi and I looked up to you Sojourn' },
            { folder: 'Sojourn', needle: 'Real life isn t as simple as the cartoons' },
        ],
    },
    {
        note: 'Sojourn & Tracer',
        lines: [
            { folder: 'Tracer', needle: 'would it be all right if I took some shore leave' },
            { folder: 'Sojourn', needle: 'Yeah What for' },
            { folder: 'Tracer', needle: 'there s something I ve really been wanting to ask her' },
            { folder: 'Sojourn', needle: 'As long as I get an invite when the time comes' },
        ],
    },
    {
        note: 'Sojourn, Emre & Freja',
        lines: [
            { folder: 'Sojourn', needle: 'I wanted to think there was a good reason I saw you with Talon' },
            { folder: 'Emre', needle: 'Whatever you think of me Viv' },
            { folder: 'Freja', needle: 'I don t expect forgiveness these days' },
        ],
    },
    {
        note: 'D.Mon & Junker Queen',
        lines: [
            { folder: 'Junker Queen', needle: 'Next chance I get to bash your mech' },
            { folder: 'D.Mon', needle: 'having a screw loose' },
        ],
    },
    {
        note: 'D.Mon & Winston',
        lines: [
            { folder: 'Winston', needle: 'the mech you captured housed an intelligent hamster' },
            { folder: 'D.Mon', needle: 'literal space ape' },
            { folder: 'Winston', needle: 'give me a bit of credibility' },
        ],
    },
    {
        note: 'D.Mon & Wrecking Ball',
        lines: [
            { folder: 'D.Mon', needle: 'mess with Busan again and I ll shut you down' },
            { folder: 'Wrecking Ball', needle: 'defeat your robot squids' },
        ],
    },
    {
        note: 'Doomfist & Doctrine',
        lines: [
            { folder: 'Doomfist', needle: 'This gauntlet you ve crafted surpasses' },
            { folder: 'Doctrine', needle: 'wisdom of age comes without cost' },
        ],
    },
    {
        note: 'Doomfist & Orisa',
        lines: [
            { folder: 'Orisa', needle: 'Be grateful I was not there to greet you in Rome' },
            { folder: 'Doomfist', needle: 'The child has made you strong Orisa' },
        ],
    },
    {
        note: 'Doomfist & Sombra',
        lines: [
            { folder: 'Sombra', needle: 'geriatric soul sapper' },
            { folder: 'Doomfist', needle: 'uncovering information was your expertise' },
            { folder: 'Sombra', needle: 'I can t hack your brain' },
            { folder: 'Doomfist', needle: 'you still have room to improve' },
        ],
    },
    {
        note: 'Genji & Tracer',
        lines: [
            { folder: 'Tracer', needle: 'So glad you re finally back home' },
            { folder: 'Genji', needle: 'No matter where I go I will never forget our team' },
            { folder: 'Tracer', needle: 'flying everyone out to visit next time' },
        ],
    },
    {
        note: 'Genji & Winston',
        lines: [
            { folder: 'Winston', needle: 'reunite with your family after so long' },
            { folder: 'Genji', needle: 'Perhaps you can do the same one day' },
            { folder: 'Winston', needle: 'Hammond still sees me as family' },
            { folder: 'Genji', needle: 'even deep wounds can be mended with time' },
        ],
    },
    {
        note: 'Genji & Zenyatta',
        lines: [
            { folder: 'Genji', needle: 'The rift between Hanzo and I is slowly healing' },
            { folder: 'Zenyatta', needle: 'What he does not forgive in others' },
        ],
    },
    {
        note: 'Junker Queen & Winston',
        lines: [
            { folder: 'Junker Queen', needle: 'take my ship up to where you and the champ lived' },
            { folder: 'Winston', needle: 'Lunar Colony would not be easily accessible' },
            { folder: 'Junker Queen', needle: 'that s what the champ s for' },
        ],
    },
    {
        note: 'D.Va & Roadhog',
        lines: [
            { folder: 'Roadhog', needle: 'Busan was nice' },
            { folder: 'D.Va', needle: 'certain tourists didn t leave their junk' },
        ],
    },
];

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\[.*?\]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, '');
}

function norm(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function loadDiffNewMatchTalkRels() {
    ensureAuditWorkspace();
    const snapRoot = auditPath('herovoice-snapshots');
    const baseline = String(fs.readFileSync(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8')).trim();
    const post = String(fs.readFileSync(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8')).trim();
    const addedPath = path.join(snapRoot, `diff_${baseline}_vs_${post}`, 'added.jsonl');
    /** @type {Set<string>} */
    const set = new Set();
    if (!fs.existsSync(addedPath)) return set;
    for (const line of fs.readFileSync(addedPath, 'utf8').split(/\n/)) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);
        const rel = String(row.rel || '').replace(/\\/g, '/');
        if (/\/MatchTalk\//i.test(rel)) set.add(rel);
    }
    return set;
}

function indexMatchTalk(newRels) {
    /** @type {Array<object>} */
    const rows = [];
    if (!fs.existsSync(EXTRACT_ROOT)) return rows;
    const heroes = fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const heroEnt of heroes) {
        const walk = (dir) => {
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!/\.ogg$/i.test(ent.name) || !/\.0B2-/i.test(ent.name)) continue;
                const rel = path.relative(EXTRACT_ROOT, full).replace(/\\/g, '/');
                if (!rel.includes('/MatchTalk/')) continue;
                const m = ent.name.match(/\.0B2-(.+)\.ogg$/i);
                const label = m ? m[1] : ent.name;
                const key = coreKey(label);
                if (key.length < 6) continue;
                rows.push({
                    heroFolder: heroEnt.name,
                    label,
                    key,
                    rel,
                    source: full,
                    isNew: newRels.has(rel),
                });
            }
        };
        walk(path.join(EXTRACT_ROOT, heroEnt.name));
    }
    return rows;
}

function folderToHeroId(folder, manifestHeroes) {
    const map = {
        'D.Va': 'D.va',
        'D.Mon': 'D.mon',
        'Soldier_ 76': 'Soldier 76',
        Lucio: 'Lúcio',
    };
    if (map[folder]) return map[folder];
    return resolveManifestHeroId(folder, manifestHeroes) || folder;
}

function findHit(pool, folder, needle, { preferNew = true } = {}) {
    const want = coreKey(needle);
    if (want.length < 8) return null;
    const folderNorm = coreKey(folder);
    const heroRows = pool.filter((r) => coreKey(r.heroFolder) === folderNorm);
    let best = null;
    let bestScore = Infinity;
    for (const row of heroRows) {
        let score = Infinity;
        if (row.key === want) score = 0;
        else if (row.key.includes(want)) score = 1 + (row.key.length - want.length);
        else if (want.includes(row.key) && row.key.length >= 16) score = 2 + (want.length - row.key.length);
        else {
            // prefix overlap for truncated needles / labels with punctuation
            const n = Math.min(24, want.length, row.key.length);
            if (n >= 14 && (row.key.startsWith(want.slice(0, n)) || want.startsWith(row.key.slice(0, n)))) {
                score = 5 + Math.abs(row.key.length - want.length);
            }
        }
        if (score === Infinity) continue;
        if (preferNew && row.isNew) score -= 0.25;
        if (score < bestScore) {
            bestScore = score;
            best = row;
        }
    }
    return bestScore < 80 ? best : null;
}

function findByKeyIncludes(pool, heroFolder, needle) {
    return findHit(pool, heroFolder, needle, { preferNew: true });
}

function labelToSubtitles(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function atlasVoiceName(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = labelToSubtitles(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

async function copyVoice(hero, hit) {
    if (!hit) return '';
    const atlas = atlasVoiceName(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!dryRun) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    }
    return atlas;
}

function pickHeroicRenderForHero(heroName, rendersMap) {
    const list = rendersMap?.[heroName] || [];
    return list.find((name) => /heroic/i.test(name)) || list[0] || 'Heroic.png';
}

function makeLine(hero, subtitles, voice, render) {
    return {
        id: createDialogueLineId(),
        hero,
        voice: voice || '',
        voicePrefix: '',
        subtitles,
        render: render || 'Heroic.png',
        era: 'Overwatch',
        status: 'active',
    };
}

function fingerprint(lines) {
    return (lines || [])
        .map((l) => `${norm(l.hero)}|${norm(l.subtitles)}`)
        .filter((part) => !part.endsWith('|'))
        .join('||');
}

function isMidseasonPlaceholder(conv) {
    if (!conv || conv.entryType === 'chatter') return false;
    const name = String(conv.name || '');
    if (!/^\d+$/.test(name)) return false;
    const era = String(conv.eraName || '');
    const tags = Array.isArray(conv.tags) ? conv.tags.map(String) : [];
    if (era.includes('Midseason 5') || tags.some((t) => t.includes('Midseason 5'))) return true;
    // Prior import cleared era/tags while auditing — treat pure-number actives in the
    // known Midseason batch range as replaceable when --replace is set.
    const n = Number(name);
    return n >= 1 && n <= 80;
}

async function updateHopeFromOurPeople(conversations, pool, rendersMap) {
    const conv = conversations.find((c) => c.name === 'Hope from our people');
    if (!conv) throw new Error('Missing conversation: Hope from our people');

    const hit = findByKeyIncludes(pool, 'Vendetta', 'Celebrate then It is back in your care');
    if (!hit) {
        console.warn('[path] Hope from our people — new Vendetta Celebrate line not found in extract');
        return { ok: false };
    }

    const already = (conv.lines || []).some((l) => /celebrate,? then/i.test(String(l.subtitles || '')));
    if (already) {
        console.log('[path] Hope from our people — Celebrate path already present');
        return { ok: true, skipped: true };
    }

    const opener = (conv.lines || []).find((l) => /EMP was designed/i.test(String(l.subtitles || '')));
    const oldReply = (conv.lines || []).find((l) => /wasted your arsenal/i.test(String(l.subtitles || '')));
    if (!opener || !oldReply) {
        console.warn('[path] Hope from our people — unexpected line layout');
        return { ok: false };
    }

    const voice = await copyVoice('Vendetta', hit);
    const newReply = makeLine(
        'Vendetta',
        labelToSubtitles(hit.label),
        voice,
        pickHeroicRenderForHero('Vendetta', rendersMap),
    );
    conv.lines.push(newReply);

    const oldPathLabel = 'Arsenal / true strength';
    const newPathLabel = 'Celebrate then';
    const existingPaths = Array.isArray(conv.paths) ? conv.paths : [];
    if (existingPaths.length === 0) {
        conv.paths = [
            {
                id: createDialoguePathId(),
                label: oldPathLabel,
                lineIds: [opener.id, oldReply.id],
            },
            {
                id: createDialoguePathId(),
                label: newPathLabel,
                lineIds: [opener.id, newReply.id],
            },
        ];
    } else {
        conv.paths.push({
            id: createDialoguePathId(),
            label: newPathLabel,
            lineIds: [opener.id, newReply.id],
        });
    }
    console.log(`[path] Hope from our people — added path "${newPathLabel}"`);
    return { ok: true, voice };
}

async function updateLovingTheBleachLook(conversations, pool, rendersMap) {
    const conv = conversations.find((c) => c.name === 'Loving the Bleach look');
    if (!conv) throw new Error('Missing conversation: Loving the Bleach look');

    const opener = (conv.lines || []).find((l) => /bleached look/i.test(String(l.subtitles || '')));
    const closer = (conv.lines || []).find((l) => /looks class/i.test(String(l.subtitles || '')));
    if (!opener || !closer) {
        console.warn('[path] Loving the Bleach look — missing opener/closer');
        return { ok: false };
    }

    const additions = [
        {
            hero: 'Ana',
            folder: 'Ana',
            needle: 'No this comes with experience',
            label: 'Comes with experience',
        },
        {
            hero: 'Soldier 76',
            folder: 'Soldier_ 76',
            needle: 'Give it a few years kid',
            label: 'Give it a few years',
        },
        {
            hero: 'Roadhog',
            folder: 'Roadhog',
            needle: 'Thanks Yeah',
            label: 'Thanks Yeah',
        },
    ];

    if (!Array.isArray(conv.paths)) conv.paths = [];
    let added = 0;

    for (const spec of additions) {
        const exists = (conv.lines || []).some(
            (l) =>
                String(l.hero || '').toLowerCase() === spec.hero.toLowerCase()
                && coreKey(l.subtitles).includes(coreKey(spec.needle).slice(0, 18)),
        );
        if (exists) {
            console.log(`[path] Loving the Bleach look — ${spec.hero} path already present`);
            continue;
        }
        const hit = findByKeyIncludes(pool, spec.folder, spec.needle);
        if (!hit) {
            console.warn(`[path] Loving the Bleach look — no MatchTalk for ${spec.hero}`);
            continue;
        }
        const voice = await copyVoice(spec.hero, hit);
        const line = makeLine(
            spec.hero,
            labelToSubtitles(hit.label),
            voice,
            pickHeroicRenderForHero(spec.hero, rendersMap),
        );
        conv.lines.push(line);
        conv.paths.push({
            id: createDialoguePathId(),
            label: spec.label,
            lineIds: [opener.id, line.id, closer.id],
        });
        added += 1;
        console.log(`[path] Loving the Bleach look — added path "${spec.label}" (${spec.hero})`);
    }
    return { ok: true, added };
}

async function resolveLine(spec, pool, manifestHeroes, rendersMap) {
    const hit = findHit(pool, spec.folder, spec.needle);
    if (!hit) return { ok: false, missing: `${spec.folder} :: ${spec.needle}` };
    const hero = folderToHeroId(hit.heroFolder, manifestHeroes);
    const voice = await copyVoice(hero, hit);
    return {
        ok: true,
        line: makeLine(hero, labelToSubtitles(hit.label), voice, pickHeroicRenderForHero(hero, rendersMap)),
        hit,
    };
}

async function buildDialogue(spec, pool, manifestHeroes, rendersMap) {
    /** @type {object[]} */
    const lines = [];
    /** @type {string[]} */
    const missing = [];

    if (spec.paths) {
        const openerRes = await resolveLine(
            { folder: spec.lines[0].folder, needle: spec.paths.openerNeedle },
            pool,
            manifestHeroes,
            rendersMap,
        );
        if (!openerRes.ok) {
            missing.push(openerRes.missing);
            return { ok: false, missing, lines: [] };
        }
        lines.push(openerRes.line);

        /** @type {Array<{ label: string, lineIds: string[] }>} */
        const pathDefs = [];
        for (const branch of spec.paths.branches) {
            const branchIds = [openerRes.line.id];
            for (const bl of branch.lines) {
                const res = await resolveLine(bl, pool, manifestHeroes, rendersMap);
                if (!res.ok) {
                    missing.push(res.missing);
                    continue;
                }
                // Avoid duplicating identical line objects when shared later
                const existing = lines.find((l) => l.id === res.line.id || fingerprint([l]) === fingerprint([res.line]));
                if (existing) {
                    branchIds.push(existing.id);
                } else {
                    lines.push(res.line);
                    branchIds.push(res.line.id);
                }
            }
            pathDefs.push({ label: branch.label, lineIds: branchIds });
        }

        if (spec.paths.closerNeedle) {
            const closerRes = await resolveLine(
                {
                    folder: spec.lines[spec.lines.length - 1].folder,
                    needle: spec.paths.closerNeedle,
                },
                pool,
                manifestHeroes,
                rendersMap,
            );
            if (!closerRes.ok) missing.push(closerRes.missing);
            else {
                lines.push(closerRes.line);
                for (const p of pathDefs) p.lineIds.push(closerRes.line.id);
            }
        }

        return {
            ok: missing.length === 0 && lines.length >= 2,
            missing,
            lines,
            paths: pathDefs.map((p) => ({
                id: createDialoguePathId(),
                label: p.label,
                lineIds: p.lineIds,
            })),
        };
    }

    for (const row of spec.lines) {
        const res = await resolveLine(row, pool, manifestHeroes, rendersMap);
        if (!res.ok) {
            missing.push(res.missing);
            continue;
        }
        lines.push(res.line);
    }
    return { ok: missing.length === 0 && lines.length >= 2, missing, lines, paths: null };
}

async function main() {
    const manifestHeroes = await loadManifestHeroIds();
    const newRels = loadDiffNewMatchTalkRels();
    const pool = indexMatchTalk(newRels);
    console.log(`MatchTalk index: ${pool.length} (new=${pool.filter((r) => r.isNew).length})`);
    console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}${doReplace ? ' + REPLACE placeholders' : ''}`);

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    let conversations = Array.isArray(raw) ? raw : raw.conversations || [];
    const assets = await scanTheaterAssets();
    const rendersMap = assets.rendersByHero || {};

    console.log(`\n=== Path updates ===`);
    await updateHopeFromOurPeople(conversations, pool, rendersMap);
    await updateLovingTheBleachLook(conversations, pool, rendersMap);

    if (doReplace) {
        const before = conversations.length;
        conversations = conversations.filter((c) => !isMidseasonPlaceholder(c));
        console.log(`\n=== Replace ===`);
        console.log(`Removed Midseason placeholders: ${before - conversations.length}`);
    }

    console.log(`\n=== New placeholders (${DIALOGUES.length} dialogues) ===`);
    /** @type {string[]} */
    const addedNames = [];
    /** @type {string[]} */
    const skipped = [];
    /** @type {string[]} */
    const problems = [];
    let nextNum = nextConversationNumber(conversations);

    for (const spec of DIALOGUES) {
        const built = await buildDialogue(spec, pool, manifestHeroes, rendersMap);
        if (!built.ok) {
            problems.push(`${spec.note}: missing ${built.missing.join('; ')}`);
            console.warn(`  ! ${spec.note} — missing lines`);
            for (const m of built.missing) console.warn(`      ${m}`);
            continue;
        }

        const fp = fingerprint(built.lines);
        const dup = conversations.find(
            (c) => c.entryType !== 'chatter' && c.status !== 'removed' && fingerprint(c.lines) === fp,
        );
        if (dup) {
            skipped.push(`${spec.note} ≈ ${dup.name}`);
            console.log(`  ~ skip ${spec.note} ≈ ${dup.name}`);
            continue;
        }

        const name = String(nextNum);
        nextNum += 1;
        const conv = buildBlankConversationRecord();
        conv.name = name;
        conv.eraName = VIDEO.era;
        conv.tags = ['Overwatch', 'Midseason 5'];
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = built.lines;
        if (built.paths?.length) conv.paths = built.paths;
        conversations.push(conv);
        addedNames.push(`${name} ← ${spec.note} (${built.lines.length} lines${built.paths ? `, ${built.paths.length} paths` : ''})`);
        console.log(
            `  + ${name}  ${spec.note}  lines=${built.lines.length}${built.paths ? ` paths=${built.paths.length}` : ''}`,
        );
    }

    if (!dryRun) {
        const payload = Array.isArray(raw) ? conversations : { ...raw, conversations };
        await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
        const assetsOut = await scanTheaterAssets();
        await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assetsOut, null, 2)}\n`);
    }

    console.log(`\nDone (${dryRun ? 'DRY RUN' : 'WRITE'}).`);
    console.log(`  placeholders added: ${addedNames.length}`);
    console.log(`  skipped dupes: ${skipped.length}`);
    console.log(`  problems: ${problems.length}`);

    const reportDir = (() => {
        ensureAuditWorkspace();
        const snapRoot = auditPath('herovoice-snapshots');
        const baseline = String(fs.readFileSync(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8')).trim();
        const post = String(fs.readFileSync(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8')).trim();
        return path.join(snapRoot, `diff_${baseline}_vs_${post}`);
    })();
    await fsp.writeFile(
        path.join(reportDir, 'midseason5-import-report.json'),
        `${JSON.stringify(
            {
                video: VIDEO,
                mode: { dryRun, doReplace },
                pathUpdates: [
                    'Hope from our people (new Vendetta Celebrate path)',
                    'Loving the Bleach look (Ana / Soldier 76 / Roadhog paths)',
                ],
                splits: [
                    'Vendetta & Doomfist → 2',
                    'Ana & Doctrine → 2 (+ Doctrine multipath on #1)',
                    'Ana & Reaper → 3',
                    'Sojourn & Doomfist → 2',
                    'Sojourn & Orisa → 2',
                ],
                addedNames,
                skipped,
                problems,
            },
            null,
            2,
        )}\n`,
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
