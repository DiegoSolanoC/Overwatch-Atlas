/**
 * NPCs archive: the "NPC category" input on the static bio edit strip.
 */

export function syncNpcCategoryBioPanelVisibility(archiveSource, npcCategoryForPopulate) {
    const panel = document.getElementById('eventSlideNpcCategoryBioPanel');
    const input = document.getElementById('eventSlideEditNpcCategoryBio');
    if (!panel || !input) return;
    const src = archiveSource != null ? String(archiveSource) : '';
    if (src === 'npcs') {
        panel.removeAttribute('hidden');
        panel.style.display = '';
        input.value = npcCategoryForPopulate != null ? String(npcCategoryForPopulate) : '';
    } else {
        panel.setAttribute('hidden', 'hidden');
        panel.style.display = 'none';
        input.value = '';
    }
}

export function readNpcCategoryBioPanelTrimmed() {
    const input = document.getElementById('eventSlideEditNpcCategoryBio');
    return (input?.value ?? '').trim();
}
