/**
 * Default row shape for "+ add blank event" in the manager, keyed by the active Data Archive.
 *
 * Each archive type has a different JSON schema, so a generic blank wouldn't validate against
 * the downstream forms. This switch returns a row pre-populated with the keys each archive
 * needs as scaffolding, leaving the user only with content to fill in:
 *
 *   - `story`: needs coordinates, image filename, location type → seed Earth/(0,0)/no image.
 *   - `heroes` / `factions` / `npcs`: need `relevantLocations` + `connections` arrays so the
 *     bio-archive editors can append rows immediately. Heroes get role fields, factions get
 *     `factionType`.
 *   - Anything else (e.g. `locations`): minimal `{ name, description }`.
 *
 * @param {string} archiveSrc EventDataService.getArchiveSource(): `story | heroes | factions | npcs | locations`.
 * @returns {Object} Blank event row matching the archive's schema.
 */
export function buildBlankEventForArchiveSource(archiveSrc) {
    if (archiveSrc === 'story') {
        return {
            name: '',
            description: '',
            locationType: 'earth',
            lat: 0,
            lon: 0,
            image: ''
        };
    }
    if (archiveSrc === 'heroes' || archiveSrc === 'factions' || archiveSrc === 'npcs') {
        return {
            name: '',
            description: '',
            relevantLocations: [],
            connections: [],
            ...(archiveSrc === 'factions' ? { factionType: '' } : {}),
            ...(archiveSrc === 'heroes' ? { heroRole: '', heroSubRole: '' } : {})
        };
    }
    return {
        name: '',
        description: ''
    };
}
