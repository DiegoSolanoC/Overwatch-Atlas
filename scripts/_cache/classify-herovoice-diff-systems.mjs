/**
 * Classify a HeroVoice snapshot diff into dialogue / chatter / intel-phrase buckets.
 *
 * Usage:
 *   node scripts/_cache/classify-herovoice-diff-systems.mjs
 *   node scripts/_cache/classify-herovoice-diff-systems.mjs --diff <folderName>
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { auditPath, ensureAuditWorkspace } from '../lib/auditWorkspace.mjs';

const DIALOGUE = new Set(['MatchTalk']);
const PHRASE = new Set(['HeroSelect', 'Voicelines', 'Hello', 'Thanks', 'Ultimate']);
const CHATTER = new Set([
    'SetupHere',
    'HeroSelect',
    'MatchStartTalk',
    'Respawn',
    'NanoBoosted',
    'OnFire',
    'HealthPack',
    'DamageBoosted',
    'HealthRestoredFriendly',
    'Resurrected',
    'EnemyResurrect',
    'VotedEpic',
    'VotedLegendary',
    'Discorded',
    'Elimination',
    'KillStreak',
    'Multikill',
    'TeamKill',
    'Revenge',
    'MeleeEnemyKilledRemark',
    'LookingAtEarth',
    'Turret',
    'Teleporter',
    'ShieldGenerator',
    'Teammate',
    'Match',
]);

function parseArgs(argv) {
    let diff = '';
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--diff' && argv[i + 1]) diff = argv[++i];
    }
    return { diff };
}

function loadJsonl(file) {
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf8')
        .split(/\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

function classifyRel(rel) {
    const norm = String(rel || '').replace(/\\/g, '/');
    const parts = norm.split('/').filter(Boolean);
    const hero = parts[0] || '';
    const cat = parts[1] || '';
    const rest = parts.slice(1).join('/');

    const systems = new Set();
    if (DIALOGUE.has(cat)) systems.add('dialogue');
    if (PHRASE.has(cat)) systems.add('phrase');
    if (cat === 'Unknown' && rest.includes('11E1.078')) systems.add('phrase');
    if (CHATTER.has(cat)) {
        if (cat === 'Match') {
            if (/MatchStart(RoundWin|RoundLoss|FinalRound)/.test(rest)) systems.add('chatter');
        } else if (cat === 'Turret' || cat === 'Teleporter' || cat === 'ShieldGenerator') {
            if (/Enemy(Turret|Teleporter|ShieldGen)Destroyed/.test(rest)) systems.add('chatter');
        } else if (cat === 'Teammate') {
            if (/KillSeen/.test(rest)) systems.add('chatter');
        } else {
            systems.add('chatter');
        }
    }

    const special = [];
    if (hero === 'Bastion') special.push('bastion');
    if (hero === 'Jetpack Cat') special.push('jetpack');
    if (hero === 'Wrecking Ball') {
        special.push('wrecking-ball');
        if (/\.03F\./i.test(norm) || /\(hamster/i.test(norm)) special.push('hamster');
    }
    if (hero === 'Jetpack Cat' && /\.03F\./i.test(norm)) special.push('jetpack-03F');

    return { hero, cat, rest, systems: [...systems], special };
}

function bucket(rows) {
    const out = {
        dialogue: [],
        chatter: [],
        phrase: [],
        other: [],
        byHero: {},
        byCat: {},
        special: { bastion: [], jetpack: [], hamster: [] },
    };
    for (const row of rows) {
        const rel = row.rel || row.path || '';
        const c = classifyRel(rel);
        const entry = { rel, hero: c.hero, cat: c.cat, systems: c.systems };
        out.byHero[c.hero] = (out.byHero[c.hero] || 0) + 1;
        out.byCat[c.cat] = (out.byCat[c.cat] || 0) + 1;
        let placed = false;
        if (c.systems.includes('dialogue')) {
            out.dialogue.push(entry);
            placed = true;
        }
        if (c.systems.includes('chatter')) {
            out.chatter.push(entry);
            placed = true;
        }
        if (c.systems.includes('phrase')) {
            out.phrase.push(entry);
            placed = true;
        }
        if (!placed) out.other.push(entry);
        if (c.special.includes('bastion')) out.special.bastion.push(entry);
        if (c.special.includes('jetpack') || c.special.includes('jetpack-03F')) {
            out.special.jetpack.push(entry);
        }
        if (c.special.includes('hamster')) out.special.hamster.push(entry);
    }
    return out;
}

function top(obj, n = 15) {
    return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
}

function byHeroSystem(entries) {
    /** @type {Record<string, number>} */
    const map = {};
    for (const e of entries) map[e.hero] = (map[e.hero] || 0) + 1;
    return top(map, 25);
}

function byCatSystem(entries) {
    /** @type {Record<string, number>} */
    const map = {};
    for (const e of entries) map[e.cat] = (map[e.cat] || 0) + 1;
    return top(map, 25);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    ensureAuditWorkspace();
    const snapRoot = auditPath('herovoice-snapshots');

    let diffName = args.diff;
    if (!diffName) {
        const baseline = String(
            await fsp.readFile(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8'),
        ).trim();
        const post = String(
            await fsp.readFile(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8'),
        ).trim();
        diffName = `diff_${baseline}_vs_${post}`;
    }

    const diffRoot = path.join(snapRoot, diffName);
    if (!fs.existsSync(diffRoot)) {
        console.error(`Missing diff folder: ${diffRoot}`);
        process.exit(1);
    }

    const added = loadJsonl(path.join(diffRoot, 'added.jsonl'));
    const removed = loadJsonl(path.join(diffRoot, 'removed.jsonl'));
    const updated = loadJsonl(path.join(diffRoot, 'updated.jsonl'));
    const stale = loadJsonl(path.join(diffRoot, 'stale.jsonl'));

    const A = bucket(added);
    const R = bucket(removed);
    const U = bucket(updated);
    const S = bucket(stale);

    const summary = {
        diff: diffName,
        totals: {
            added: added.length,
            removed: removed.length,
            updated: updated.length,
        },
        added: {
            dialogue: A.dialogue.length,
            chatter: A.chatter.length,
            phrase: A.phrase.length,
            other: A.other.length,
            note: 'HeroSelect counts in both chatter + phrase',
            dialogueByHero: byHeroSystem(A.dialogue),
            chatterByHero: byHeroSystem(A.chatter),
            phraseByHero: byHeroSystem(A.phrase),
            dialogueByCat: byCatSystem(A.dialogue),
            chatterByCat: byCatSystem(A.chatter),
            phraseByCat: byCatSystem(A.phrase),
            topHeroesAll: top(A.byHero, 20),
            topCatsAll: top(A.byCat, 25),
            special: {
                bastion: A.special.bastion.length,
                jetpack: A.special.jetpack.length,
                hamster: A.special.hamster.length,
            },
        },
        removed: {
            dialogue: R.dialogue.length,
            chatter: R.chatter.length,
            phrase: R.phrase.length,
            other: R.other.length,
            dialogueByHero: byHeroSystem(R.dialogue),
            chatterByHero: byHeroSystem(R.chatter),
            phraseByHero: byHeroSystem(R.phrase),
            topHeroesAll: top(R.byHero, 20),
            topCatsAll: top(R.byCat, 25),
            note: 'Path-level removals only. Re-extracted same path → updated, not removed.',
        },
        updatedRelevant: {
            dialogue: U.dialogue.length,
            chatter: U.chatter.length,
            phrase: U.phrase.length,
            note: 'Same path, new hash/mtime — usually re-dump of existing lines, not new content.',
        },
        stale: {
            total: stale.length,
            dialogue: S.dialogue.length,
            chatter: S.chatter.length,
            phrase: S.phrase.length,
            other: S.other.length,
            note: 'Same path + same hash as baseline — extract did not touch these. HeroSelect counted in chatter + phrase.',
            exclusiveApprox: {
                dialogueMatchTalk: S.dialogue.length,
                chatterExcludingHeroSelect: S.chatter.filter((e) => e.cat !== 'HeroSelect').length,
                phraseExcludingHeroSelect: S.phrase.filter((e) => e.cat !== 'HeroSelect').length,
                heroSelectShared: S.chatter.filter((e) => e.cat === 'HeroSelect').length,
            },
            dialogueByHero: byHeroSystem(S.dialogue),
            chatterByHero: byHeroSystem(S.chatter),
            phraseByHero: byHeroSystem(S.phrase),
            dialogueByCat: byCatSystem(S.dialogue),
            chatterByCat: byCatSystem(S.chatter),
            phraseByCat: byCatSystem(S.phrase),
            otherTopCats: byCatSystem(S.other),
            topHeroesAll: top(S.byHero, 20),
            topCatsAll: top(S.byCat, 25),
        },
        samples: {
            dialogueNew: A.dialogue.slice(0, 20).map((e) => e.rel),
            chatterNew: A.chatter.slice(0, 20).map((e) => e.rel),
            phraseNew: A.phrase.slice(0, 20).map((e) => e.rel),
            bastionNew: A.special.bastion.slice(0, 12).map((e) => e.rel),
            jetpackNew: A.special.jetpack.slice(0, 12).map((e) => e.rel),
            hamsterNew: A.special.hamster.slice(0, 12).map((e) => e.rel),
            removedAny: removed.slice(0, 20).map((r) => r.rel),
            staleDialogue: S.dialogue.slice(0, 12).map((e) => e.rel),
            staleChatter: S.chatter.slice(0, 12).map((e) => e.rel),
            stalePhrase: S.phrase.slice(0, 12).map((e) => e.rel),
            staleOther: S.other.slice(0, 12).map((e) => e.rel),
        },
    };

    const outPath = path.join(diffRoot, 'system-classify.json');
    await fsp.writeFile(
        outPath,
        `${JSON.stringify(
            {
                summary,
                addedDialogue: A.dialogue.map((e) => e.rel),
                addedChatter: A.chatter.map((e) => e.rel),
                addedPhrase: A.phrase.map((e) => e.rel),
                removedDialogue: R.dialogue.map((e) => e.rel),
                removedChatter: R.chatter.map((e) => e.rel),
                removedPhrase: R.phrase.map((e) => e.rel),
                // Full stale path lists live in focus-stale-*.txt (too large for JSON).
            },
            null,
            2,
        )}\n`,
    );

    // Focus text reports per system
    const writeList = async (name, lines) => {
        await fsp.writeFile(path.join(diffRoot, name), `${lines.join('\n')}${lines.length ? '\n' : ''}`);
    };
    await writeList('focus-added-dialogue.txt', A.dialogue.map((e) => e.rel));
    await writeList('focus-added-chatter.txt', A.chatter.map((e) => e.rel));
    await writeList('focus-added-phrase.txt', A.phrase.map((e) => e.rel));
    await writeList('focus-removed-dialogue.txt', R.dialogue.map((e) => e.rel));
    await writeList('focus-removed-chatter.txt', R.chatter.map((e) => e.rel));
    await writeList('focus-removed-phrase.txt', R.phrase.map((e) => e.rel));
    await writeList('focus-stale-dialogue.txt', S.dialogue.map((e) => e.rel));
    await writeList('focus-stale-chatter.txt', S.chatter.map((e) => e.rel));
    await writeList('focus-stale-phrase.txt', S.phrase.map((e) => e.rel));
    await writeList('focus-stale-other.txt', S.other.map((e) => e.rel));

    console.log(JSON.stringify(summary, null, 2));
    console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
