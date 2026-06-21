/**
 * Before the Crisis — 4-tier route segments (asker → job → reactor → epilogue).
 */

export const BEFORE_THE_CRISIS_CONVERSATION_ID = '96e1f389-2b35-4fa1-9d71-0eaacba132d5';

/** @typedef {{ key: string, hero?: string, label: string }} BeforeTheCrisisTierOption */

/** @type {BeforeTheCrisisTierOption[]} */
export const BEFORE_THE_CRISIS_ASKERS = [
    { key: 'reinhardt', hero: 'Reinhardt', label: 'Reinhardt asks' },
    { key: 'tracer', hero: 'Tracer', label: 'Tracer asks' },
    { key: 'zarya', hero: 'Zarya', label: 'Zarya asks' },
];

/** @type {BeforeTheCrisisTierOption[]} */
export const BEFORE_THE_CRISIS_JOBS = [
    { key: 'laser-tag', label: 'Laser tag payments' },
    { key: 'lifeguard', label: 'Water park lifeguard' },
    { key: 'coffee', label: 'Served coffee' },
    { key: 'tractor', label: 'Drove a tractor' },
    { key: 'sheep', label: 'Sheep massage' },
];

/** @type {BeforeTheCrisisTierOption[]} */
export const BEFORE_THE_CRISIS_REACTORS = [
    { key: 'dva', hero: 'D.Va', label: 'D.Va reacts' },
    { key: 'doomfist', hero: 'Doomfist', label: 'Doomfist reacts' },
    { key: 'roadhog', hero: 'Roadhog', label: 'Roadhog reacts' },
    { key: 'reinhardt', hero: 'Reinhardt', label: 'Reinhardt reacts' },
    { key: 'sigma', hero: 'Sigma', label: 'Sigma reacts' },
    { key: 'tracer', hero: 'Tracer', label: 'Tracer reacts' },
    { key: 'zarya', hero: 'Zarya', label: 'Zarya reacts' },
];

/** @type {BeforeTheCrisisTierOption[]} */
export const BEFORE_THE_CRISIS_EPILOGUES = [
    { key: 'genji', hero: 'Genji', label: 'Genji epilogue' },
    { key: 'ramattra', hero: 'Ramattra', label: 'Ramattra epilogue' },
];

/**
 * @typedef {{ asker: string, job: string, reactor: string, epilogue: string }} BeforeTheCrisisSegments
 */

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function isBeforeTheCrisisConversation(conversation) {
    return (
        conversation?.id === BEFORE_THE_CRISIS_CONVERSATION_ID ||
        String(conversation?.name || '').trim() === 'Before the Crisis'
    );
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function shouldUseTieredPathPicker(conversation) {
    return isBeforeTheCrisisConversation(conversation) && (conversation?.paths?.length || 0) > 0;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @returns {BeforeTheCrisisSegments|null}
 */
export function getPathSegments(path) {
    const segments = path?.segments;
    if (!segments || typeof segments !== 'object') return null;

    const asker = String(segments.asker || '').trim();
    const job = String(segments.job || '').trim();
    const reactor = String(segments.reactor || '').trim();
    const epilogue = String(segments.epilogue || '').trim();
    if (!asker || !job || !reactor || !epilogue) return null;

    return { asker, job, reactor, epilogue };
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} pathId
 * @returns {BeforeTheCrisisSegments|null}
 */
export function getSegmentsForPathId(conversation, pathId) {
    const path = (conversation?.paths || []).find((row) => row.id === pathId);
    if (!path) return null;
    return getPathSegments(path);
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {BeforeTheCrisisSegments} segments
 * @returns {string}
 */
export function findPathIdForSegments(conversation, segments) {
    const paths = conversation?.paths || [];
    const match = paths.find((path) => {
        const row = getPathSegments(path);
        if (!row) return false;
        return (
            row.asker === segments.asker &&
            row.job === segments.job &&
            row.reactor === segments.reactor &&
            row.epilogue === segments.epilogue
        );
    });
    return match?.id || '';
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} pathId
 * @returns {BeforeTheCrisisSegments}
 */
export function resolveSegmentsForPathId(conversation, pathId) {
    const fromPath = getSegmentsForPathId(conversation, pathId);
    if (fromPath) return fromPath;

    return {
        asker: BEFORE_THE_CRISIS_ASKERS[0].key,
        job: BEFORE_THE_CRISIS_JOBS[0].key,
        reactor: BEFORE_THE_CRISIS_REACTORS[0].key,
        epilogue: BEFORE_THE_CRISIS_EPILOGUES[0].key,
    };
}

/**
 * @param {BeforeTheCrisisTierOption[]} options
 * @returns {BeforeTheCrisisTierOption}
 */
export function pickRandomTierOption(options) {
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {BeforeTheCrisisSegments}
 */
export function pickRandomBeforeTheCrisisSegments(conversation) {
    return {
        asker: pickRandomTierOption(BEFORE_THE_CRISIS_ASKERS).key,
        job: pickRandomTierOption(BEFORE_THE_CRISIS_JOBS).key,
        reactor: pickRandomTierOption(BEFORE_THE_CRISIS_REACTORS).key,
        epilogue: pickRandomTierOption(BEFORE_THE_CRISIS_EPILOGUES).key,
    };
}
