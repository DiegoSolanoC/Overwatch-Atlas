/**
 * Chatter line filters (wiki-shaped):
 *   - Era:    Overwatch | Classic     (exactly one)
 *   - Status: Active | Removed        (exactly one)
 *   - Group:  Chatter | Eliminations | Skin | Map | Event
 *   - Kind:   situation within that group (Skin/Map/Event use `all`)
 *
 * Non-Languages (gasps / death sounds / etc.) are intentionally not filtered
 * here yet — keep for a later pass.
 */

import {
    DIALOGUE_THEATER_ERA_CLASSIC,
    getDialogueLineEra,
    getDialogueLineStatus,
} from '../dialogue-theater-list/dialogueTheaterEraFilter.js';

/** @typedef {'overwatch'|'classic'} ChatterEraId */
/** @typedef {'active'|'removed'} ChatterStatusId */
/** @typedef {'chatter'|'eliminations'|'skin'|'map'|'event'} ChatterGroupId */

/**
 * @typedef {
 *   | 'setup'
 *   | 'match-start'
 *   | 'won-round'
 *   | 'lost-round'
 *   | 'final-round'
 *   | 'respawn'
 *   | 'waiting'
 *   | 'perk'
 *   | 'buffs'
 *   | 'nano-boosted'
 *   | 'negative-status'
 *   | 'resurrected'
 *   | 'enemy-revived'
 *   | 'voted'
 *   | 'final-blow'
 *   | 'kill-streak'
 *   | 'multi'
 *   | 'team'
 *   | 'revenge'
 *   | 'melee'
 *   | 'environmental'
 *   | 'deployable'
 *   | 'compliment'
 *   | 'all'
 * } ChatterKindId
 */

/**
 * @typedef {{
 *   era: ChatterEraId,
 *   status: ChatterStatusId,
 *   group: ChatterGroupId,
 *   kind: ChatterKindId,
 * }} ChatterFilterSelection
 */

/** @type {{ id: ChatterEraId, label: string }[]} */
export const CHATTER_ERA_OPTIONS = [
    { id: 'overwatch', label: 'Overwatch' },
    { id: 'classic', label: 'Classic' },
];

/** @type {{ id: ChatterStatusId, label: string }[]} */
export const CHATTER_STATUS_OPTIONS = [
    { id: 'active', label: 'Active' },
    { id: 'removed', label: 'Removed' },
];

/** @type {{ id: ChatterGroupId, label: string }[]} */
export const CHATTER_GROUP_OPTIONS = [
    { id: 'chatter', label: 'Chatter' },
    { id: 'eliminations', label: 'Eliminations' },
    { id: 'skin', label: 'Skin Specific' },
    { id: 'map', label: 'Map Specific' },
    { id: 'event', label: 'Event Specific' },
];

/** @type {Record<ChatterGroupId, { id: ChatterKindId, label: string }[]>} */
export const CHATTER_KIND_OPTIONS_BY_GROUP = {
    chatter: [
        { id: 'setup', label: 'Set Up' },
        { id: 'match-start', label: 'Match Start' },
        { id: 'won-round', label: 'Won Round' },
        { id: 'lost-round', label: 'Lost Round' },
        { id: 'final-round', label: 'Final Round' },
        { id: 'respawn', label: 'Respawn' },
        { id: 'waiting', label: 'Waiting' },
        { id: 'perk', label: 'Perk Selected' },
        { id: 'buffs', label: 'Healed / Boosted / Pack / On Fire' },
        { id: 'nano-boosted', label: 'Nano Boosted' },
        { id: 'negative-status', label: 'Negative Status' },
        { id: 'resurrected', label: 'Resurrected' },
        { id: 'enemy-revived', label: 'Enemy Revived' },
        { id: 'voted', label: 'Voted' },
    ],
    eliminations: [
        { id: 'final-blow', label: 'Final Blows' },
        { id: 'kill-streak', label: 'Kill Streak' },
        { id: 'multi', label: 'Multi' },
        { id: 'team', label: 'Team' },
        { id: 'revenge', label: 'Revenge' },
        { id: 'melee', label: 'Melee Blow' },
        { id: 'environmental', label: 'Environmental Blow' },
        { id: 'deployable', label: 'Deployable Out' },
        { id: 'compliment', label: 'Compliment' },
    ],
    skin: [{ id: 'all', label: 'All skin lines' }],
    map: [{ id: 'all', label: 'All map lines' }],
    event: [{ id: 'all', label: 'All event lines' }],
};

/** Flat list for migration / validation. */
export const CHATTER_KIND_OPTIONS = Object.values(CHATTER_KIND_OPTIONS_BY_GROUP).flat();

/** @type {ChatterFilterSelection} */
export const DEFAULT_CHATTER_FILTER = {
    era: 'overwatch',
    status: 'active',
    group: 'chatter',
    kind: 'setup',
};

const STORAGE_KEY = 'dialogueTheaterChatterFilter.v3';
const LEGACY_STORAGE_KEY_V2 = 'dialogueTheaterChatterFilter.v2';
const LEGACY_STORAGE_KEY_V1 = 'dialogueTheaterChatterCategories';

/** @type {Record<string, { group: ChatterGroupId, kind: ChatterKindId }>} */
const LEGACY_KIND_MAP = {
    prep: { group: 'chatter', kind: 'setup' },
    'next-round-win': { group: 'chatter', kind: 'won-round' },
    'next-round-lose': { group: 'chatter', kind: 'lost-round' },
    respawn: { group: 'chatter', kind: 'respawn' },
    elimination: { group: 'eliminations', kind: 'final-blow' },
    'team-dependent': { group: 'chatter', kind: 'setup' },
    'map-specific': { group: 'map', kind: 'all' },
    'skin-specific': { group: 'skin', kind: 'all' },
};

/**
 * @param {ChatterGroupId} group
 * @returns {ChatterKindId}
 */
function defaultKindForGroup(group) {
    const opts = CHATTER_KIND_OPTIONS_BY_GROUP[group] || [];
    return opts[0]?.id || 'all';
}

/**
 * @param {ChatterGroupId} group
 * @param {string} kind
 * @returns {boolean}
 */
function isKindInGroup(group, kind) {
    return (CHATTER_KIND_OPTIONS_BY_GROUP[group] || []).some((o) => o.id === kind);
}

/**
 * @param {string} disclaimer
 * @returns {boolean}
 */
function isEventDisclaimer(disclaimer) {
    return /april\s*fools|lunar\s*new|halloween|winter\s*wonderland|summer\s*games|overwatch\s*league|\bpride\b|event[-\s]?specific|archives|anniversary/i.test(
        disclaimer,
    );
}

/**
 * @param {string} disclaimer
 * @returns {boolean}
 */
function isSkinDisclaimer(disclaimer) {
    return /\bskin\b|cosmetic|legendary skin|mythic/i.test(disclaimer);
}

/**
 * Classify within the Eliminations wiki section.
 * @param {string} d
 * @returns {ChatterKindId|null}
 */
function classifyEliminationKind(d) {
    if (!/eliminat/i.test(d) && !/final\s*blow/i.test(d) && !/kill\s*streak|multi\s*kill|revenge|melee|environmental|deployable|compliment|ally\s*eliminat|assist/i.test(d)) {
        return null;
    }

    if (/compliment/i.test(d)) return 'compliment';
    if (/deployable|turret\s*eliminat|enemy\s*turret/i.test(d)) return 'deployable';
    if (/environmental/i.test(d)) return 'environmental';
    if (/melee/i.test(d)) return 'melee';
    if (/revenge/i.test(d)) return 'revenge';
    if (/multi\s*kill/i.test(d)) return 'multi';
    if (/kill\s*streak/i.test(d)) return 'kill-streak';
    if (
        /(?:^|—|-)\s*team\s*kill\b/i.test(d)
        || /ally\s*eliminat/i.test(d)
        || /\bassist\b/i.test(d)
        || /low\s*hp/i.test(d)
        || /rescuing\s*ally/i.test(d)
    ) {
        return 'team';
    }

    // Final Blow (+ scenario / hero-specific / ability elim leftovers).
    if (/eliminat|final\s*blow/i.test(d)) return 'final-blow';
    return null;
}

/**
 * Classify within the Chatter wiki section.
 * @param {string} d
 * @returns {ChatterKindId|null}
 */
function classifyChatterSectionKind(d) {
    if (/respawn/i.test(d)) return 'respawn';

    if (/final\s*round/i.test(d)) return 'final-round';
    if (/won\s*previous/i.test(d)
        || (/next\s*round/i.test(d) && /(win|victory|won|winning)/i.test(d))
        || (/\b(round|match)\b/i.test(d) && /\b(win|victory|winning)\b/i.test(d)
            && !/lost|lose|loss|losing|defeat|final\s*round/i.test(d))) {
        return 'won-round';
    }
    if (/lost\s*previous/i.test(d)
        || (/next\s*round/i.test(d) && /(lose|loss|lost|losing|defeat)/i.test(d))
        || (/\b(round|match)\b/i.test(d) && /\b(lose|loss|losing|defeat)\b/i.test(d))) {
        return 'lost-round';
    }

    if (/\bwaiting\b/i.test(d)) return 'waiting';
    if (/\bperk\b/i.test(d)) return 'perk';
    if (/nano[-\s]?boosted/i.test(d)) return 'nano-boosted';
    if (/negative\s*status/i.test(d)) return 'negative-status';
    if (/enemy\s*resurrect|enemy\s*reviv/i.test(d)) return 'enemy-revived';
    if (/\bresurrected\b|\brevived\b/i.test(d) && !/enemy/i.test(d)) return 'resurrected';
    if (/\bvoted\b|\bvote\b/i.test(d)) return 'voted';

    if (
        /fully\s*healed/i.test(d)
        || /damage\s*boosted/i.test(d)
        || /health\s*pack|pick\s*up\s*health/i.test(d)
        || /\bon\s*fire\b/i.test(d)
    ) {
        return 'buffs';
    }

    if (/hero\s*selected|during\s*set[-\s]?up|set[-\s]?up\s*chatter|^set\s*up\b/i.test(d)) {
        return 'setup';
    }
    // General Match Start only (not Won/Lost/Final Round sub-triggers).
    if (/match\s*start/i.test(d) && !/won|lost|final\s*round/i.test(d)) {
        return 'match-start';
    }

    return null;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine|null|undefined} line
 * @returns {{ group: ChatterGroupId, kind: ChatterKindId }}
 */
export function getChatterLineGroupAndKind(line) {
    if (!line || typeof line !== 'object') {
        return { group: 'chatter', kind: 'setup' };
    }

    const disclaimer = String(line.disclaimer || '').trim();
    const voice = String(line.voice || '');

    if (disclaimer) {
        if (isSkinDisclaimer(disclaimer)) return { group: 'skin', kind: 'all' };
        if (isEventDisclaimer(disclaimer)) return { group: 'event', kind: 'all' };

        const elimKind = classifyEliminationKind(disclaimer);
        if (elimKind) return { group: 'eliminations', kind: elimKind };

        const chatterKind = classifyChatterSectionKind(disclaimer);
        if (chatterKind) return { group: 'chatter', kind: chatterKind };

        // Non-empty leftover disclaimer is almost always a map header from imports.
        return { group: 'map', kind: 'all' };
    }

    if (/MatchStart|Match[_\s-]?Start/i.test(voice)) {
        return { group: 'chatter', kind: 'match-start' };
    }
    if (/SetupHere|Set[_\s-]?Up|DuringSet/i.test(voice)) {
        return { group: 'chatter', kind: 'setup' };
    }

    // Untagged prep lines (legacy setup import left disclaimer empty).
    return { group: 'chatter', kind: 'setup' };
}

/**
 * @deprecated Prefer getChatterLineGroupAndKind — kept for older call sites.
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine|null|undefined} line
 * @returns {ChatterKindId}
 */
export function getChatterLineKind(line) {
    return getChatterLineGroupAndKind(line).kind;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine|null|undefined} line
 * @returns {{ era: ChatterEraId, status: ChatterStatusId, group: ChatterGroupId, kind: ChatterKindId }}
 */
export function getChatterLineFilterMeta(line) {
    const era = getDialogueLineEra(line) === DIALOGUE_THEATER_ERA_CLASSIC ? 'classic' : 'overwatch';
    const status = getDialogueLineStatus(line) === 'removed' ? 'removed' : 'active';
    const { group, kind } = getChatterLineGroupAndKind(line);
    return { era, status, group, kind };
}

/**
 * @param {unknown} value
 * @returns {ChatterFilterSelection}
 */
function normalizeSelection(value) {
    const base = { ...DEFAULT_CHATTER_FILTER };
    if (!value || typeof value !== 'object') return base;
    const raw = /** @type {Record<string, string>} */ (value);

    if (CHATTER_ERA_OPTIONS.some((o) => o.id === raw.era)) {
        base.era = /** @type {ChatterEraId} */ (raw.era);
    }
    if (CHATTER_STATUS_OPTIONS.some((o) => o.id === raw.status)) {
        base.status = /** @type {ChatterStatusId} */ (raw.status);
    }

    // Migrate v2 kind-only shape.
    if (!raw.group && raw.kind && LEGACY_KIND_MAP[raw.kind]) {
        const mapped = LEGACY_KIND_MAP[raw.kind];
        base.group = mapped.group;
        base.kind = mapped.kind;
    } else {
        if (CHATTER_GROUP_OPTIONS.some((o) => o.id === raw.group)) {
            base.group = /** @type {ChatterGroupId} */ (raw.group);
        }
        if (typeof raw.kind === 'string' && isKindInGroup(base.group, raw.kind)) {
            base.kind = /** @type {ChatterKindId} */ (raw.kind);
        } else if (LEGACY_KIND_MAP[raw.kind]) {
            const mapped = LEGACY_KIND_MAP[raw.kind];
            base.group = mapped.group;
            base.kind = mapped.kind;
        } else {
            base.kind = defaultKindForGroup(base.group);
        }
    }

    if (!isKindInGroup(base.group, base.kind)) {
        base.kind = defaultKindForGroup(base.group);
    }

    if (base.era === 'classic') {
        base.status = 'removed';
    }
    return base;
}

/**
 * @returns {ChatterFilterSelection}
 */
export function loadChatterCategorySelection() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) return normalizeSelection(JSON.parse(raw));

        const v2 = sessionStorage.getItem(LEGACY_STORAGE_KEY_V2);
        if (v2) {
            const next = normalizeSelection(JSON.parse(v2));
            saveChatterCategorySelection(next);
            return next;
        }

        const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY_V1);
        if (legacy) {
            const parsed = JSON.parse(legacy);
            if (Array.isArray(parsed)) {
                const next = { ...DEFAULT_CHATTER_FILTER };
                if (parsed.includes('classic')) next.era = 'classic';
                if (parsed.includes('removed')) next.status = 'removed';
                for (const id of parsed) {
                    if (LEGACY_KIND_MAP[id]) {
                        next.group = LEGACY_KIND_MAP[id].group;
                        next.kind = LEGACY_KIND_MAP[id].kind;
                        break;
                    }
                }
                saveChatterCategorySelection(next);
                return next;
            }
        }
    } catch {
        /* ignore */
    }
    return { ...DEFAULT_CHATTER_FILTER };
}

/**
 * @param {ChatterFilterSelection} selected
 */
export function saveChatterCategorySelection(selected) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSelection(selected)));
    } catch {
        /* ignore */
    }
}

/**
 * @param {ChatterFilterSelection} selected
 * @param {ChatterGroupId} group
 * @returns {ChatterFilterSelection}
 */
export function chatterSelectionWithGroup(selected, group) {
    const nextGroup = CHATTER_GROUP_OPTIONS.some((o) => o.id === group)
        ? group
        : DEFAULT_CHATTER_FILTER.group;
    return normalizeSelection({
        ...selected,
        group: nextGroup,
        kind: defaultKindForGroup(nextGroup),
    });
}


/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine|null|undefined} line
 * @param {ChatterFilterSelection} selected
 * @returns {boolean}
 */
export function chatterLineMatchesCategories(line, selected) {
    const filter = normalizeSelection(selected);
    const meta = getChatterLineFilterMeta(line);
    if (meta.era !== filter.era || meta.status !== filter.status) return false;
    if (meta.group !== filter.group) return false;
    if (filter.group === 'skin' || filter.group === 'map' || filter.group === 'event') {
        return true;
    }
    return meta.kind === filter.kind;
}

/**
 * @param {{ id: string, label: string }[]} options
 * @param {string} selectedId
 * @param {'era'|'status'|'group'|'kind'} group
 * @returns {string}
 */
function renderOptionButtons(options, selectedId, group) {
    return options.map((opt) => {
        const on = opt.id === selectedId;
        return `<button
            type="button"
            class="dialogue-theater-chatter-cat${on ? ' dialogue-theater-chatter-cat--on' : ''}${group === 'group' ? ' dialogue-theater-chatter-cat--group' : ''}"
            data-chatter-filter-group="${group}"
            data-chatter-category="${opt.id}"
            aria-pressed="${on ? 'true' : 'false'}"
        >${opt.label}</button>`;
    }).join('');
}

/**
 * @param {ChatterFilterSelection} [selected]
 * @returns {string}
 */
export function renderChatterCategorySelectionHtml(selected) {
    const filter = normalizeSelection(selected || loadChatterCategorySelection());
    const kindOptions = CHATTER_KIND_OPTIONS_BY_GROUP[filter.group] || [];
    const showKinds = filter.group === 'chatter' || filter.group === 'eliminations';

    return `
        <section class="dialogue-theater-edit__section dialogue-theater-edit__chatter-cats" aria-label="Chatter filters">
            <div class="dialogue-theater-edit__section-head">
                <h3 class="dialogue-theater-edit__section-title">Status &amp; Era</h3>
            </div>
            <div class="dialogue-theater-chatter-era-status" role="group" aria-label="Status and era">
                <div class="dialogue-theater-chatter-filter-row dialogue-theater-chatter-filter-row--era" role="group" aria-label="Era">
                    ${renderOptionButtons(CHATTER_ERA_OPTIONS, filter.era, 'era')}
                </div>
                <div class="dialogue-theater-chatter-era-status__rule" aria-hidden="true"></div>
                <div class="dialogue-theater-chatter-filter-row dialogue-theater-chatter-filter-row--status" role="group" aria-label="Status">
                    ${renderOptionButtons(CHATTER_STATUS_OPTIONS, filter.status, 'status')}
                </div>
            </div>

            <div class="dialogue-theater-edit__section-head dialogue-theater-edit__section-head--spaced">
                <h3 class="dialogue-theater-edit__section-title">Group</h3>
            </div>
            <p class="dialogue-theater-edit__hint">Matches the wiki sections. Call-outs / PvE / Communication stay out for now.</p>
            <div class="dialogue-theater-chatter-cats dialogue-theater-chatter-cats--groups" role="radiogroup" aria-label="Chatter group">
                ${renderOptionButtons(CHATTER_GROUP_OPTIONS, filter.group, 'group')}
            </div>

            ${showKinds ? `
            <div class="dialogue-theater-edit__section-head dialogue-theater-edit__section-head--spaced">
                <h3 class="dialogue-theater-edit__section-title">Category</h3>
            </div>
            <div class="dialogue-theater-chatter-cats dialogue-theater-chatter-cats--kinds" role="radiogroup" aria-label="Chatter category">
                ${renderOptionButtons(kindOptions, filter.kind, 'kind')}
            </div>
            ` : ''}
        </section>
    `;
}
