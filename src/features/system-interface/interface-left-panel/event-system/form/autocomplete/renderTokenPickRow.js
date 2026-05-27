/**
 * renderTokenPickRow — append one `.filter-autocomplete-item` `<button>` row to the
 * dropdown built by `FormTokenAutocomplete`.
 *
 * Exactly one of the four `match*` fields is non-null; that decides which icon to load,
 * which label/detail text to use, and which icon CSS modifier to apply:
 *
 *   - **hero**     → `Filters/Heroes/<name>.png`     + `--hero` modifier
 *   - **faction**  → `Filters/Factions/<filename>.png` + `--faction` modifier
 *   - **npc**      → `Filters/NPCs/<name>.png`       + `--npc` modifier
 *   - **country**  → flag image via `LocationFlagHelpers.flagSrc(file)` + `--flag` modifier
 *
 * The picked row calls `onPick()` (and stops propagation) so the host caller can write the
 * chosen value back into the input — the pick text is intentionally not decided here.
 */

export function renderTokenPickRow(listEl, { matchHeroName, matchFaction, matchNpcName, matchCountry, onPick }) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'filter-autocomplete-item';

    const img = document.createElement('img');
    img.className = 'filter-autocomplete-item-icon';
    img.alt = '';
    img.decoding = 'async';
    img.onerror = () => { img.style.visibility = 'hidden'; };

    let labelText = '';
    let detailText = '';

    if (matchHeroName != null) {
        labelText = matchHeroName;
        detailText = 'Hero';
        img.src = `src/assets/images/Filters/Heroes/${encodeURIComponent(matchHeroName)}.png`;
        img.className += ' filter-autocomplete-item-icon--hero';
    } else if (matchFaction != null) {
        labelText = matchFaction.displayName;
        detailText = 'Faction';
        img.src = `src/assets/images/Filters/Factions/${encodeURIComponent(matchFaction.filename)}.png`;
        img.className += ' filter-autocomplete-item-icon--faction';
    } else if (matchNpcName != null) {
        labelText = matchNpcName;
        detailText = 'NPC';
        img.src = `src/assets/images/Filters/NPCs/${encodeURIComponent(matchNpcName)}.png`;
        img.className += ' filter-autocomplete-item-icon--npc';
    } else if (matchCountry != null) {
        labelText = matchCountry;
        detailText = 'Country';
        const map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
        const file = map ? map[matchCountry] : null;
        const flagSrc = window.LocationFlagHelpers && typeof window.LocationFlagHelpers.flagSrc === 'function'
            ? window.LocationFlagHelpers.flagSrc
            : null;
        if (file && flagSrc) {
            img.src = flagSrc(file);
            img.className += ' filter-autocomplete-item-icon--flag';
        } else {
            img.style.display = 'none';
        }
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'filter-autocomplete-item-label';
    labelSpan.textContent = labelText;

    const detailSpan = document.createElement('span');
    detailSpan.className = 'filter-autocomplete-item-detail';
    detailSpan.textContent = detailText;

    row.appendChild(img);
    row.appendChild(labelSpan);
    row.appendChild(detailSpan);
    row.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick();
    });
    listEl.appendChild(row);
}
