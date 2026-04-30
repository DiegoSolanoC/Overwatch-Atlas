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
            filterKey: `assets/audio/music/${item.filename}`, 
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
    buttonCache[type].forEach(cachedBtn => {
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

/**
 * Create filter buttons (with caching)
 */
export function createFilterButtons(items, type, folder, filtersGrid, buttonCache, stateManager, imageService, soundManager, heroes, factions, npcs, countries, preloadImages, updateFilterCounts) {
    if (!filtersGrid) return;
    
    // Try to use cached buttons first
    if (useCachedButtons(type, buttonCache, filtersGrid, stateManager, updateFilterCounts)) {
        return;
    }
    
    // Create new buttons and cache them
    filtersGrid.innerHTML = '';
    const cachedButtons = [];
    
    items.forEach(item => {
        const filterBtn = createFilterButtonElement(item, type, folder, stateManager, imageService, soundManager, updateFilterCounts);
        filtersGrid.appendChild(filterBtn);
        cachedButtons.push(filterBtn);
    });
    
    // Cache the buttons
    buttonCache[type] = cachedButtons;
    
    const npcList = Array.isArray(npcs) ? npcs : [];
    const countryList = Array.isArray(countries) ? countries : [];
    // Preload images for other categories in the background
    if (type === 'heroes') {
        if (factions.length > 0) {
            setTimeout(() => preloadImages(factions, 'factions', 'assets/images/factions'), 100);
        }
        if (npcList.length > 0) {
            setTimeout(() => preloadImages(npcList, 'npcs', 'assets/images/npcs'), 150);
        }
        if (countryList.length > 0) {
            setTimeout(() => preloadImages(countryList, 'countries', 'assets/images/flags'), 200);
        }
    } else if (type === 'factions') {
        if (heroes.length > 0) {
            setTimeout(() => preloadImages(heroes, 'heroes', 'assets/images/heroes'), 100);
        }
        if (npcList.length > 0) {
            setTimeout(() => preloadImages(npcList, 'npcs', 'assets/images/npcs'), 150);
        }
        if (countryList.length > 0) {
            setTimeout(() => preloadImages(countryList, 'countries', 'assets/images/flags'), 200);
        }
    } else if (type === 'npcs') {
        if (heroes.length > 0) {
            setTimeout(() => preloadImages(heroes, 'heroes', 'assets/images/heroes'), 100);
        }
        if (factions.length > 0) {
            setTimeout(() => preloadImages(factions, 'factions', 'assets/images/factions'), 150);
        }
        if (countryList.length > 0) {
            setTimeout(() => preloadImages(countryList, 'countries', 'assets/images/flags'), 200);
        }
    } else if (type === 'countries') {
        if (heroes.length > 0) {
            setTimeout(() => preloadImages(heroes, 'heroes', 'assets/images/heroes'), 100);
        }
        if (factions.length > 0) {
            setTimeout(() => preloadImages(factions, 'factions', 'assets/images/factions'), 120);
        }
        if (npcList.length > 0) {
            setTimeout(() => preloadImages(npcList, 'npcs', 'assets/images/npcs'), 140);
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
}
