/**
 * Portrait fill behind gallery-style bio chips.
 * Heroes / NPCs → semi-transparent black.
 * Factions → semi-transparent Codex node bgColor for that faction.
 */

import {
    loadCodexNodesForGalleryStyle,
    codexVisualStyleForEntity,
    hexToRgba,
} from './galleryConnectionCanvasCodexStyle.js';
import { resolveCodexNodeBgColor, CODEX_NODE_BG_DEFAULT } from '../../codex/codex-nodes/placement/CodexNodeBgColor.js';

export const BIO_CHIP_PORTRAIT_BG_OPACITY = 0.5;
export const BIO_CHIP_HERO_NPC_BG = `rgba(0, 0, 0, ${BIO_CHIP_PORTRAIT_BG_OPACITY})`;

/**
 * @param {string | null | undefined} hex
 * @returns {string}
 */
export function factionChipPortraitBgFromHex(hex) {
    return hexToRgba(resolveCodexNodeBgColor(hex), BIO_CHIP_PORTRAIT_BG_OPACITY);
}

/**
 * @param {HTMLElement} chipEl
 * @param {'heroes'|'factions'|'npcs'|'hero'|'faction'|'npc'|string} kind
 * @param {string} [token]
 * @param {object[]} [codexNodes]
 */
export function applyBioChipPortraitBackground(chipEl, kind, token = '', codexNodes = null) {
    if (!chipEl || !chipEl.style) return;
    const k = String(kind || '').toLowerCase();
    const isFaction = k === 'factions' || k === 'faction';
    if (!isFaction) {
        chipEl.style.setProperty('--bio-chip-portrait-bg', BIO_CHIP_HERO_NPC_BG);
        return;
    }

    const style = Array.isArray(codexNodes)
        ? codexVisualStyleForEntity('faction', token, codexNodes)
        : null;
    const hex = style?.bgColor || CODEX_NODE_BG_DEFAULT;
    chipEl.style.setProperty('--bio-chip-portrait-bg', factionChipPortraitBgFromHex(hex));
}

/**
 * @param {HTMLElement} chipEl
 * @returns {{ kind: string, token: string }}
 */
function resolveChipKindAndToken(chipEl) {
    const filterType = String(chipEl.dataset.filterType || chipEl.dataset.bioCategory || '').toLowerCase();
    if (filterType === 'factions' || filterType === 'heroes' || filterType === 'npcs') {
        return {
            kind: filterType,
            token: String(chipEl.dataset.filterKey || '').trim(),
        };
    }

    if (chipEl.classList.contains('event-slide-filter-token-chip--clickable-faction')
        || chipEl.hasAttribute('data-faction-open')) {
        let token = '';
        try {
            token = decodeURIComponent(chipEl.getAttribute('data-faction-open') || '');
        } catch (_) {
            token = String(chipEl.getAttribute('data-faction-open') || '');
        }
        return { kind: 'factions', token };
    }
    if (chipEl.classList.contains('event-slide-filter-token-chip--clickable-npc')
        || chipEl.hasAttribute('data-npc-open')) {
        return { kind: 'npcs', token: '' };
    }
    if (chipEl.classList.contains('event-slide-filter-token-chip--clickable-hero')
        || chipEl.hasAttribute('data-hero-open')) {
        return { kind: 'heroes', token: '' };
    }

    const wrap = chipEl.closest('[data-bio-category]');
    if (wrap?.dataset?.bioCategory) {
        return {
            kind: String(wrap.dataset.bioCategory),
            token: String(chipEl.dataset.filterKey || '').trim(),
        };
    }

    return { kind: 'heroes', token: '' };
}

/**
 * Paint every gallery-style chip under `root` (defaults to document).
 * @param {ParentNode | null | undefined} root
 * @returns {Promise<void>}
 */
export async function paintBioChipPortraitBackgrounds(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const chips = root.querySelectorAll(
        '.gallery-hero-filters__chip.filter-btn, .event-slide-filter-token-chip.gallery-hero-filters__chip',
    );
    if (!chips.length) return;

    let needsCodex = false;
    for (let i = 0; i < chips.length; i += 1) {
        const { kind } = resolveChipKindAndToken(chips[i]);
        if (kind === 'factions' || kind === 'faction') {
            needsCodex = true;
            break;
        }
    }

    const codexNodes = needsCodex ? await loadCodexNodesForGalleryStyle() : null;

    for (let i = 0; i < chips.length; i += 1) {
        const chip = chips[i];
        const { kind, token } = resolveChipKindAndToken(chip);
        applyBioChipPortraitBackground(chip, kind, token, codexNodes);
    }
}

if (typeof window !== 'undefined') {
    window.__BioChipPortraitBackground = {
        BIO_CHIP_HERO_NPC_BG,
        applyBioChipPortraitBackground,
        paintBioChipPortraitBackgrounds,
        factionChipPortraitBgFromHex,
    };
}
