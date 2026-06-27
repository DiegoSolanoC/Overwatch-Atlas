/**
 * Detect multi-route conversations whose path labels are hero names (chip picker candidates).
 */

import {
    heroNamesLooselyEqual,
    resolveManifestHeroId,
} from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { getCachedManifestHeroes } from '../data/loadDialogueTheaterAssets.js';

/**
 * @param {string} label
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function isPureHeroPathLabel(label, manifestHeroes = getCachedManifestHeroes()) {
    const text = String(label || '').trim();
    if (!text || text.includes(' — ') || text.includes('/')) return false;

    const heroes = Array.isArray(manifestHeroes) ? manifestHeroes : [];
    if (heroes.length === 0) return false;

    const resolved = resolveManifestHeroId(text, heroes);
    return heroes.some((id) => heroNamesLooselyEqual(id, resolved));
}

/**
 * Every route label is a single manifest hero name (no snippet / compound labels).
 *
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string[]} [manifestHeroes]
 * @returns {boolean}
 */
export function conversationUsesHeroPathLabels(conversation, manifestHeroes = getCachedManifestHeroes()) {
    const paths = conversation?.paths || [];
    if (paths.length < 2) return false;
    return paths.every((path) => isPureHeroPathLabel(path?.label, manifestHeroes));
}
