/** @param {new (...args: any[]) => any} Ctor */
export function installEventManagerDataGetters(Ctor) {
    const listKeys = [
        'cities',
        'fictionalCities',
        'airports',
        'seaports',
        'heroes',
        'factions',
        'npcs'
    ];
    for (const key of listKeys) {
        Object.defineProperty(Ctor.prototype, key, {
            get() {
                return this.dataService?.[key] || [];
            },
            enumerable: true,
            configurable: true
        });
    }
    Object.defineProperty(Ctor.prototype, 'displayNames', {
        get() {
            return this.dataService?.displayNames || {};
        },
        enumerable: true,
        configurable: true
    });
}
