export const worldviewTransportStateCooldownsAndCache = {
    _normalizeLocationKey(name) {
        return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
    },

    _getRoutePairKey(from, to) {
        const a = this._normalizeLocationKey(from);
        const b = this._normalizeLocationKey(to);
        return `${a}→${b}`;
    },

    canDepart(type, origin, cooldownMs = 8000, nowMs = Date.now()) {
        if (!origin) return true;
        const m = this.departureCooldowns?.[type];
        if (!m || typeof m.get !== 'function') return true;
        const last = m.get(origin);
        if (!Number.isFinite(last)) return true;
        return (nowMs - last) >= cooldownMs;
    },

    markDeparted(type, origin, nowMs = Date.now()) {
        if (!origin) return;
        const m = this.departureCooldowns?.[type];
        if (!m || typeof m.set !== 'function') return;
        m.set(origin, nowMs);
    },

    canDepartRoutePair(from, to, cooldownMs = 8000, nowMs = Date.now()) {
        if (!from || !to) return true;
        const key = this._getRoutePairKey(from, to);
        const last = this.routePairDepartureCooldowns.get(key);
        if (!Number.isFinite(last)) return true;
        return (nowMs - last) >= cooldownMs;
    },

    markDepartedRoutePair(from, to, nowMs = Date.now()) {
        if (!from || !to) return;
        const key = this._getRoutePairKey(from, to);
        this.routePairDepartureCooldowns.set(key, nowMs);
    },

    setPlaneModelCache(model) { this.planeModelCache = model; },
    getPlaneModelCache() { return this.planeModelCache; },
    setTrainEndModelCache(model) { this.trainEndModelCache = model; },
    getTrainEndModelCache() { return this.trainEndModelCache; },
    setTrainMiddleModelCache(model) { this.trainMiddleModelCache = model; },
    getTrainMiddleModelCache() { return this.trainMiddleModelCache; },
    setSatelliteModelCache(model) { this.satelliteModelCache = model; },
    getSatelliteModelCache() { return this.satelliteModelCache; },
    setStationModelCache(model) { this.stationModelCache = model; },
    getStationModelCache() { return this.stationModelCache; },
    setSpaceShipModelCache(model) { this.spaceShipModelCache = model; },
    getSpaceShipModelCache() { return this.spaceShipModelCache; }
};
