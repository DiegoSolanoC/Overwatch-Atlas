/**
 * Chatters list — Overwatch-style Tank | Damage | Support hero select grid.
 * Uses the shared hero-role board (same `.chatters-hero-*` visuals).
 */

import { buildHeroRoleSelectBoard } from '../../shared/hero-role-select/buildHeroRoleSelectBoard.js';
import {
    resolveManifestHeroId,
} from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { heroFilterIconUrl } from '../data/loadDialogueTheaterAssets.js';

/**
 * @returns {string[]}
 */
function manifestHeroes() {
    const fs = typeof window !== 'undefined' ? window.FilterService : null;
    return Array.isArray(fs?.heroes) ? fs.heroes : [];
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 * @param {string[]} heroes
 * @returns {string}
 */
function resolveChatterHeroId(row, heroes) {
    const fromName = resolveManifestHeroId(row?.name, heroes);
    if (fromName) return fromName;
    const lineHero = row?.lines?.find((line) => String(line?.hero || '').trim())?.hero;
    return resolveManifestHeroId(lineHero, heroes) || '';
}

/**
 * @param {string} label
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} row
 * @param {number} index1Based
 */
function showChatterSummaryBadge(label, row, index1Based) {
    const badge = typeof window !== 'undefined' ? window.SummaryInfoBadge : null;
    if (!badge?.show) return;
    const lineCount = Array.isArray(row?.lines) ? row.lines.length : 0;
    const num = Number.isFinite(index1Based) && index1Based > 0 ? index1Based : null;
    badge.show(
        num,
        label,
        [],
        'Chatter',
        null,
        [],
        lineCount > 0 ? `${lineCount} line${lineCount === 1 ? '' : 's'}` : '',
    );
}

function hideChatterSummaryBadge() {
    window.SummaryInfoBadge?.hide?.();
}

/**
 * Build Tank | Damage | Support (+ Unassigned if needed) hero select board.
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation[]} rows
 * @param {(conversationId: string) => void} onSelect
 * @returns {Promise<HTMLElement>}
 */
export async function buildChattersHeroSelectGrid(rows, onSelect) {
    const heroes = manifestHeroes();
    /** @type {Map<string, import('../data/DialogueTheaterDataService.js').DialogueConversation>} */
    const byHeroId = new Map();

    for (const row of rows) {
        const heroId = resolveChatterHeroId(row, heroes);
        if (heroId && !byHeroId.has(heroId)) {
            byHeroId.set(heroId, row);
        } else if (!heroId) {
            const fallbackId = String(row.name || row.id);
            if (fallbackId && !byHeroId.has(fallbackId)) {
                byHeroId.set(fallbackId, row);
            }
        }
    }

    /** @type {Map<string, number>} */
    const indexById = new Map();
    rows.forEach((row, i) => {
        if (row?.id) indexById.set(row.id, i + 1);
    });

    return buildHeroRoleSelectBoard([...byHeroId.keys()], {
        ariaLabel: 'Hero chatters',
        ariaLabelSuffix: 'chatters',
        iconUrl: (heroId) => {
            const row = byHeroId.get(heroId);
            return heroFilterIconUrl(heroId) || heroFilterIconUrl(row?.name) || '';
        },
        onCardHover: (heroId, label) => {
            const row = byHeroId.get(heroId);
            if (!row) return;
            showChatterSummaryBadge(label, row, indexById.get(row.id) || 0);
        },
        onCardLeave: hideChatterSummaryBadge,
        onSelect: (heroId) => {
            const row = byHeroId.get(heroId);
            if (row?.id) onSelect(row.id);
        },
    });
}
