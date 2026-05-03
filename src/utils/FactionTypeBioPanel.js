/**
 * Factions archive: "Faction type" lives in the static bio edit strip (#eventSlideHeroLocationsEdit)
 * because MenuHelpers / MenuServiceHelpers hide #eventSlideInlineEditor for satellite bio edit.
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
