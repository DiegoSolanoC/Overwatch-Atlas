/**
 * Octilinear cord geometry: degree readouts and “near a 45° lane” tests (world/SVG space, y down).
 */

import { CODEX_OCT_RAD, CODEX_OCT_SOFT_SNAP_TOL_DEG } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';

/**
 * True geometric bearing of segment p0→p1 in degrees (0–359, 0° = east → 90° = south, world y down).
 * @param {{ x: number, y: number }} p0
 * @param {{ x: number, y: number }} p1
 * @returns {number|null}
 */
export function cordSegmentDegreesLabel(p0, p1) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const ang = Math.atan2(dy, dx);
    let deg = Math.round((ang * 180) / Math.PI);
    deg = ((deg % 360) + 360) % 360;
    return deg;
}

/** Degrees from `angRad` to the nearest octilinear direction (multiple of 45°). */
export function cordAngleDistToNearestOctilinearDegFromRad(angRad) {
    const snapped = Math.round(angRad / CODEX_OCT_RAD) * CODEX_OCT_RAD;
    return (Math.abs(angRad - snapped) * 180) / Math.PI;
}

export function cordSegmentWithinOctilinearToleranceDegrees(
    p0,
    p1,
    tolDeg = CODEX_OCT_SOFT_SNAP_TOL_DEG
) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return false;
    return cordAngleDistToNearestOctilinearDegFromRad(Math.atan2(dy, dx)) <= tolDeg + 1e-9;
}
