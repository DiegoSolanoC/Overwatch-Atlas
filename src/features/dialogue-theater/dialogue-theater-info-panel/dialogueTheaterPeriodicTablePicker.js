/**
 * Periodic Table — Failure + Success hero chip rows (both visible).
 */

import { resolveSelectedPathId } from '../data/dialogueTheaterPathHelpers.js';
import { buildPathGroupsByHero, renderHeroChipRowsHtml } from './dialogueTheaterGroupedPathPicker.js';
import {
    PERIODIC_TABLE_OUTCOMES,
    pathsForOutcome,
    pickRandomPeriodicTablePathId,
    resolveSegmentsForPathId,
    shouldUsePeriodicTablePathPicker,
} from './periodicTablePathConfig.js';

export { pickRandomPeriodicTablePathId, shouldUsePeriodicTablePathPicker };

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
 * @param {string} outcome
 * @returns {ReturnType<typeof buildPathGroupsByHero>}
 */
function buildOutcomePathGroups(conversation, outcome) {
    const paths = pathsForOutcome(conversation, outcome);
    return buildPathGroupsByHero({ ...conversation, paths });
}

/**
 * @param {ReturnType<typeof buildPathGroupsByHero>} groups
 * @param {string} pathId
 * @returns {import('./dialogueTheaterGroupedPathPicker.js').PathHeroGroup|null}
 */
function findGroupForPathId(groups, pathId) {
    const id = String(pathId || '').trim();
    if (!id) return null;
    return groups.find((group) => group.paths.some((path) => path.id === id)) || null;
}

/**
 * @param {ReturnType<typeof buildPathGroupsByHero>} groups
 * @param {string} heroKey
 */
function findGroupForHeroKey(groups, heroKey) {
    const key = String(heroKey || '').trim();
    if (!key) return null;
    return groups.find((group) => group.heroKey === key) || null;
}

/**
 * @param {ReturnType<typeof buildPathGroupsByHero>} groups
 * @param {string} selectedPathId
 * @param {string} [pendingHeroKey]
 */
function resolveUiHeroGroup(groups, selectedPathId, pendingHeroKey) {
    const pending = findGroupForHeroKey(groups, pendingHeroKey || '');
    if (pending && pending.paths.length > 1) return pending;
    return findGroupForPathId(groups, selectedPathId);
}

/**
 * @param {ReturnType<typeof buildPathGroupsByHero>} groups
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
                    .map((path) => {
                        const line = path.variantLabel || path.label || 'Response';
                        return `
                    <button
                        type="button"
                        class="dialogue-theater-path-switch__option${path.id === selectedPathId ? ' dialogue-theater-path-switch__option--active' : ''}"
                        data-path-id="${escapeHtml(path.id)}"
                        role="tab"
                        aria-selected="${path.id === selectedPathId ? 'true' : 'false'}"
                    >${escapeHtml(line)}</button>
                `;
                    })
                    .join('')}
            </div>
        </div>
    `;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} outcome
 * @param {string} label
 * @param {string} selectedPathId
 * @returns {string}
 */
function renderOutcomeHeroTierHtml(conversation, outcome, label, selectedPathId) {
    const groups = buildOutcomePathGroups(conversation, outcome);
    return `
        <div class="dialogue-theater-path-switch__tier dialogue-theater-path-switch__tier--${escapeHtml(outcome)}" data-tier="${escapeHtml(outcome)}" data-outcome="${escapeHtml(outcome)}">
            <span class="dialogue-theater-path-switch__label">${escapeHtml(label)}</span>
            <div class="dialogue-theater-path-switch__hero-rows" role="tablist" aria-label="${escapeHtml(label)} responses">
                ${renderHeroChipRowsHtml(groups, selectedPathId, { outcomeKey: outcome })}
            </div>
        </div>
    `;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} selectedPathId
 * @returns {string}
 */
export function renderPeriodicTablePathSwitcherHtml(conversation, selectedPathId) {
    const segments = resolveSegmentsForPathId(conversation, selectedPathId);
    const groups = buildOutcomePathGroups(conversation, segments.outcome);

    return `
        <div class="dialogue-theater-path-switch dialogue-theater-path-switch--grouped dialogue-theater-path-switch--periodic-table">
            <div class="dialogue-theater-path-switch__head">
                <span class="dialogue-theater-path-switch__label">Route</span>
                <button
                    type="button"
                    id="dialogueTheaterMasterPlayBtn"
                    class="dialogue-theater-path-switch__master-play"
                    aria-label="Play every response for the selected outcome"
                >▶ Master play</button>
                <button
                    type="button"
                    id="dialogueTheaterRandomPlayBtn"
                    class="dialogue-theater-path-switch__master-play"
                    aria-label="Pick a random response and play it"
                >▶ Random play</button>
            </div>
            ${PERIODIC_TABLE_OUTCOMES.map((option) =>
                renderOutcomeHeroTierHtml(conversation, option.key, option.label, selectedPathId),
            ).join('')}
            ${renderVariantSectionHtml(groups, selectedPathId)}
        </div>
    `;
}

/**
 * @param {HTMLElement} host
 * @param {ReturnType<typeof buildPathGroupsByHero>} groups
 * @param {{ selectedPathId: string, pendingHeroKey?: string, outcome?: string }} state
 */
function syncPeriodicTableChipHighlight(host, groups, state) {
    const { selectedPathId, pendingHeroKey = '', outcome = '' } = state;
    const playbackGroup = findGroupForPathId(groups, selectedPathId);
    const playbackHeroKey = playbackGroup?.heroKey || '';
    const outcomeSelector = outcome ? `[data-outcome="${outcome}"]` : '';

    host.querySelectorAll(`.dialogue-theater-path-switch__hero-wrap${outcomeSelector}`).forEach((wrap) => {
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
}

/**
 * @param {HTMLElement} host
 * @param {ReturnType<typeof buildPathGroupsByHero>} groups
 * @param {{ selectedPathId: string, pendingHeroKey?: string, outcome?: string }} state
 */
function syncPeriodicTableHeroUi(host, groups, state) {
    syncPeriodicTableChipHighlight(host, groups, state);

    const { selectedPathId, pendingHeroKey = '' } = state;
    const playbackGroup = findGroupForPathId(groups, selectedPathId);

    const variantsHost = host.querySelector('.dialogue-theater-path-switch__variants');
    if (!(variantsHost instanceof HTMLElement)) return;

    if (!playbackGroup && !pendingHeroKey) {
        const uiGroup = resolveUiHeroGroup(groups, selectedPathId, pendingHeroKey);
        if (!uiGroup || uiGroup.paths.length <= 1) {
            variantsHost.hidden = true;
            variantsHost.classList.add('dialogue-theater-path-switch__variants--hidden');
            return;
        }
    }

    const uiGroup = resolveUiHeroGroup(groups, selectedPathId, pendingHeroKey);
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
 * @param {string} pathId
 */
export function highlightPeriodicTablePathSelection(host, conversation, pathId) {
    if (!shouldUsePeriodicTablePathPicker(conversation)) return;

    const segments = resolveSegmentsForPathId(conversation, pathId);
    host.dataset.selectedPathId = pathId;
    host.dataset.pendingHeroKey = '';
    host.dataset.segments = JSON.stringify(segments);

    for (const option of PERIODIC_TABLE_OUTCOMES) {
        const heroTier = host.querySelector(
            `[data-tier="${option.key}"] .dialogue-theater-path-switch__hero-rows`,
        );
        if (!(heroTier instanceof HTMLElement)) continue;

        const groups = buildOutcomePathGroups(conversation, option.key);
        heroTier.innerHTML = renderHeroChipRowsHtml(groups, pathId, { outcomeKey: option.key }).trim();
    }

    const activeGroups = buildOutcomePathGroups(conversation, segments.outcome);
    syncPeriodicTableHeroUi(host, activeGroups, { selectedPathId: pathId });
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {(pathId: string, options?: { autoPlay?: boolean }) => void} [onPathChange]
 */
export function wirePeriodicTablePathSelector(host, conversation, onPathChange) {
    const paths = conversation.paths || [];
    if (paths.length === 0) return;

    const selectedPathId = resolveSelectedPathId(conversation);
    host.dataset.selectedPathId = selectedPathId;
    host.dataset.pendingHeroKey = '';
    host.dataset.segments = JSON.stringify(resolveSegmentsForPathId(conversation, selectedPathId));

    const switcher = host.querySelector('.dialogue-theater-path-switch--periodic-table');
    if (!(switcher instanceof HTMLElement)) return;

    if (host._dialogueTheaterPeriodicClick) {
        switcher.removeEventListener('click', host._dialogueTheaterPeriodicClick);
    }

    host._dialogueTheaterPeriodicClick = (e) => {
        if (!(e.target instanceof Element)) return;

        const variantBtn = e.target.closest('[data-path-id]');
        if (variantBtn instanceof HTMLElement && switcher.contains(variantBtn)) {
            e.preventDefault();
            e.stopPropagation();
            const pathId = variantBtn.dataset.pathId || '';
            if (!pathId) return;
            host.dataset.pendingHeroKey = '';
            host.dataset.selectedPathId = pathId;
            host.dataset.segments = JSON.stringify(resolveSegmentsForPathId(conversation, pathId));
            onPathChange?.(pathId, { autoPlay: true });
            return;
        }

        const chip = e.target.closest('.dialogue-theater-path-switch__hero-chip');
        if (chip instanceof HTMLElement && switcher.contains(chip)) {
            e.preventDefault();
            e.stopPropagation();

            const outcome =
                chip.dataset.outcome ||
                chip.closest('[data-outcome]')?.getAttribute('data-outcome') ||
                resolveSegmentsForPathId(conversation, host.dataset.selectedPathId || selectedPathId).outcome;

            const heroKey = chip.dataset.heroKey || '';
            const groups = buildOutcomePathGroups(conversation, outcome);
            const group = findGroupForHeroKey(groups, heroKey);
            if (!group) return;

            if (group.paths.length === 1) {
                const pathId = group.paths[0].id;
                host.dataset.pendingHeroKey = '';
                host.dataset.selectedPathId = pathId;
                host.dataset.segments = JSON.stringify(resolveSegmentsForPathId(conversation, pathId));
                onPathChange?.(pathId, { autoPlay: true });
                return;
            }

            host.dataset.pendingHeroKey = heroKey;
            const currentPathId = host.dataset.selectedPathId || selectedPathId;
            const hasPathInGroup = group.paths.some((path) => path.id === currentPathId);
            if (!hasPathInGroup) {
                const pathId = group.paths[0].id;
                host.dataset.selectedPathId = pathId;
                host.dataset.segments = JSON.stringify(resolveSegmentsForPathId(conversation, pathId));
                onPathChange?.(pathId, { autoPlay: true });
                return;
            }

            if (hasPathInGroup) {
                onPathChange?.(currentPathId, { autoPlay: true });
                syncPeriodicTableHeroUi(host, groups, {
                    selectedPathId: currentPathId,
                    pendingHeroKey: heroKey,
                    outcome,
                });
                return;
            }
        }
    };

    switcher.addEventListener('click', host._dialogueTheaterPeriodicClick);
}
