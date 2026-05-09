/**
 * Transport / vehicle mesh colors — always cyan (original look) on every UI palette.
 * applyCurrentPaletteToTransportVehicles still runs on palette change to reset any drift.
 */

const CYAN = { color: 0x0088cc, emissive: 0x004488 };

export function getTransportVehicleColors() {
    return CYAN;
}

/** Mars ship emissive (unchanged from original). */
export function getMarsShipEmissiveHex() {
    return 0x440000;
}

/**
 * Re-apply vehicle Phong colors and ISS/Mars orbit + map line accents after a palette change.
 * @param {*} transportModel - TransportModel instance (trains, planes, boats, satellites arrays).
 */
export function applyCurrentPaletteToTransportVehicles(transportModel) {
    if (!transportModel) return;
    const { color, emissive } = getTransportVehicleColors();

    const applyPhongToRoot = (root, satelliteType = null) => {
        if (!root) return;
        const em = satelliteType === 'MarsShip' ? getMarsShipEmissiveHex() : emissive;
        root.traverse((child) => {
            if (!child.isMesh || !child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
                if (m.isMeshPhongMaterial) {
                    m.color.setHex(color);
                    m.emissive.setHex(em);
                }
            });
        });
    };

    (transportModel.trains || []).forEach((t) => applyPhongToRoot(t));
    (transportModel.planes || []).forEach((p) => applyPhongToRoot(p));
    (transportModel.boats || []).forEach((b) => applyPhongToRoot(b));
    (transportModel.satellites || []).forEach((g) => {
        applyPhongToRoot(g, g.userData?.type);
    });

    (transportModel.satelliteOrbitLines || []).forEach((line) => {
        if (line.userData?.orbitUsesTransportPalette && line.material?.color) {
            line.material.color.setHex(color);
            line.userData.orbitColor = color;
        }
    });

    (transportModel.satellites || []).forEach((group) => {
        const t = group.userData?.type;
        if (t !== 'ISS' && t !== 'MarsShip') return;
        (group.userData.mapOrbitLines || []).forEach((line) => {
            if (line.material?.color) line.material.color.setHex(color);
        });
    });
}
