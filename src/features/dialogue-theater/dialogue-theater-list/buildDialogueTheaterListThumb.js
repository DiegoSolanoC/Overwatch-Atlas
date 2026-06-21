/**
 * Dialogue Theater list card preview — scene + first two line renders (idle stage layout).
 */

import { sceneImageUrl } from '../data/loadDialogueTheaterAssets.js';
import { getConversationIdleRenderPair, usesFirstSpeakerOnlyPreview } from '../dialogue-theater-stage/dialogueTheaterRenderHelpers.js';

/** @param {string} value */
function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

const THUMB_LOADED_HANDLER =
    "this.closest('.event-item-preview-image')?.classList.remove('event-item-preview-image--loading');";

/**
 * @param {string} src
 * @param {string} className
 * @param {string} [alt='']
 */
function renderImgTag(src, className, alt = '') {
    if (!src) return '';
    return `<img class="${className}" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async" draggable="false" onload="${THUMB_LOADED_HANDLER}" onerror="${THUMB_LOADED_HANDLER}" />`;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 * @param {import('../data/loadDialogueTheaterAssets.js').DialogueTheaterAssets|null|undefined} assets
 * @param {string} spinnerSrc
 * @returns {string}
 */
export function buildDialogueTheaterListThumbMediaHtml(row, assets, spinnerSrc) {
    const rendersMap = assets?.renders || {};
    const sceneSrc = row.scene ? sceneImageUrl(row.scene) : '';
    const { left: leftRenderSrc, right: rightRenderSrc } = getConversationIdleRenderPair(row, rendersMap);
    const hasVisual = !!(sceneSrc || leftRenderSrc || rightRenderSrc);

    if (!hasVisual) {
        return `<div class="event-item-preview-image dialogue-theater-list-thumb" style="display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.35);font-size:12px;">No scene</div>`;
    }

    const spinner = `<img class="event-item-preview-image__spinner" src="${escapeAttr(spinnerSrc)}" alt="" width="56" height="56" decoding="async" draggable="false" />`;
    const scene = sceneSrc
        ? renderImgTag(sceneSrc, 'event-item-preview-image__photo dialogue-theater-list-thumb__scene', row.name || 'Scene')
        : '';
    const leftRender = leftRenderSrc
        ? renderImgTag(leftRenderSrc, 'dialogue-theater-list-thumb__render dialogue-theater-list-thumb__render--left', 'Character')
        : '';
    const rightRender = rightRenderSrc
        ? renderImgTag(rightRenderSrc, 'dialogue-theater-list-thumb__render dialogue-theater-list-thumb__render--right', 'Character')
        : '';

    const soloSpeaker = usesFirstSpeakerOnlyPreview(row);
    const thumbClass = soloSpeaker
        ? 'event-item-preview-image dialogue-theater-list-thumb dialogue-theater-list-thumb--solo-speaker event-item-preview-image--loading'
        : 'event-item-preview-image dialogue-theater-list-thumb event-item-preview-image--loading';

    return `<div class="${thumbClass}">${spinner}${scene}${leftRender}${rightRender}</div>`;
}
