#!/usr/bin/env node
/**
 * Repair "Before the Crisis" — 4-tier multi-route (3×5×7×2 = 210 paths).
 *
 * Usage:
 *   node scripts/import-before-the-crisis-paths.mjs
 *   node scripts/import-before-the-crisis-paths.mjs --dry-run
 */

import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const CONVERSATION_ID = '96e1f389-2b35-4fa1-9d71-0eaacba132d5';
const DUPLICATE_CONVERSATION_ID = '65b52ed1-2d07-4507-92a9-49d3b253100e';

/** @type {Record<string, string>} */
const LINE_IDS = {
    askerReinhardt: 'f14b37a1-ee79-486e-80aa-ed07b3e6276f',
    askerTracer: '6c38c78a-357f-4971-bcf4-7e0c6447f607',
    askerZarya: '668f23d0-ad7a-4efe-b97b-e88028176caa',
    jobLaserTag: '6d89aa5d-98e1-4af4-810e-4bfc198d5337',
    jobLifeguard: 'a1b2c3d4-e001-4000-8000-000000000001',
    jobCoffee: 'a1b2c3d4-e001-4000-8000-000000000002',
    jobTractor: 'a1b2c3d4-e001-4000-8000-000000000003',
    jobSheep: 'a1b2c3d4-e001-4000-8000-000000000004',
    reactDva: 'a1b2c3d4-e002-4000-8000-000000000001',
    reactDoomfist: 'a1b2c3d4-e002-4000-8000-000000000002',
    reactReinhardt: 'a1b2c3d4-e002-4000-8000-000000000003',
    reactRoadhog: 'a1b2c3d4-e002-4000-8000-000000000004',
    reactSigma: 'a1b2c3d4-e002-4000-8000-000000000005',
    reactTracer: '77362c97-5f54-4ada-bf01-3609e612ce5b',
    reactZarya: 'e2c14d0d-5969-4e08-ac85-df5d447bc007',
    epilogueGenji: 'c9ae357a-4709-4cb6-afbc-e2f8d5d0f3f2',
    epilogueRamattra: '8bad3fc3-bbea-44ca-8747-f8be4ec08ac6',
};

const ASKERS = [
    { key: 'reinhardt', hero: 'Reinhardt', lineId: LINE_IDS.askerReinhardt },
    { key: 'tracer', hero: 'Tracer', lineId: LINE_IDS.askerTracer },
    { key: 'zarya', hero: 'Zarya', lineId: LINE_IDS.askerZarya },
];

const JOBS = [
    { key: 'laser-tag', lineId: LINE_IDS.jobLaserTag, label: 'Laser tag' },
    { key: 'lifeguard', lineId: LINE_IDS.jobLifeguard, label: 'Lifeguard' },
    { key: 'coffee', lineId: LINE_IDS.jobCoffee, label: 'Coffee' },
    { key: 'tractor', lineId: LINE_IDS.jobTractor, label: 'Tractor' },
    { key: 'sheep', lineId: LINE_IDS.jobSheep, label: 'Sheep massage' },
];

const REACTORS = [
    { key: 'dva', hero: 'D.Va', lineId: LINE_IDS.reactDva },
    { key: 'doomfist', hero: 'Doomfist', lineId: LINE_IDS.reactDoomfist },
    { key: 'roadhog', hero: 'Roadhog', lineId: LINE_IDS.reactRoadhog },
    { key: 'reinhardt', hero: 'Reinhardt', lineId: LINE_IDS.reactReinhardt },
    { key: 'sigma', hero: 'Sigma', lineId: LINE_IDS.reactSigma },
    { key: 'tracer', hero: 'Tracer', lineId: LINE_IDS.reactTracer },
    { key: 'zarya', hero: 'Zarya', lineId: LINE_IDS.reactZarya },
];

const EPILOGUES = [
    { key: 'genji', hero: 'Genji', lineId: LINE_IDS.epilogueGenji },
    { key: 'ramattra', hero: 'Ramattra', lineId: LINE_IDS.epilogueRamattra },
];

/** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine[]} */
const LINES = [
    {
        id: LINE_IDS.askerReinhardt,
        hero: 'Reinhardt',
        voice: 'Reinhardt_-_What_did_you_do,_you_know,_before_the_Crisis.ogg',
        subtitles: 'What did you do, you know, before the Crisis?',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.askerTracer,
        hero: 'Tracer',
        voice: "Tracer_-_Tekhartha_Zenyatta,_if_you_don't_mind_me_asking..._what_did_you_do_before_the_Crisis.ogg",
        subtitles: "Tekhartha Zenyatta. If you don't mind me asking, what did you do before the Crisis?",
        render: '',
    },
    {
        id: LINE_IDS.askerZarya,
        hero: 'Zarya',
        voice: 'Zarya_-_What_was_your_function_before_the_Crisis.ogg',
        subtitles: 'What was your function before the Crisis?',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.jobLaserTag,
        hero: 'Zenyatta',
        voice: 'Zenyatta_-_I_collected_payments_at_a_laser_tag_arena.ogg',
        subtitles: 'I collected payments at a laser tag arena.',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.jobLifeguard,
        hero: 'Zenyatta',
        voice: 'Zenyatta_-_I_was_a_life_guard._At_a_water_park.ogg',
        subtitles: 'I was a lifeguard at a water park.',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.jobCoffee,
        hero: 'Zenyatta',
        voice: 'Zenyatta_-_I_served_coffee.ogg',
        subtitles: 'I served coffee.',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.jobTractor,
        hero: 'Zenyatta',
        voice: 'Zenyatta_-_I_drove_a_tractor.ogg',
        subtitles: 'I drove a tractor.',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.jobSheep,
        hero: 'Zenyatta',
        voice: 'Zenyatta_-_I_massaged_sheep_on_a_free-range_pasture.ogg',
        subtitles: 'I massaged sheep on a free-range pasture.',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.reactDva,
        hero: 'D.Va',
        voice: 'D.Va_-_Wait,_for_real.ogg',
        subtitles: 'Wait, for real?',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.reactDoomfist,
        hero: 'Doomfist',
        voice: 'Doomfist_-_Is_that_true.ogg',
        subtitles: 'Is that true?',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.reactRoadhog,
        hero: 'Roadhog',
        voice: 'Roadhog_-_Really.ogg',
        subtitles: 'Really?',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.reactReinhardt,
        hero: 'Reinhardt',
        voice: 'Reinhardt_-_Is_that_true.ogg',
        subtitles: '**chuckling** Is that true?',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.reactSigma,
        hero: 'Sigma',
        voice: 'Sigma_-_Could_that_be.ogg',
        subtitles: 'Could that be?',
        render: '',
    },
    {
        id: LINE_IDS.reactTracer,
        hero: 'Tracer',
        voice: 'Tracer_-_Seriously.ogg',
        subtitles: 'Seriously?',
        render: '',
    },
    {
        id: LINE_IDS.reactZarya,
        hero: 'Zarya',
        voice: 'Zarya_-_Really.ogg',
        subtitles: 'Really?',
        render: 'Heroic.png',
    },
    {
        id: LINE_IDS.epilogueGenji,
        hero: 'Genji',
        voice: "Genji_-_He_won't_tell_me_either.ogg",
        subtitles: "He won't tell me either.",
        render: '',
    },
    {
        id: LINE_IDS.epilogueRamattra,
        hero: 'Ramattra',
        voice: "Ramattra_-_Ha!_I_don't_think_so._But_he_wouldn't_tell_me_either.ogg",
        subtitles: "Ha! I don't think so, but he wouldn't tell me either.",
        render: 'Heroic.png',
    },
];

/**
 * @param {string} asker
 * @param {string} job
 * @param {string} reactor
 * @param {string} epilogue
 */
function pathIdFor(asker, job, reactor, epilogue) {
    const hash = createHash('sha256')
        .update(`before-the-crisis:${asker}:${job}:${reactor}:${epilogue}`)
        .digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    return { dryRun: argv.includes('--dry-run') };
}

/**
 * @returns {Promise<void>}
 */
async function main() {
    const { dryRun } = parseArgs(process.argv.slice(2));
    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : raw;

    const index = conversations.findIndex((row) => row?.id === CONVERSATION_ID);
    if (index < 0) {
        throw new Error(`Conversation not found: ${CONVERSATION_ID}`);
    }

    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]} */
    const paths = [];

    for (const asker of ASKERS) {
        for (const job of JOBS) {
            for (const reactor of REACTORS) {
                for (const epilogue of EPILOGUES) {
                    paths.push({
                        id: pathIdFor(asker.key, job.key, reactor.key, epilogue.key),
                        label: `${asker.hero} — ${job.label} — ${reactor.hero} — ${epilogue.hero}`,
                        lineIds: [asker.lineId, job.lineId, reactor.lineId, epilogue.lineId],
                        segments: {
                            asker: asker.key,
                            job: job.key,
                            reactor: reactor.key,
                            epilogue: epilogue.key,
                        },
                    });
                }
            }
        }
    }

    paths.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));

    const updated = {
        ...conversations[index],
        name: 'Before the Crisis',
        status: 'active',
        lines: LINES,
        paths,
        selectedPathId: paths[0].id,
    };

    conversations[index] = updated;

    const filtered = conversations.filter((row) => row?.id !== DUPLICATE_CONVERSATION_ID);
    if (filtered.length !== conversations.length) {
        console.log(`Removed duplicate conversation ${DUPLICATE_CONVERSATION_ID} ("942")`);
    }

    const output = Array.isArray(raw?.conversations)
        ? { ...raw, conversations: filtered }
        : filtered;

    console.log(`Before the Crisis: ${LINES.length} lines, ${paths.length} paths`);

    if (dryRun) {
        console.log('Dry run — no files written.');
        console.log('Sample path:', paths[0]);
        return;
    }

    await fs.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${CONVERSATIONS_PATH}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
