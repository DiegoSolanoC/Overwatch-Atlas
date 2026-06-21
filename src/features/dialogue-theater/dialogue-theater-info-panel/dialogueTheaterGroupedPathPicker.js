/**
 * Two-tier route picker — hero icon chips, then variant buttons for multi-response heroes.
 */

import { heroFilterIconUrl } from '../data/loadDialogueTheaterAssets.js';
import { summarizeDialogueLine, resolveSelectedPathId } from '../data/dialogueTheaterPathHelpers.js';
import { normalizeHeroKey } from '../data/theaterVoicelineParsing.js';
import { shouldUseTieredPathPicker } from './beforeTheCrisisPathConfig.js';
import { shouldUsePeriodicTablePathPicker } from './periodicTablePathConfig.js';

/** @typedef {{ id: string, label: string, lineIds: string[] }} DialoguePath */
/** @typedef {{ id: string, hero?: string, subtitles?: string }} DialogueLine */
/** @typedef {{ hero: string, heroKey: string, paths: Array<DialoguePath & { variantLabel: string }> }} PathHeroGroup */

const GROUPED_PATH_THRESHOLD = 10;
const HERO_CHIPS_PER_ROW = 10;

export const FAVORITE_ANIMAL_CONVERSATION_ID = '8974246a-ee27-4a5b-a5ec-132a459895a3';

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function isFavoriteAnimalConversation(conversation) {
    return (
        conversation?.id === FAVORITE_ANIMAL_CONVERSATION_ID ||
        String(conversation?.name || '').trim() === 'Favorite Animal'
    );
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {boolean}
 */
export function shouldUseGroupedPathPicker(conversation) {
    if (shouldUseTieredPathPicker(conversation)) return false;
    if (shouldUsePeriodicTablePathPicker(conversation)) return false;
    return (conversation?.paths?.length || 0) >= GROUPED_PATH_THRESHOLD;
}

/**
 * @param {string} label
 * @returns {string}
 */
function parseHeroFromPathLabel(label) {
    const text = String(label || '').trim();
    const sep = text.indexOf(' — ');
    return sep >= 0 ? text.slice(0, sep).trim() : text;
}

/**
 * @param {DialoguePath} path
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string}
 */
function getPathChipHero(path, conversation) {
    const labelHero = parseHeroFromPathLabel(path.label);
    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    const byId = new Map(lines.map((line) => [line.id, line]));
    const pathLines = (path.lineIds || []).map((id) => byId.get(id)).filter(Boolean);
    if (pathLines.length === 0) return labelHero;

    if (pathLines.length === 2) {
        const opener = String(pathLines[0]?.hero || '').trim();
        const responder = String(pathLines[1]?.hero || '').trim();
        if (opener && responder && opener !== responder) {
            return responder;
        }
    }

    if (pathLines.length === 3) {
        const opener = String(pathLines[0]?.hero || '').trim();
        const responder = String(pathLines[1]?.hero || '').trim();
        const closer = String(pathLines[2]?.hero || '').trim();
        if (opener === closer && opener === 'Winston' && responder) {
            return responder;
        }
    }

    const openHero = String(pathLines[0]?.hero || '').trim();
    const closeHero = String(pathLines[pathLines.length - 1]?.hero || '').trim();

    if (openHero === 'Lúcio' && pathLines.length === 3 && closeHero === 'Lúcio') {
        return String(pathLines[1]?.hero || '').trim() || labelHero;
    }

    // Someone asks Lúcio (e.g. Kiriko tree frog) — chip is Lúcio, not the asker.
    if (pathLines.length === 3 && String(pathLines[1]?.hero || '').trim() === 'Lúcio' && openHero !== 'Lúcio') {
        return 'Lúcio';
    }

    if (openHero && openHero !== 'Lúcio') {
        return openHero;
    }

    return String(pathLines[1]?.hero || '').trim() || labelHero;
}

/**
 * @param {DialoguePath} path
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string}
 */
function getPathVariantLabel(path, conversation) {
    const label = String(path.label || '').trim();
    const sep = label.indexOf(' — ');
    if (sep >= 0) return label.slice(sep + 3).trim();

    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    const byId = new Map(lines.map((line) => [line.id, line]));
    const responseLineId = path.lineIds?.[1];
    const line = responseLineId ? byId.get(responseLineId) : null;
    return summarizeDialogueLine(line?.subtitles || label, 64);
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {PathHeroGroup[]}
 */
export function buildPathGroupsByHero(conversation) {
    const paths = conversation?.paths || [];
    /** @type {Map<string, PathHeroGroup>} */
    const groups = new Map();

    for (const path of paths) {
        const hero = getPathChipHero(path, conversation);
        const heroKey = normalizeHeroKey(hero) || hero.toLowerCase();
        if (!groups.has(heroKey)) {
            groups.set(heroKey, { hero, heroKey, paths: [] });
        }
        groups.get(heroKey).paths.push({
            ...path,
            variantLabel: getPathVariantLabel(path, conversation),
        });
    }

    return [...groups.values()].sort((a, b) => a.hero.localeCompare(b.hero, undefined, { sensitivity: 'base' }));
}

/**
 * @param {PathHeroGroup[]} groups
 * @param {string} pathId
 * @returns {PathHeroGroup|null}
 */
function findGroupForPathId(groups, pathId) {
    const id = String(pathId || '').trim();
    if (!id) return null;
    return groups.find((group) => group.paths.some((path) => path.id === id)) || null;
}

/**
 * @param {PathHeroGroup[]} groups
 * @param {string} heroKey
 * @returns {PathHeroGroup|null}
 */
function findGroupForHeroKey(groups, heroKey) {
    const key = String(heroKey || '').trim();
    if (!key) return null;
    return groups.find((group) => group.heroKey === key) || null;
}

/**
 * @param {PathHeroGroup[]} groups
 * @param {string} selectedPathId
 * @param {string} [pendingHeroKey]
 * @returns {PathHeroGroup|null}
 */
function resolveUiHeroGroup(groups, selectedPathId, pendingHeroKey) {
    const pending = findGroupForHeroKey(groups, pendingHeroKey || '');
    if (pending && pending.paths.length > 1) return pending;
    return findGroupForPathId(groups, selectedPathId);
}

/**
 * @param {PathHeroGroup[]} groups
 * @param {string} selectedPathId
 * @param {string} [pendingHeroKey]
 */
function renderVariantSectionHtml(groups, selectedPathId, pendingHeroKey) {
    const uiGroup = resolveUiHeroGroup(groups, selectedPathId, pendingHeroKey);
    if (!uiGroup || uiGroup.paths.length <= 1) {
        return `
            <div class="dialogue-theater-path-switch__variants dialogue-theater-path-switch__variants--hidden" hidden>
                <span class="dialogue-theater-path-switch__label">Response</span>
                <div class="dialogue-theater-path-switch__options" role="tablist" aria-label="Response variant"></div>
            </div>
        `;
    }

    return `
        <div class="dialogue-theater-path-switch__variants">
            <span class="dialogue-theater-path-switch__label">${escapeHtml(uiGroup.hero)} — pick a response</span>
            <div class="dialogue-theater-path-switch__options" role="tablist" aria-label="${escapeHtml(uiGroup.hero)} response variants">
                ${uiGroup.paths
                    .map(
                        (path) => `
                    <button
                        type="button"
                        class="dialogue-theater-path-switch__option${path.id === selectedPathId ? ' dialogue-theater-path-switch__option--active' : ''}"
                        data-path-id="${escapeHtml(path.id)}"
                        role="tab"
                        aria-selected="${path.id === selectedPathId ? 'true' : 'false'}"
                    >${escapeHtml(path.variantLabel || path.label || 'Response')}</button>
                `,
                    )
                    .join('')}
            </div>
        </div>
    `;
}

/**
 * @param {PathHeroGroup} group
 * @param {string} selectedPathId
 * @param {string} activeHeroKey
 * @param {{ outcomeKey?: string }} [options]
 */
function renderHeroChipHtml(group, selectedPathId, activeHeroKey, options = {}) {
    const outcomeKey = String(options.outcomeKey || '').trim();
    const isActive =
        group.heroKey === activeHeroKey &&
        (group.paths.length === 1 || group.paths.some((path) => path.id === selectedPathId));
    const wrapClass = isActive ? ' gallery-hero-filters__chip-wrap--active' : '';
    const chipClass = isActive ? ' filter-btn--active' : '';
    const multiClass = group.paths.length > 1 ? ' dialogue-theater-path-switch__hero-wrap--multi' : '';
    const outcomeAttr = outcomeKey ? ` data-outcome="${escapeHtml(outcomeKey)}"` : '';
    return `
        <div class="gallery-hero-filters__chip-wrap dialogue-theater-path-switch__hero-wrap${wrapClass}${multiClass}" data-hero-key="${escapeHtml(group.heroKey)}"${outcomeAttr}>
            <button
                type="button"
                class="filter-btn gallery-hero-filters__chip dialogue-theater-path-switch__hero-chip${chipClass}"
                data-hero-key="${escapeHtml(group.heroKey)}"${outcomeAttr}
                aria-pressed="${isActive ? 'true' : 'false'}"
                aria-label="${escapeHtml(group.hero)}${group.paths.length > 1 ? ` (${group.paths.length} responses)` : ''}"
            >
                <div class="filter-image-container">
                    <img src="${escapeHtml(heroFilterIconUrl(group.hero))}" alt="" loading="lazy" />
                </div>
                <div class="filter-label">
                    <span class="filter-label-text">${escapeHtml(group.hero)}</span>
                </div>
            </button>
        </div>
    `;
}

/**
 * @param {PathHeroGroup[]} groups
 * @param {string} selectedPathId
 * @param {{ outcomeKey?: string }} [options]
 */
export function renderHeroChipRowsHtml(groups, selectedPathId, options = {}) {
    const activeGroup = findGroupForPathId(groups, selectedPathId);
    const activeHeroKey = activeGroup?.heroKey || '';
    /** @type {string[]} */
    const rows = [];

    for (let i = 0; i < groups.length; i += HERO_CHIPS_PER_ROW) {
        const slice = groups.slice(i, i + HERO_CHIPS_PER_ROW);
        const partialClass =
            slice.length < HERO_CHIPS_PER_ROW ? ' dialogue-theater-path-switch__hero-row--partial' : '';
        rows.push(`
            <div
                class="dialogue-theater-path-switch__hero-row gallery-hero-filters__chips-row gallery-hero-filters__chips-row--flat${partialClass}"
                role="presentation"
            >
                ${slice.map((group) => renderHeroChipHtml(group, selectedPathId, activeHeroKey, options)).join('')}
            </div>
        `);
    }

    return rows.join('');
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} selectedPathId
 * @returns {string}
 */
export function renderGroupedPathSwitcherHtml(conversation, selectedPathId) {
    const groups = buildPathGroupsByHero(conversation);
    const heroRowsHtml = renderHeroChipRowsHtml(groups, selectedPathId);
    const masterPlayHtml =
        isFavoriteAnimalConversation(conversation)
            ? `<button
                type="button"
                id="dialogueTheaterMasterPlayBtn"
                class="dialogue-theater-path-switch__master-play"
                aria-label="Play every character response in order"
            >▶ Master play</button>
            <button
                type="button"
                id="dialogueTheaterRandomPlayBtn"
                class="dialogue-theater-path-switch__master-play"
                aria-label="Pick a random character response and play it"
            >▶ Random play</button>`
            : '';

    return `
        <div class="dialogue-theater-path-switch dialogue-theater-path-switch--grouped">
            <div class="dialogue-theater-path-switch__head">
                <span class="dialogue-theater-path-switch__label">Character</span>
                ${masterPlayHtml}
            </div>
            <div class="dialogue-theater-path-switch__hero-rows" role="tablist" aria-label="Response character">
                ${heroRowsHtml}
            </div>
            ${renderVariantSectionHtml(groups, selectedPathId)}
        </div>
    `;
}

/**
 * Highlight the active route in the grouped picker without remounting the panel.
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} pathId
 */
export function highlightGroupedPathSelection(host, conversation, pathId) {
    if (!shouldUseGroupedPathPicker(conversation)) return;
    const groups = buildPathGroupsByHero(conversation);
    host.dataset.selectedPathId = pathId;
    host.dataset.pendingHeroKey = '';
    syncGroupedPathPickerUi(host, groups, { selectedPathId: pathId });
}

/**
 * @param {HTMLElement} host
 * @param {PathHeroGroup[]} groups
 * @param {{ selectedPathId: string, pendingHeroKey?: string }} state
 */
function syncGroupedPathPickerUi(host, groups, state) {
    const { selectedPathId, pendingHeroKey = '' } = state;
    const uiGroup = resolveUiHeroGroup(groups, selectedPathId, pendingHeroKey);
    const playbackGroup = findGroupForPathId(groups, selectedPathId);
    const playbackHeroKey = playbackGroup?.heroKey || '';

    host.querySelectorAll('.dialogue-theater-path-switch__hero-wrap').forEach((wrap) => {
        if (!(wrap instanceof HTMLElement)) return;
        const heroKey = wrap.dataset.heroKey || '';
        const group = findGroupForHeroKey(groups, heroKey);
        const isPending = Boolean(pendingHeroKey && heroKey === pendingHeroKey && group && group.paths.length > 1);
        const isPlayback =
            !pendingHeroKey &&
            heroKey === playbackHeroKey &&
            (group?.paths.length === 1 || group?.paths.some((path) => path.id === selectedPathId));
        const isActive = isPending || isPlayback;

        wrap.classList.toggle('gallery-hero-filters__chip-wrap--active', isActive);
        const chip = wrap.querySelector('.dialogue-theater-path-switch__hero-chip');
        if (chip instanceof HTMLElement) {
            chip.classList.toggle('filter-btn--active', isActive);
            chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }
    });

    const variantsHost = host.querySelector('.dialogue-theater-path-switch__variants');
    if (!(variantsHost instanceof HTMLElement)) return;

    if (!uiGroup || uiGroup.paths.length <= 1) {
        variantsHost.hidden = true;
        variantsHost.classList.add('dialogue-theater-path-switch__variants--hidden');
        variantsHost.innerHTML = `
            <span class="dialogue-theater-path-switch__label">Response</span>
            <div class="dialogue-theater-path-switch__options" role="tablist" aria-label="Response variant"></div>
        `;
        return;
    }

    variantsHost.hidden = false;
    variantsHost.classList.remove('dialogue-theater-path-switch__variants--hidden');
    variantsHost.innerHTML = `
        <span class="dialogue-theater-path-switch__label">${escapeHtml(uiGroup.hero)} — pick a response</span>
        <div class="dialogue-theater-path-switch__options" role="tablist" aria-label="${escapeHtml(uiGroup.hero)} response variants">
            ${uiGroup.paths
                .map(
                    (path) => `
                <button
                    type="button"
                    class="dialogue-theater-path-switch__option${path.id === selectedPathId ? ' dialogue-theater-path-switch__option--active' : ''}"
                    data-path-id="${escapeHtml(path.id)}"
                    role="tab"
                    aria-selected="${path.id === selectedPathId ? 'true' : 'false'}"
                >${escapeHtml(path.variantLabel || path.label || 'Response')}</button>
            `,
                )
                .join('')}
        </div>
    `;
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {(pathId: string) => void} [onPathChange]
 */
export function wireGroupedPathSelector(host, conversation, onPathChange) {
    const paths = conversation.paths || [];
    if (paths.length === 0) return;

    const groups = buildPathGroupsByHero(conversation);
    const selectedPathId = resolveSelectedPathId(conversation);

    host.dataset.selectedPathId = selectedPathId;
    host.dataset.pendingHeroKey = '';

    const rowsHost = host.querySelector('.dialogue-theater-path-switch__hero-rows');
    if (!(rowsHost instanceof HTMLElement)) return;

    if (host._dialogueTheaterHeroRowsClick) {
        rowsHost.removeEventListener('click', host._dialogueTheaterHeroRowsClick);
    }

    host._dialogueTheaterHeroRowsClick = (e) => {
        const chip = e.target instanceof Element ? e.target.closest('.dialogue-theater-path-switch__hero-chip') : null;
        if (!(chip instanceof HTMLButtonElement) || !rowsHost.contains(chip)) return;

        e.preventDefault();
        e.stopPropagation();

        const heroKey = chip.dataset.heroKey || '';
        const group = findGroupForHeroKey(groups, heroKey);
        if (!group) return;

        if (group.paths.length === 1) {
            const pathId = group.paths[0].id;
            if (pathId === host.dataset.selectedPathId) return;
            host.dataset.pendingHeroKey = '';
            host.dataset.selectedPathId = pathId;
            onPathChange?.(pathId);
            return;
        }

        host.dataset.pendingHeroKey = heroKey;
        const currentPathId = host.dataset.selectedPathId || selectedPathId;
        const hasPathInGroup = group.paths.some((path) => path.id === currentPathId);
        if (!hasPathInGroup) {
            const pathId = group.paths[0].id;
            host.dataset.selectedPathId = pathId;
            onPathChange?.(pathId);
            return;
        }

        syncGroupedPathPickerUi(host, groups, {
            selectedPathId: currentPathId,
            pendingHeroKey: heroKey,
        });
    };

    rowsHost.addEventListener('click', host._dialogueTheaterHeroRowsClick);

    const switcher = host.querySelector('.dialogue-theater-path-switch--grouped');
    if (switcher instanceof HTMLElement) {
        if (host._dialogueTheaterVariantClick) {
            switcher.removeEventListener('click', host._dialogueTheaterVariantClick);
        }

        host._dialogueTheaterVariantClick = (e) => {
            const btn = e.target instanceof Element ? e.target.closest('.dialogue-theater-path-switch__option') : null;
            if (!(btn instanceof HTMLButtonElement)) return;

            e.preventDefault();
            e.stopPropagation();

            const pathId = btn.dataset.pathId || '';
            if (!pathId || pathId === host.dataset.selectedPathId) return;

            host.dataset.pendingHeroKey = '';
            host.dataset.selectedPathId = pathId;
            onPathChange?.(pathId);
        };

        switcher.addEventListener('click', host._dialogueTheaterVariantClick);
    }
}
