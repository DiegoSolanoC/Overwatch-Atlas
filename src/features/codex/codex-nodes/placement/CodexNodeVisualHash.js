/** Stable visual variation for Codex node frames (PNG variant + hex rotation). */

function codexStyleHash32(id) {
    const s = String(id || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    }
    return h;
}

/** Stable 1–3 — same frame PNG (Node1…3) after save/reload. */
export function codexFrameVariantForId(id) {
    return (Math.abs(codexStyleHash32(id)) % 3) + 1;
}

/** Stable 0, 60, …, 300 — hex symmetry; independent of frame variant. */
export function codexHexRotationDegreesForId(id) {
    const h = codexStyleHash32(id);
    const mixed = Math.imul(h ^ (h >>> 11), 0x85ebca6b) | 0;
    return (Math.abs(mixed) % 6) * 60;
}
