/**
 * Serialize an event's stored `factions[]` (manifest filename tokens) into the
 * comma-separated user-facing string the edit form shows.
 *
 * For each token, we look up the manifest entry whose `filename` or `displayName` matches,
 * preferring the manifest's `displayName`. Matching also runs through
 * `window.FactionMatchHelpers.factionIdsMatch` to absorb whitespace/casing quirks. Tokens
 * with no manifest match fall back to stripping a leading numeric prefix (legacy ordering
 * prefixes like `"0123Faction"` → `"Faction"`).
 *
 * Mirrors the matching rules used by `populateEditForm` / `loadVariantToForm`.
 *
 * @param {string[]} factionTokens
 * @param {{ filename?: string, displayName?: string }[]} manifestFactions
 */
export function factionsArrayToFormDisplayString(factionTokens, manifestFactions) {
    const list = Array.isArray(manifestFactions) ? manifestFactions : [];
    const raw = Array.isArray(factionTokens) ? factionTokens : [];
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    return raw.map((f) => {
        const token = String(f ?? '').trim();
        if (!token) return '';
        const hit = list.find((fac) =>
            fac.filename === token
            || fac.displayName === token
            || (fh && typeof fh.factionIdsMatch === 'function' && (
                fh.factionIdsMatch(fac.filename, token) || fh.factionIdsMatch(fac.displayName, token)
            ))
        );
        return hit ? String(hit.displayName || '').trim() : String(f).replace(/^\d+/, '').trim();
    }).filter(Boolean).join(', ');
}
