/**
 * Pan/zoom framing math for the Codex board (world space, y down).
 */

import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { CODEX_IMG_BASE_PX } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';

/**
 * Pan values so world center sits in the viewport for the given zoom.
 * @param {number} rw root inner width (layout px)
 * @param {number} rh root inner height
 * @param {number} zoom world px per layout px
 */
export function computeCodexPanForWorldCenter(
    rw,
    rh,
    zoom,
    worldW = CODEX_WORLD_W,
    worldH = CODEX_WORLD_H
) {
    const z = Math.max(0.05, zoom);
    const cx = worldW / 2;
    const cy = worldH / 2;
    return {
        panX: rw / 2 - cx * z,
        panY: rh / 2 - cy * z
    };
}

/**
 * Pan so the bounding box of all logical nodes is centered (uses stored x/y/scale, not DOM).
 * @param {Array<{ x?: number, y?: number, scale?: number }>} nodes
 */
export function computeCodexPanForNodeBounds(
    nodes,
    rw,
    rh,
    zoom,
    imgBasePx = CODEX_IMG_BASE_PX
) {
    if (!nodes?.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach((node) => {
        const x = node.x || 0;
        const y = node.y || 0;
        const scale = node.scale || 1;
        const size = imgBasePx * scale;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + size);
        maxY = Math.max(maxY, y + size);
    });
    if (!Number.isFinite(minX)) return null;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const z = Math.max(0.05, zoom);
    return {
        panX: rw / 2 - cx * z,
        panY: rh / 2 - cy * z
    };
}
