/**
 * Prepend hero / faction / NPC / country tokens to the Event Manager search inputs
 * (#eventsSearchFilters and #eventsSearchCountry), then dispatch `input` so the
 * existing search pipeline picks them up.
 */
import {
    factionFilenameToDisplayToken,
    flagFilenameToCommonCountryName
} from './managerSearchTokenResolvers.js';

function prependToCommaList(current, token) {
    const t = String(token || '').trim();
    if (!t) return String(current || '').trim();
    const parts = String(current || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const tl = t.toLowerCase();
    const rest = parts.filter((p) => p.toLowerCase() !== tl);
    return [t, ...rest].join(', ');
}

/** Normalize list so it always ends with `", "` for continued typing / autocomplete. */
function withTrailingCommaSpace(value) {
    let v = String(value || '').trim();
    if (!v) return '';
    v = v.replace(/,\s*$/, '').trim();
    if (!v) return '';
    return `${v}, `;
}

/**
 * @param {object} mgr — EventManager
 * @param {{ heroName?: string, factionFilename?: string, npcName?: string, countryFlagFilename?: string }} [tokens]
 *   Pass one of the four; multiple are allowed but typically one is supplied per call.
 */
export function prependEventManagerSearchTokens(
    mgr,
    { heroName, factionFilename, npcName, countryFlagFilename } = {}
) {
    const filtersInput = document.getElementById('eventsSearchFilters');
    const countryInput = document.getElementById('eventsSearchCountry');
    if (!filtersInput) return;

    if (heroName) {
        const h = String(heroName).trim();
        if (h) filtersInput.value = withTrailingCommaSpace(prependToCommaList(filtersInput.value, h));
    }
    if (factionFilename) {
        const tok = factionFilenameToDisplayToken(mgr, factionFilename);
        if (tok) filtersInput.value = withTrailingCommaSpace(prependToCommaList(filtersInput.value, tok));
    }
    if (npcName) {
        const n = String(npcName).trim();
        if (n) filtersInput.value = withTrailingCommaSpace(prependToCommaList(filtersInput.value, n));
    }
    if (countryFlagFilename && countryInput) {
        const common =
            flagFilenameToCommonCountryName(countryFlagFilename) ||
            String(countryFlagFilename).replace(/\.png$/i, '').trim();
        if (common) {
            countryInput.value = withTrailingCommaSpace(prependToCommaList(countryInput.value, common));
        }
    }

    if (typeof window !== 'undefined') {
        window.__eventsFiltersInputBypassSelectionSync = true;
    }
    try {
        filtersInput.dispatchEvent(new Event('input', { bubbles: true }));
        if (countryInput) countryInput.dispatchEvent(new Event('input', { bubbles: true }));
    } finally {
        if (typeof window !== 'undefined') {
            delete window.__eventsFiltersInputBypassSelectionSync;
        }
    }
}
