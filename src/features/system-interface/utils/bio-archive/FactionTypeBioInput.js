/**
 * Factions archive: the "Faction type" input on the static bio edit strip
 * (`#eventSlideHeroLocationsEdit`).
 *
 * Why this lives outside the inline editor: `#eventSlideInlineEditor` is
 * hidden when the user is editing a satellite (heroes/factions/NPCs) row, so
 * any field that must persist across that hide goes into the static strip.
 */

export function syncFactionTypeBioPanelVisibility(archiveSource, factionTypeForPopulate) {
    const panel = document.getElementById('eventSlideFactionTypeBioPanel');
    const input = document.getElementById('eventSlideEditFactionTypeBio');
    if (!panel || !input) return;
    const src = archiveSource != null ? String(archiveSource) : '';
    if (src === 'factions') {
        panel.removeAttribute('hidden');
        panel.style.display = '';
        input.value = factionTypeForPopulate != null ? String(factionTypeForPopulate) : '';
    } else {
        panel.setAttribute('hidden', 'hidden');
        panel.style.display = 'none';
        input.value = '';
    }
}

export function readFactionTypeBioPanelTrimmed() {
    const input = document.getElementById('eventSlideEditFactionTypeBio');
    return (input?.value ?? '').trim();
}
