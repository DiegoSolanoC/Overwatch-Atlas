/**
 * Load three static dataset files in parallel:
 *   - worldview/locations.json
 *   - worldview/location-display-names.json
 *   - platform/manifest.json
 * Populates the corresponding fields on the EventDataService instance.
 *
 * Each fetch has a 10-second timeout via `fetchJsonWithTimeout` so a slow file
 * cannot stall the rest of the boot sequence.
 */

import { fetchJsonWithTimeout } from './fetchWithTimeout.js';
import { FILES } from '../../../../../data/registry.js';

/** @param {import('./EventDataService.js').default} dataService */
export async function loadLocationsData(dataService) {
    dataService.updateStatus('EventDataService: Starting data fetch (3 files in parallel)...', 'info');
    const fetchStartTime = performance.now();

    dataService.updateStatus('EventDataService: Fetching locations.json...', 'info');
    const [locationsResult, displayNamesResult, manifestResult] = await Promise.allSettled([
        fetchJsonWithTimeout(FILES.worldview.locations).then((data) => {
            dataService.updateStatus('EventDataService: locations.json response received, parsing...', 'info');
            return data;
        }),
        fetchJsonWithTimeout(FILES.worldview.locationDisplayNames).then((data) => {
            dataService.updateStatus('EventDataService: location-display-names.json response received, parsing...', 'info');
            return data;
        }),
        fetchJsonWithTimeout(FILES.platform.manifest).then((data) => {
            dataService.updateStatus('EventDataService: manifest.json response received, parsing...', 'info');
            return data;
        }),
    ]);

    const fetchTime = performance.now() - fetchStartTime;
    dataService.updateStatus(`EventDataService: All 3 files fetched (${fetchTime.toFixed(0)}ms)`, 'success');

    dataService.updateStatus('EventDataService: Processing locations.json data...', 'info');
    if (locationsResult.status === 'fulfilled') {
        const data = locationsResult.value;
        dataService.cities = data.cities || [];
        dataService.fictionalCities = data.fictionalCities || [];
        dataService.airports = data.airports || [];
        dataService.seaports = data.seaports || [];
        dataService.updateStatus(
            `EventDataService: Processed ${dataService.cities.length} cities, ${dataService.fictionalCities.length} fictional cities, ${dataService.airports.length} airports, ${dataService.seaports.length} seaports`,
            'success'
        );
    } else {
        console.error('Error loading locations data:', locationsResult.reason);
        dataService.updateStatus('EventDataService: Error loading locations.json', 'error');
    }

    dataService.updateStatus('EventDataService: Processing location-display-names.json data...', 'info');
    if (displayNamesResult.status === 'fulfilled') {
        const displayNamesData = displayNamesResult.value;
        dataService.displayNames = displayNamesData.displayNames || {};
        const displayNamesCount = Object.keys(dataService.displayNames).length;
        dataService.updateStatus(`EventDataService: Processed ${displayNamesCount} display name mappings`, 'success');
    } else {
        console.error('Error loading display names:', displayNamesResult.reason);
        dataService.displayNames = {};
        dataService.updateStatus('EventDataService: Error loading location-display-names.json', 'error');
    }

    dataService.updateStatus('EventDataService: Processing manifest.json data...', 'info');
    if (manifestResult.status === 'fulfilled') {
        const manifest = manifestResult.value;
        dataService.heroes = manifest.heroes || [];
        dataService.factions = manifest.factions || [];
        dataService.npcs = manifest.npcs || [];
        dataService.updateStatus(
            `EventDataService: Processed ${dataService.heroes.length} heroes, ${dataService.factions.length} factions, ${dataService.npcs.length} NPCs`,
            'success'
        );
    } else {
        console.error('Error loading manifest:', manifestResult.reason);
        dataService.updateStatus('EventDataService: Error loading manifest.json', 'error');
    }
}
