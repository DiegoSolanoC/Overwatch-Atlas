/**
 * FilterTabHelpers - Utilities for managing filter tab switching
 * Extracted from FilterService to reduce file size
 */

function deactivateTabs(heroesTab, factionsTab, npcsTab, countriesTab) {
    if (heroesTab) {
        heroesTab.classList.remove('active');
        heroesTab.setAttribute('aria-selected', 'false');
    }
    if (factionsTab) {
        factionsTab.classList.remove('active');
        factionsTab.setAttribute('aria-selected', 'false');
    }
    if (npcsTab) {
        npcsTab.classList.remove('active');
        npcsTab.setAttribute('aria-selected', 'false');
    }
    if (countriesTab) {
        countriesTab.classList.remove('active');
        countriesTab.setAttribute('aria-selected', 'false');
    }
}

/**
 * Setup tab switching
 */
export function setupTabs(heroesTab, factionsTab, npcsTab, countriesTab, heroes, factions, npcs, countries, createFilterButtons, updateFilterCounts) {
    if (heroesTab) {
        heroesTab.addEventListener('click', () => {
            if (!heroesTab.classList.contains('active') && window.SoundEffectsManager) {
                window.SoundEffectsManager.play('switchMap');
            }
            deactivateTabs(heroesTab, factionsTab, npcsTab, countriesTab);
            heroesTab.classList.add('active');
            heroesTab.setAttribute('aria-selected', 'true');
            createFilterButtons(heroes, 'heroes', 'src/assets/images/Filters/Heroes');
            updateFilterCounts();
        });
    }

    if (factionsTab) {
        factionsTab.addEventListener('click', () => {
            if (!factionsTab.classList.contains('active') && window.SoundEffectsManager) {
                window.SoundEffectsManager.play('switchMap');
            }
            deactivateTabs(heroesTab, factionsTab, npcsTab, countriesTab);
            factionsTab.classList.add('active');
            factionsTab.setAttribute('aria-selected', 'true');
            createFilterButtons(factions, 'factions', 'src/assets/images/Filters/Factions');
            updateFilterCounts();
        });
    }

    if (npcsTab) {
        npcsTab.addEventListener('click', () => {
            if (!npcsTab.classList.contains('active') && window.SoundEffectsManager) {
                window.SoundEffectsManager.play('switchMap');
            }
            deactivateTabs(heroesTab, factionsTab, npcsTab, countriesTab);
            npcsTab.classList.add('active');
            npcsTab.setAttribute('aria-selected', 'true');
            createFilterButtons(npcs, 'npcs', 'src/assets/images/Filters/NPCs');
            updateFilterCounts();
        });
    }

    if (countriesTab) {
        countriesTab.addEventListener('click', () => {
            if (!countriesTab.classList.contains('active') && window.SoundEffectsManager) {
                window.SoundEffectsManager.play('switchMap');
            }
            deactivateTabs(heroesTab, factionsTab, npcsTab, countriesTab);
            countriesTab.classList.add('active');
            countriesTab.setAttribute('aria-selected', 'true');
            createFilterButtons(countries || [], 'countries', 'src/assets/images/Filters/Flags');
            updateFilterCounts();
        });
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.FilterTabHelpers) {
        window.FilterTabHelpers = {};
    }
    window.FilterTabHelpers.setupTabs = setupTabs;
}
