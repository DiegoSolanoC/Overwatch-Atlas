/**
 * FilterButtonSetupHelpers - Utilities for setting up filter button handlers
 * Extracted from FilterService to reduce file size
 */

/**
 * Setup filters toggle button handlers
 */
export function setupFiltersButton(filtersButton, soundManager, togglePanel) {
    if (!filtersButton) {
        console.error('Filters button not found!');
        return;
    }
    
    const handleFiltersToggle = (event) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        
        // Flash feedback (orange for panel toggle)
        if (window.flashButton) {
            window.flashButton(filtersButton, 'flash-orange');
        }
        
        if (soundManager) {
            soundManager.play('filterButton');
        }
        
        togglePanel();
    };
    
    // Prevent button from interfering with globe controls
    filtersButton.addEventListener('mousedown', (e) => e.stopPropagation());
    filtersButton.addEventListener('mouseup', (e) => e.stopPropagation());
    
    // Handle touch events for mobile
    let touchStartTime = 0;
    filtersButton.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        touchStartTime = Date.now();
    });
    
    filtersButton.addEventListener('touchend', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (Date.now() - touchStartTime < 300) {
            handleFiltersToggle(e);
        }
    });
    
    filtersButton.addEventListener('click', handleFiltersToggle);
}

/**
 * Setup close button handler
 */
export function setupCloseButton(filtersPanelClose, soundManager, resetToConfirmedFilters, closePanel) {
    if (!filtersPanelClose) return;
    
    filtersPanelClose.addEventListener('click', () => {
        if (soundManager) {
            soundManager.play('filterButton');
        }
        resetToConfirmedFilters();
        closePanel();
    });
}

function resolveFilterType(getCurrentFilterType) {
    if (typeof getCurrentFilterType === 'function') return getCurrentFilterType();
    return getCurrentFilterType;
}

/**
 * Setup clear button handler
 * @param {() => string} getCurrentFilterType - live tab (`heroes` | `factions` | `npcs` | `countries`); not a snapshot at init
 */
export function setupClearButton(clearFiltersBtn, soundManager, stateManager, updateButtonStates, getSceneModel, getCurrentFilterType, heroes, factions, npcs, countries, createFilterButtons) {
    if (!clearFiltersBtn) return;
    
    clearFiltersBtn.addEventListener('click', () => {
        if (soundManager) {
            soundManager.play('filterClear');
        }
        stateManager.clear();
        updateButtonStates();
        
        // NOTE: Globe filter clear removed - Event System Load Out handles this
        
        // Rebuild the grid for whichever tab is active now (avoid stale type from setup time)
        const currentFilterType = resolveFilterType(getCurrentFilterType);
        const countryList = Array.isArray(countries) ? countries : [];
        if (currentFilterType === 'heroes' && heroes.length > 0) {
            createFilterButtons(heroes, 'heroes', 'src/assets/images/Filters/Heroes');
        } else if (currentFilterType === 'factions' && factions.length > 0) {
            createFilterButtons(factions, 'factions', 'src/assets/images/Filters/Factions');
        } else if (currentFilterType === 'npcs' && npcs.length > 0) {
            createFilterButtons(npcs, 'npcs', 'src/assets/images/Filters/NPCs');
        } else if (currentFilterType === 'countries' && countryList.length > 0) {
            createFilterButtons(countryList, 'countries', 'src/assets/images/Filters/Flags');
        }
    });
}

/**
 * Setup confirm button handler
 */
export function setupConfirmButton(confirmFiltersBtn, soundManager, stateManager, getSceneModel, closePanel) {
    if (!confirmFiltersBtn) return;
    
    confirmFiltersBtn.addEventListener('click', () => {
        if (soundManager) {
            soundManager.play('filterConfirm');
        }
        
        // NOTE: Globe filter application removed - Event System Load Out handles this
        // via EventMarkerManager.applyFilters() in MenuHelpers.js/MenuServiceHelpers.js
        
        closePanel();
    });
}

/**
 * Setup all button handlers
 */
export function setupButtons(filtersButton, filtersPanelClose, clearFiltersBtn, confirmFiltersBtn, soundManager, togglePanel, resetToConfirmedFilters, closePanel, stateManager, updateButtonStates, getSceneModel, getCurrentFilterType, heroes, factions, npcs, countries, createFilterButtons) {
    setupFiltersButton(filtersButton, soundManager, togglePanel);
    setupCloseButton(filtersPanelClose, soundManager, resetToConfirmedFilters, closePanel);
    setupClearButton(clearFiltersBtn, soundManager, stateManager, updateButtonStates, getSceneModel, getCurrentFilterType, heroes, factions, npcs, countries, createFilterButtons);
    setupConfirmButton(confirmFiltersBtn, soundManager, stateManager, getSceneModel, closePanel);
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.FilterButtonSetupHelpers) {
        window.FilterButtonSetupHelpers = {};
    }
    window.FilterButtonSetupHelpers.setupFiltersButton = setupFiltersButton;
    window.FilterButtonSetupHelpers.setupCloseButton = setupCloseButton;
    window.FilterButtonSetupHelpers.setupClearButton = setupClearButton;
    window.FilterButtonSetupHelpers.setupConfirmButton = setupConfirmButton;
    window.FilterButtonSetupHelpers.setupButtons = setupButtons;
}
