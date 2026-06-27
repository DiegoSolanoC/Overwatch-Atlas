/**
 * Four-tier route picker — Before the Crisis (asker → job → reactor → epilogue).
 */

import { heroFilterIconUrl } from '../data/loadDialogueTheaterAssets.js';
import { resolveSelectedPathId } from '../data/dialogueTheaterPathHelpers.js';
import {
    BEFORE_THE_CRISIS_ASKERS,
    BEFORE_THE_CRISIS_EPILOGUES,
    BEFORE_THE_CRISIS_JOBS,
    BEFORE_THE_CRISIS_REACTORS,
    findPathIdForSegments,
    isBeforeTheCrisisConversation,
    resolveSegmentsForPathId,
    shouldUseTieredPathPicker,
} from './beforeTheCrisisPathConfig.js';

export { isBeforeTheCrisisConversation, shouldUseTieredPathPicker };

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
 * @param {{ key: string, hero?: string, label: string }} option
 * @param {string} tierKey
 * @param {string} activeKey
 * @param {'chip'|'text'} variant
 */
function renderTierOptionHtml(option, tierKey, activeKey, variant) {
    const isActive = option.key === activeKey;
    if (variant === 'chip' && option.hero) {
        const wrapClass = isActive ? ' gallery-hero-filters__chip-wrap--active' : '';
        const chipClass = isActive ? ' filter-btn--active' : '';
        return `
            <div class="gallery-hero-filters__chip-wrap dialogue-theater-path-switch__hero-wrap${wrapClass}" data-tier="${escapeHtml(tierKey)}" data-segment-key="${escapeHtml(option.key)}">
                <button
                    type="button"
                    class="filter-btn gallery-hero-filters__chip dialogue-theater-path-switch__hero-chip${chipClass}"
                    data-tier="${escapeHtml(tierKey)}"
                    data-segment-key="${escapeHtml(option.key)}"
                    aria-pressed="${isActive ? 'true' : 'false'}"
                    aria-label="${escapeHtml(option.label)}"
                >
                    <div class="filter-image-container">
                        <img src="${escapeHtml(heroFilterIconUrl(option.hero))}" alt="" loading="lazy" />
                    </div>
                    <div class="filter-label">
                        <span class="filter-label-text">${escapeHtml(option.hero)}</span>
                    </div>
                </button>
            </div>
        `;
    }

    return `
        <button
            type="button"
            class="dialogue-theater-path-switch__option${isActive ? ' dialogue-theater-path-switch__option--active' : ''}"
            data-tier="${escapeHtml(tierKey)}"
            data-segment-key="${escapeHtml(option.key)}"
            aria-pressed="${isActive ? 'true' : 'false'}"
        >${escapeHtml(option.label)}</button>
    `;
}

/**
 * @param {string} label
 * @param {string} tierKey
 * @param {{ key: string, hero?: string, label: string }[]} options
 * @param {string} activeKey
 * @param {'chip'|'text'} variant
 */
function renderTierSectionHtml(label, tierKey, options, activeKey, variant) {
    const optionsHtml =
        variant === 'chip'
            ? `<div class="dialogue-theater-path-switch__hero-row gallery-hero-filters__chips-row gallery-hero-filters__chips-row--flat dialogue-theater-path-switch__hero-row--partial" role="presentation">
                    ${options.map((option) => renderTierOptionHtml(option, tierKey, activeKey, variant)).join('')}
               </div>`
            : `<div class="dialogue-theater-path-switch__options" role="tablist" aria-label="${escapeHtml(label)}">
                    ${options.map((option) => renderTierOptionHtml(option, tierKey, activeKey, variant)).join('')}
               </div>`;

    return `
        <div class="dialogue-theater-path-switch__tier" data-tier="${escapeHtml(tierKey)}">
            <span class="dialogue-theater-path-switch__label">${escapeHtml(label)}</span>
            ${optionsHtml}
        </div>
    `;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} selectedPathId
 * @returns {string}
 */
export function renderTieredPathSwitcherHtml(conversation, selectedPathId) {
    const segments = resolveSegmentsForPathId(conversation, selectedPathId);

    return `
        <div class="dialogue-theater-path-switch dialogue-theater-path-switch--tiered">
            <div class="dialogue-theater-path-switch__head">
                <span class="dialogue-theater-path-switch__label">Route</span>
                <button
                    type="button"
                    id="dialogueTheaterMasterPlayBtn"
                    class="dialogue-theater-path-switch__master-play"
                    aria-label="Play a random full route"
                >▶ Random play</button>
            </div>
            ${renderTierSectionHtml('Who asks?', 'asker', BEFORE_THE_CRISIS_ASKERS, segments.asker, 'chip')}
            ${renderTierSectionHtml('Zenyatta says…', 'job', BEFORE_THE_CRISIS_JOBS, segments.job, 'text')}
            ${renderTierSectionHtml('Who reacts?', 'reactor', BEFORE_THE_CRISIS_REACTORS, segments.reactor, 'chip')}
            ${renderTierSectionHtml('Epilogue', 'epilogue', BEFORE_THE_CRISIS_EPILOGUES, segments.epilogue, 'chip')}
        </div>
    `;
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} pathId
 */
export function highlightTieredPathSelection(host, conversation, pathId) {
    if (!shouldUseTieredPathPicker(conversation)) return;

    const segments = resolveSegmentsForPathId(conversation, pathId);
    host.dataset.selectedPathId = pathId;
    host.dataset.segments = JSON.stringify(segments);

    host.querySelectorAll('[data-tier][data-segment-key]').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const tier = el.dataset.tier || '';
        const key = el.dataset.segmentKey || '';
        const activeKey = segments[tier];
        const isActive = key === activeKey;

        if (el.classList.contains('dialogue-theater-path-switch__hero-chip')) {
            el.classList.toggle('filter-btn--active', isActive);
            el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            const wrap = el.closest('.dialogue-theater-path-switch__hero-wrap');
            if (wrap instanceof HTMLElement) {
                wrap.classList.toggle('gallery-hero-filters__chip-wrap--active', isActive);
            }
        } else if (el.classList.contains('dialogue-theater-path-switch__option')) {
            el.classList.toggle('dialogue-theater-path-switch__option--active', isActive);
            el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }
    });
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {(pathId: string, options?: { autoPlay?: boolean }) => void} [onPathChange]
 */
export function wireTieredPathSelector(host, conversation, onPathChange) {
    const paths = conversation.paths || [];
    if (paths.length === 0) return;

    const selectedPathId = resolveSelectedPathId(conversation);
    host.dataset.selectedPathId = selectedPathId;
    host.dataset.segments = JSON.stringify(resolveSegmentsForPathId(conversation, selectedPathId));

    const switcher = host.querySelector('.dialogue-theater-path-switch--tiered');
    if (!(switcher instanceof HTMLElement)) return;

    if (host._dialogueTheaterTierClick) {
        switcher.removeEventListener('click', host._dialogueTheaterTierClick);
    }

    host._dialogueTheaterTierClick = (e) => {
        const target =
            e.target instanceof Element
                ? e.target.closest('[data-tier][data-segment-key]')
                : null;
        if (!(target instanceof HTMLElement) || !switcher.contains(target)) return;

        e.preventDefault();
        e.stopPropagation();

        const tier = target.dataset.tier || '';
        const segmentKey = target.dataset.segmentKey || '';
        if (!tier || !segmentKey) return;

        let segments;
        try {
            segments = JSON.parse(host.dataset.segments || '{}');
        } catch {
            segments = resolveSegmentsForPathId(conversation, host.dataset.selectedPathId || selectedPathId);
        }

        if (segments[tier] === segmentKey) {
            const currentPathId = host.dataset.selectedPathId || selectedPathId;
            if (currentPathId) {
                onPathChange?.(currentPathId, { autoPlay: true });
            }
            return;
        }

        segments[tier] = segmentKey;
        const pathId = findPathIdForSegments(conversation, segments);
        if (!pathId) return;

        host.dataset.segments = JSON.stringify(segments);
        host.dataset.selectedPathId = pathId;
        onPathChange?.(pathId, { autoPlay: true });
    };

    switcher.addEventListener('click', host._dialogueTheaterTierClick);
}
