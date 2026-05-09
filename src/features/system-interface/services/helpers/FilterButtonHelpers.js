/**
 * FilterButtonHelpers - Utilities for creating and managing filter buttons
 * Extracted from FilterService to reduce file size
 */

/**
 * Get hero display name (maps filename to display name)
 */
export function getHeroDisplayName(heroName) {
    const heroDisplayNames = {
        'Soldier 76': 'Soldier: 76'
    };
    return heroDisplayNames[heroName] || heroName;
}

/**
 * Match a factions-archive row `name` to a manifest faction entry (filename / displayName).
 * @param {string} rowName
 * @param {Array<{ filename?: string, displayName?: string }>} factions
 * @returns {{ filename: string, displayName?: string }|null}
 */
export function matchFactionManifestToArchiveRowName(rowName, factions) {
    const raw = String(rowName || '').trim();
    if (!raw || !Array.isArray(factions) || factions.length === 0) return null;
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    for (let i = 0; i < factions.length; i++) {
        const f = factions[i];
        if (!f?.filename) continue;
        if (fh && typeof fh.factionIdsMatch === 'function') {
            if (fh.factionIdsMatch(raw, f.filename) || fh.factionIdsMatch(raw, f.displayName)) {
                return f;
            }
        }
    }
    const rl = raw.toLowerCase();
    for (let i = 0; i < factions.length; i++) {
        const f = factions[i];
        if (!f?.filename) continue;
        const d = String(f.displayName || '').trim().toLowerCase();
        if (d && rl === d) return f;
    }
    return null;
}

/**
 * Match a heroes-archive row `name` to a manifest hero id (string from manifest.json `heroes[]`).
 * @param {string} rowName
 * @param {string[]} heroes
 * @returns {string|null}
 */
export function matchHeroManifestToArchiveRowName(rowName, heroes) {
    if (!Array.isArray(heroes) || heroes.length === 0) return null;
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    if (em && typeof em._heroArchiveNamesLooselyEqual === 'function') {
        for (let i = 0; i < heroes.length; i++) {
            const h = heroes[i];
            if (em._heroArchiveNamesLooselyEqual(rowName, h)) return h;
        }
        return null;
    }
    const rl = String(rowName || '').trim().toLowerCase();
    if (!rl) return null;
    for (let i = 0; i < heroes.length; i++) {
        const h = heroes[i];
        if (String(h || '').trim().toLowerCase() === rl) return h;
    }
    return null;
}

/**
 * Get filter key and display name based on type
 */
export function getFilterKeyAndDisplayName(item, type) {
    if (type === 'factions') {
        return { filterKey: item.filename, displayName: item.displayName };
    } else if (type === 'npcs') {
        return {
            filterKey: item,
            displayName: getHeroDisplayName(item)
        };
    } else if (type === 'countries') {
        const flagFile = item && item.flagFile != null ? String(item.flagFile).trim() : '';
        const commonName = item && item.commonName != null ? String(item.commonName).trim() : '';
        return {
            filterKey: flagFile ? `country:${flagFile}` : '',
            displayName: commonName || flagFile
        };
    } else if (type === 'music') {
        return {
            filterKey: `src/assets/audio/music/${item.filename}`,
            displayName: item.name
        };
    } else {
        // heroes
        return {
            filterKey: item,
            displayName: getHeroDisplayName(item)
        };
    }
}

/**
 * Create image element for filter button
 */
export function createFilterImage(filterKey, displayName, type, folder, imageService) {
    const pathItem = type === 'factions'
        ? { filename: filterKey }
        : (type === 'countries' && typeof filterKey === 'string' && filterKey.startsWith('country:'))
            ? { flagFile: filterKey.slice('country:'.length).trim() }
            : filterKey;
    const imagePath = imageService.buildImagePath(pathItem, type, folder);
    const img = imageService.createImageElement(imagePath, type, filterKey, folder);
    img.alt = displayName;
    return img;
}

/**
 * Attach click handler to filter button
 */
export function attachFilterButtonClickHandler(filterBtn, filterKey, stateManager, soundManager, updateFilterCounts) {
    filterBtn.addEventListener('click', () => {
        const isSelected = stateManager.has(filterKey);

        if (isSelected) {
            stateManager.remove(filterKey);
            filterBtn.classList.remove('selected');
            if (soundManager) { soundManager.play('filterOff'); }
        } else {
            stateManager.add(filterKey);
            filterBtn.classList.add('selected');
            if (soundManager) { soundManager.play('filterPick'); }
        }
        updateFilterCounts();
    });
}

/**
 * Create a single filter button element
 */
export function createFilterButtonElement(item, type, folder, stateManager, imageService, soundManager, updateFilterCounts) {
    const { filterKey, displayName } = getFilterKeyAndDisplayName(item, type);

    const filterBtn = document.createElement('div');
    filterBtn.className = 'filter-btn';
    filterBtn.dataset.filterType = type;
    filterBtn.dataset.filterKey = filterKey;

    // Image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'filter-image-container';
    const img = createFilterImage(filterKey, displayName, type, folder, imageService);
    imageContainer.appendChild(img);

    // Label (outer centers; inner holds line-clamp for long names)
    const label = document.createElement('div');
    label.className = 'filter-label';
    const labelText = document.createElement('span');
    labelText.className = 'filter-label-text';
    labelText.textContent = displayName;
    label.appendChild(labelText);

    filterBtn.appendChild(imageContainer);
    filterBtn.appendChild(label);

    // Set initial selection state
    if (stateManager.has(filterKey)) {
        filterBtn.classList.add('selected');
    }

    // Attach click handler
    attachFilterButtonClickHandler(filterBtn, filterKey, stateManager, soundManager, updateFilterCounts);

    return filterBtn;
}

/**
 * Use cached buttons if available
 */
export function useCachedButtons(type, buttonCache, filtersGrid, stateManager, updateFilterCounts) {
    if (!buttonCache[type]) return false;

    filtersGrid.innerHTML = '';
    buttonCache[type].forEach((cachedBtn) => {
        const filterKey = cachedBtn.dataset.filterKey;
        if (filterKey) {
            if (stateManager.has(filterKey)) {
                cachedBtn.classList.add('selected');
            } else {
                cachedBtn.classList.remove('selected');
            }
        }
        filtersGrid.appendChild(cachedBtn);
    });
    updateFilterCounts();
    return true;
}

/** @type {unknown[]|null} */
let __heroesArchiveFileCache = null;
/** @type {unknown[]|null} */
let __factionsArchiveFileCache = null;

/**
 * Drop in-memory file snapshots so the next grouped filter build re-reads disk / LS.
 * Call when switching bio archives so layout data cannot go stale across modes.
 */
export function invalidateArchiveLayoutFileCaches() {
    __heroesArchiveFileCache = null;
    __factionsArchiveFileCache = null;
}

async function fetchJsonEventsIntoCache(url, assign) {
    try {
        const res = await fetch(`${url}?v=${Date.now()}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        assign(Array.isArray(data?.events) ? data.events : []);
    } catch (_) {
        assign([]);
    }
}

/**
 * When the Event Manager is not on that archive, ensure we have rows for grouped filters:
 * prefer localStorage satellite copy, else one fetch of the repo JSON.
 * @param {'heroes'|'factions'} type
 */
export async function ensureArchiveLayoutSnapshotsForFilter(type) {
    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';
    if (type === 'heroes' && arch !== 'heroes') {
        try {
            const raw = localStorage.getItem('timelineEventsArchiveHeroes');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return;
            }
        } catch (_) {}
        if (!__heroesArchiveFileCache || __heroesArchiveFileCache.length === 0) {
            await fetchJsonEventsIntoCache('src/data/story-archive-heroes.json', (a) => {
                __heroesArchiveFileCache = a;
            });
        }
    }
    if (type === 'factions' && arch !== 'factions') {
        try {
            const raw = localStorage.getItem('timelineEventsArchiveFactions');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return;
            }
        } catch (_) {}
        if (!__factionsArchiveFileCache || __factionsArchiveFileCache.length === 0) {
            await fetchJsonEventsIntoCache('src/data/story-archive-factions.json', (a) => {
                __factionsArchiveFileCache = a;
            });
        }
    }
}

/** @param {unknown} ev */
function snapshotFactionArchiveRowForGrouping(ev) {
    if (!ev || typeof ev !== 'object') return { name: '', factionType: '' };
    const vars = ev.variants;
    if (Array.isArray(vars) && vars.length > 0) {
        const v0 = vars[0] || {};
        return {
            name: String(v0.name != null ? v0.name : ev.name || '').trim(),
            factionType: String(v0.factionType != null ? v0.factionType : '').trim()
        };
    }
    return {
        name: String(ev.name != null ? ev.name : '').trim(),
        factionType: String(ev.factionType != null ? ev.factionType : '').trim()
    };
}

/** @param {unknown} ev */
function snapshotHeroArchiveRowForGrouping(ev) {
    if (!ev || typeof ev !== 'object') return { name: '', heroRole: '', heroSubRole: '' };
    const vars = ev.variants;
    if (Array.isArray(vars) && vars.length > 0) {
        const v0 = vars[0] || {};
        return {
            name: String(v0.name != null ? v0.name : ev.name || '').trim(),
            heroRole: String(v0.heroRole != null ? v0.heroRole : '').trim(),
            heroSubRole: String(v0.heroSubRole != null ? v0.heroSubRole : '').trim()
        };
    }
    return {
        name: String(ev.name != null ? ev.name : '').trim(),
        heroRole: String(ev.heroRole != null ? ev.heroRole : '').trim(),
        heroSubRole: String(ev.heroSubRole != null ? ev.heroSubRole : '').trim()
    };
}

function getFactionsArchiveRowsForFilterGrouping() {
    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';
    if (arch === 'factions' && Array.isArray(window.eventManager?.events)) {
        return window.eventManager.events.map(snapshotFactionArchiveRowForGrouping);
    }
    try {
        const raw = localStorage.getItem('timelineEventsArchiveFactions');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map(snapshotFactionArchiveRowForGrouping);
            }
        }
    } catch (_) {}
    if (Array.isArray(__factionsArchiveFileCache) && __factionsArchiveFileCache.length > 0) {
        return __factionsArchiveFileCache.map(snapshotFactionArchiveRowForGrouping);
    }
    return [];
}

function getHeroesArchiveRowsForFilterGrouping() {
    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';
    if (arch === 'heroes' && Array.isArray(window.eventManager?.events)) {
        return window.eventManager.events.map(snapshotHeroArchiveRowForGrouping);
    }
    try {
        const raw = localStorage.getItem('timelineEventsArchiveHeroes');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map(snapshotHeroArchiveRowForGrouping);
            }
        }
    } catch (_) {}
    if (Array.isArray(__heroesArchiveFileCache) && __heroesArchiveFileCache.length > 0) {
        return __heroesArchiveFileCache.map(snapshotHeroArchiveRowForGrouping);
    }
    return [];
}

/**
 * Factions archive: section headers (same order as Event Manager list) + manifest chips per type group.
 */
function buildGroupedFactionArchiveFilterDom(
    items,
    folder,
    filtersGrid,
    stateManager,
    imageService,
    soundManager,
    updateFilterCounts
) {
    const fgo = typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers : null;
    const cachedButtons = [];
    filtersGrid.innerHTML = '';

    if (!fgo || typeof fgo.normalizeFactionArchiveType !== 'function' || !Array.isArray(items) || items.length === 0) {
        return cachedButtons;
    }

    const events = getFactionsArchiveRowsForFilterGrouping();
    if (typeof fgo.sortFactionsArchiveEventsStable === 'function') {
        fgo.sortFactionsArchiveEventsStable(events);
    }

    const usedFilenames = new Set();
    let lastKey = null;
    let pendingLabel = '';
    /** @type {Array<{ filename: string, displayName?: string }>} */
    let pending = [];

    const flush = () => {
        if (pending.length === 0) return;
        const sep = document.createElement('div');
        sep.className = 'filters-grid-type-separator';
        sep.setAttribute('role', 'separator');
        sep.setAttribute('aria-label', pendingLabel);
        sep.textContent = pendingLabel;
        filtersGrid.appendChild(sep);
        cachedButtons.push(sep);
        pending.forEach((entry) => {
            usedFilenames.add(entry.filename);
            const btn = createFilterButtonElement(entry, 'factions', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        });
    };

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const gKey = `${fgo.factionArchiveTypeRank(ev?.factionType)}|${fgo.normalizeFactionArchiveType(ev?.factionType)}`;
        const gLabel = fgo.displayLabelForFactionArchiveType(ev?.factionType);
        if (lastKey !== null && gKey !== lastKey) {
            flush();
            pending = [];
        }
        lastKey = gKey;
        pendingLabel = gLabel;
        const fe = matchFactionManifestToArchiveRowName(ev?.name, items);
        if (fe && !pending.some((x) => x.filename === fe.filename)) {
            pending.push(fe);
        }
    }
    flush();

    const rest = items.filter((f) => f?.filename && !usedFilenames.has(f.filename));
    if (rest.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'filters-grid-type-separator';
        sep.setAttribute('role', 'separator');
        sep.setAttribute('aria-label', 'Other');
        sep.textContent = 'Other';
        filtersGrid.appendChild(sep);
        cachedButtons.push(sep);
        rest.forEach((entry) => {
            const btn = createFilterButtonElement(entry, 'factions', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        });
    }

    return cachedButtons;
}

/**
 * Heroes archive: **Role** + **Subrole** headers + manifest hero chips.
 */
function buildGroupedHeroArchiveFilterDom(
    items,
    folder,
    filtersGrid,
    stateManager,
    imageService,
    soundManager,
    updateFilterCounts
) {
    const hro = typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers : null;
    const cachedButtons = [];
    filtersGrid.innerHTML = '';

    if (!hro || typeof hro.normalizeHeroArchiveRole !== 'function' || !Array.isArray(items) || items.length === 0) {
        return cachedButtons;
    }

    const events = getHeroesArchiveRowsForFilterGrouping();
    if (typeof hro.sortHeroesArchiveEventsStable === 'function') {
        hro.sortHeroesArchiveEventsStable(events);
    }

    /** @type {{ roleKey: string, roleLabel: string, subKey: string, subLabel: string, heroes: string[] }[]} */
    const segments = [];
    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const hid = matchHeroManifestToArchiveRowName(ev?.name, items);
        if (!hid) continue;
        const roleNorm = hro.normalizeHeroArchiveRole(ev?.heroRole);
        const roleKey = `${hro.heroArchiveRoleRank(ev?.heroRole)}|${roleNorm}`;
        const subKey = `${hro.heroArchiveSubroleRank(ev?.heroSubRole, roleNorm)}|${hro.normalizeHeroArchiveSubrole(ev?.heroSubRole, roleNorm)}`;
        const last = segments[segments.length - 1];
        if (last && last.roleKey === roleKey && last.subKey === subKey) {
            if (!last.heroes.includes(hid)) last.heroes.push(hid);
        } else {
            segments.push({
                roleKey,
                roleLabel: hro.displayLabelForHeroArchiveRole(ev?.heroRole),
                subKey,
                subLabel: hro.displayLabelForHeroArchiveSubrole(ev?.heroSubRole, roleNorm),
                heroes: [hid]
            });
        }
    }

    const usedHeroIds = new Set();
    let prevRoleKey = null;
    let prevSubKey = null;
    for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        if (seg.roleKey !== prevRoleKey) {
            prevRoleKey = seg.roleKey;
            prevSubKey = null;
            const sep = document.createElement('div');
            sep.className = 'filters-grid-type-separator filters-grid-hero-role-separator';
            sep.setAttribute('role', 'separator');
            sep.setAttribute('aria-label', seg.roleLabel);
            sep.textContent = seg.roleLabel;
            filtersGrid.appendChild(sep);
            cachedButtons.push(sep);
        }
        if (seg.subKey !== prevSubKey) {
            prevSubKey = seg.subKey;
            const subSep = document.createElement('div');
            subSep.className = 'filters-grid-hero-subrole-separator';
            subSep.setAttribute('role', 'separator');
            subSep.setAttribute('aria-label', seg.subLabel);
            subSep.textContent = seg.subLabel;
            filtersGrid.appendChild(subSep);
            cachedButtons.push(subSep);
        }
        for (let h = 0; h < seg.heroes.length; h++) {
            const heroId = seg.heroes[h];
            usedHeroIds.add(heroId);
            const btn = createFilterButtonElement(heroId, 'heroes', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        }
    }

    const rest = items.filter((id) => id && !usedHeroIds.has(id));
    if (rest.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'filters-grid-type-separator';
        sep.setAttribute('role', 'separator');
        sep.setAttribute('aria-label', 'Other');
        sep.textContent = 'Other';
        filtersGrid.appendChild(sep);
        cachedButtons.push(sep);
        rest.forEach((heroId) => {
            const btn = createFilterButtonElement(heroId, 'heroes', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        });
    }

    return cachedButtons;
}

/**
 * Create filter buttons (with caching)
 * @param {boolean} [groupFactionsByArchiveType] — When true and `type === 'factions'`, group chips by archive faction type (always for factions tab).
 * @param {boolean} [groupHeroesByArchiveRole] — When true and `type === 'heroes'`, group chips by archive role + subrole (always for heroes tab).
 */
export function createFilterButtons(
    items,
    type,
    folder,
    filtersGrid,
    buttonCache,
    stateManager,
    imageService,
    soundManager,
    heroes,
    factions,
    npcs,
    countries,
    preloadImages,
    updateFilterCounts,
    groupFactionsByArchiveType = false,
    groupHeroesByArchiveRole = false
) {
    if (!filtersGrid) return;

    // Try to use cached buttons first
    if (useCachedButtons(type, buttonCache, filtersGrid, stateManager, updateFilterCounts)) {
        return;
    }

    filtersGrid.innerHTML = '';
    let cachedButtons = [];

    if (type === 'factions' && groupFactionsByArchiveType) {
        cachedButtons = buildGroupedFactionArchiveFilterDom(
            items,
            folder,
            filtersGrid,
            stateManager,
            imageService,
            soundManager,
            updateFilterCounts
        );
    } else if (type === 'heroes' && groupHeroesByArchiveRole) {
        cachedButtons = buildGroupedHeroArchiveFilterDom(
            items,
            folder,
            filtersGrid,
            stateManager,
            imageService,
            soundManager,
            updateFilterCounts
        );
    } else {
        items.forEach((item) => {
            const filterBtn = createFilterButtonElement(item, type, folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(filterBtn);
            cachedButtons.push(filterBtn);
        });
    }

    // Cache the buttons
    buttonCache[type] = cachedButtons;

    const npcList = Array.isArray(npcs) ? npcs : [];
    const countryList = Array.isArray(countries) ? countries : [];
    // Preload images for other categories in the background
    if (type === 'heroes') {
        if (factions.length > 0) {
            setTimeout(() => preloadImages(factions, 'factions', 'src/assets/images/Filters/Factions'), 100);
        }
        if (npcList.length > 0) {
            setTimeout(() => preloadImages(npcList, 'npcs', 'src/assets/images/Filters/NPCs'), 150);
        }
        if (countryList.length > 0) {
            setTimeout(() => preloadImages(countryList, 'countries', 'src/assets/images/Filters/Flags'), 200);
        }
    } else if (type === 'factions') {
        if (heroes.length > 0) {
            setTimeout(() => preloadImages(heroes, 'heroes', 'src/assets/images/Filters/Heroes'), 100);
        }
        if (npcList.length > 0) {
            setTimeout(() => preloadImages(npcList, 'npcs', 'src/assets/images/Filters/NPCs'), 150);
        }
        if (countryList.length > 0) {
            setTimeout(() => preloadImages(countryList, 'countries', 'src/assets/images/Filters/Flags'), 200);
        }
    } else if (type === 'npcs') {
        if (heroes.length > 0) {
            setTimeout(() => preloadImages(heroes, 'heroes', 'src/assets/images/Filters/Heroes'), 100);
        }
        if (factions.length > 0) {
            setTimeout(() => preloadImages(factions, 'factions', 'src/assets/images/Filters/Factions'), 150);
        }
        if (countryList.length > 0) {
            setTimeout(() => preloadImages(countryList, 'countries', 'src/assets/images/Filters/Flags'), 200);
        }
    } else if (type === 'countries') {
        if (heroes.length > 0) {
            setTimeout(() => preloadImages(heroes, 'heroes', 'src/assets/images/Filters/Heroes'), 100);
        }
        if (factions.length > 0) {
            setTimeout(() => preloadImages(factions, 'factions', 'src/assets/images/Filters/Factions'), 120);
        }
        if (npcList.length > 0) {
            setTimeout(() => preloadImages(npcList, 'npcs', 'src/assets/images/Filters/NPCs'), 140);
        }
    }

    updateFilterCounts();
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.FilterButtonHelpers) {
        window.FilterButtonHelpers = {};
    }
    window.FilterButtonHelpers.getHeroDisplayName = getHeroDisplayName;
    window.FilterButtonHelpers.getFilterKeyAndDisplayName = getFilterKeyAndDisplayName;
    window.FilterButtonHelpers.createFilterImage = createFilterImage;
    window.FilterButtonHelpers.attachFilterButtonClickHandler = attachFilterButtonClickHandler;
    window.FilterButtonHelpers.createFilterButtonElement = createFilterButtonElement;
    window.FilterButtonHelpers.useCachedButtons = useCachedButtons;
    window.FilterButtonHelpers.createFilterButtons = createFilterButtons;
    window.FilterButtonHelpers.matchFactionManifestToArchiveRowName = matchFactionManifestToArchiveRowName;
    window.FilterButtonHelpers.matchHeroManifestToArchiveRowName = matchHeroManifestToArchiveRowName;
    window.FilterButtonHelpers.ensureArchiveLayoutSnapshotsForFilter = ensureArchiveLayoutSnapshotsForFilter;
    window.FilterButtonHelpers.invalidateArchiveLayoutFileCaches = invalidateArchiveLayoutFileCaches;
}
