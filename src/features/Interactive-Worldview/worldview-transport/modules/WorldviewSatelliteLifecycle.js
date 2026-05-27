function isEventHostSatelliteType(type) {
    return type === 'ISS' || type === 'MarsShip';
}

export const worldviewSatelliteLifecycle = {
    _removeSatelliteMarkersForSatellite(satellite) {
        const markers = this.sceneModel.getMarkers();
        for (let i = markers.length - 1; i >= 0; i--) {
            const m = markers[i];
            if (m.userData?.isSatelliteMarker && m.userData?.parentSatellite === satellite) {
                if (m.parent) m.parent.remove(m);
                if (m.geometry) m.geometry.dispose();
                if (m.material) m.material.dispose();
                markers.splice(i, 1);
            }
        }
    },

    _disposeDecorSatellite(satellite) {
        const data = satellite.userData;
        if (!data) return;
        this._removeSatelliteMarkersForSatellite(satellite);
        if (Array.isArray(data.mapOrbitLines)) {
            data.mapOrbitLines.forEach((line) => {
                if (line?.parent) line.parent.remove(line);
                if (line?.geometry) line.geometry.dispose();
                if (line?.material) line.material.dispose();
            });
            data.mapOrbitLines = [];
        }
        const orbitLine = data.orbitLine;
        if (orbitLine) {
            if (orbitLine.parent) orbitLine.parent.remove(orbitLine);
            if (orbitLine.geometry) orbitLine.geometry.dispose();
            if (orbitLine.material) orbitLine.material.dispose();
            this.transportModel.removeSatelliteOrbitLine(orbitLine);
            data.orbitLine = null;
        }
        if (satellite.parent) satellite.parent.remove(satellite);
        satellite.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat) => mat?.dispose?.());
            }
        });
        this.transportModel.removeSatellite(satellite);
    },

    disposeDecorSatellites() {
        const satellites = this.transportModel.getSatellites();
        for (let i = satellites.length - 1; i >= 0; i--) {
            const sat = satellites[i];
            if (sat?.userData?.type === 'small') this._disposeDecorSatellite(sat);
        }
    },

    initializeDecorSatellites() {
        const uniformOrbitRadius = 1.22;
        const created = [];
        for (let i = 1; i <= 25; i++) {
            const sat = this.createSatellite({
                type: 'small',
                orbitRadius: uniformOrbitRadius,
                orbitSpeed: 0.0008 + Math.random() * 0.0015,
                inclination: (Math.random() - 0.5) * Math.PI,
                startAngle: Math.random() * Math.PI * 2,
                rotationAngle: Math.random() * Math.PI * 2,
                name: `Satellite ${i}`
            });
            created.push(sat);
        }
        return created;
    },

    ensureDecorSatellitesLoaded() {
        if (!this.sceneModel.getHyperloopVisible()) return [];
        const sats = this.transportModel.getSatellites();
        const hasVenue = sats.some((s) => isEventHostSatelliteType(s?.userData?.type));
        if (!hasVenue) return [];
        const hasSmall = sats.some((s) => s?.userData?.type === 'small');
        if (hasSmall) return [];
        return this.initializeDecorSatellites();
    },

    initializeSatellites() {
        if (this.sceneModel.getHyperloopVisible()) this.initializeDecorSatellites();
        this.createSatellite({
            type: 'ISS',
            orbitRadius: 1.25,
            orbitSpeed: 0.0008 + Math.random() * 0.0015,
            inclination: Math.PI / 6,
            startAngle: Math.random() * Math.PI * 2,
            rotationAngle: Math.random() * Math.PI * 2,
            name: 'ISS'
        });
        const marsShipOrbitRadius = 1.28;
        const marsInclination = Math.PI / 1.5;
        const veracruzLon = -96.1342;
        const gibraltarLon = -5.3536;
        const avgLon = (veracruzLon + gibraltarLon) / 2;
        const marsRotationAngle = (avgLon * Math.PI / 180) + 0.2;
        const marsStartAngle = veracruzLon * Math.PI / 180;
        this.createSatellite({
            type: 'MarsShip',
            orbitRadius: marsShipOrbitRadius,
            orbitSpeed: 0.0008 + Math.random() * 0.0015,
            inclination: marsInclination,
            startAngle: marsStartAngle,
            rotationAngle: marsRotationAngle,
            name: 'Mars Ship'
        });
    },

    findISS() {
        return this.transportModel.getSatellites().find((satellite) => satellite.userData?.type === 'ISS') || null;
    },

    findMarsShip() {
        return this.transportModel.getSatellites().find((satellite) => satellite?.userData?.type === 'MarsShip') || null;
    }
};
