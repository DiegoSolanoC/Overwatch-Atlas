/**
 * Story event preview badge fields for map/globe hover labels (inline slide editor).
 * Three comma-token fields: main character, secondary characters, faction.
 */

import {
    canonicalizeFactionTokens,
    canonicalizeHeroTokens,
    canonicalizeNpcTokens
} from './storyEventFilterPlaces.js';
import { resolveNpcCanonicalName } from './npcNameAliases.js';

function splitCsvTokens(raw) {
    return String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function joinCsvTokens(tokens) {
    return tokens.filter(Boolean).join(', ');
}

function canonicalizeHeroOrNpcCsv(raw) {
    const parts = splitCsvTokens(raw);
    const heroes = [];
    const npcs = [];
    const heroSet = new Set(
        (window.eventManager?.heroes || window.globeController?.dataModel?.heroes || []).map((h) =>
            String(h).toLowerCase()
        )
    );
    const npcSet = new Set((window.eventManager?.npcs || []).map((n) => String(n).toLowerCase()));

    parts.forEach((token) => {
        const resolved = resolveNpcCanonicalName(token);
        const lower = resolved.toLowerCase();
        if (npcSet.has(lower)) {
            npcs.push(resolved);
        } else {
            heroes.push(token);
        }
    });

    const out = [
        ...canonicalizeHeroTokens(heroes),
        ...canonicalizeNpcTokens(npcs)
    ];
    return joinCsvTokens(out);
}

/** @param {object|null|undefined} target */
export function readPreviewBadgesFromTarget(target) {
    if (!target || typeof target !== 'object') {
        return { main: '', secondary: '', faction: '' };
    }
    return {
        main: target.previewBadgeMainCharacter != null ? String(target.previewBadgeMainCharacter) : '',
        secondary:
            target.previewBadgeSecondaryCharacters != null
                ? String(target.previewBadgeSecondaryCharacters)
                : '',
        faction: target.previewBadgeFaction != null ? String(target.previewBadgeFaction) : ''
    };
}

/**
 * @param {object} target
 * @param {{ main?: string, secondary?: string, faction?: string }} values
 */
export function applyPreviewBadgesToTarget(target, values) {
    if (!target || typeof target !== 'object') return;

    const main = canonicalizeHeroOrNpcCsv(values?.main);
    const secondary = canonicalizeHeroOrNpcCsv(values?.secondary);
    const faction = joinCsvTokens(canonicalizeFactionTokens(splitCsvTokens(values?.faction)));

    if (main) target.previewBadgeMainCharacter = main;
    else delete target.previewBadgeMainCharacter;

    if (secondary) target.previewBadgeSecondaryCharacters = secondary;
    else delete target.previewBadgeSecondaryCharacters;

    if (faction) target.previewBadgeFaction = faction;
    else delete target.previewBadgeFaction;
}

/**
 * Wire filter autocomplete on the three preview badge inputs (story slide edit).
 * @param {*} auto FormTokenAutocomplete instance
 */
export function setupPreviewBadgeInputsAutocomplete(auto) {
    if (!auto || typeof auto.setupAutocomplete !== 'function') return;

    const heroes = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
    const npcList = window.eventManager?.npcs || [];
    const factionList =
        window.eventManager?.factions?.length > 0
            ? window.eventManager.factions
            : window.globeController?.dataModel?.factions || [];

    const heroNpcOpts = { heroes, npcs: npcList };

    ['eventSlideEditPreviewBadgeMain', 'eventSlideEditPreviewBadgeSecondary'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.dataset.autocompleteSetup = 'false';
        auto.setupAutocomplete(el, heroNpcOpts, 'heroesAndNpcs');
    });

    const facEl = document.getElementById('eventSlideEditPreviewBadgeFaction');
    if (facEl) {
        facEl.dataset.autocompleteSetup = 'false';
        auto.setupAutocomplete(facEl, factionList, 'factions');
    }
}
