/**
 * Real-Earth shape & orientation (visual approximation).
 * WGS84: equatorial semi-major axis a, polar semi-minor b; default Three.js sphere uses Y as rotation axis.
 */
export const EARTH_POLAR_TO_EQUATORIAL_RATIO = 6356752.314245179 / 6378137.0;

/** Mean obliquity of the ecliptic (axial tilt), degrees — applied as fixed tilt of the globe interior. */
export const EARTH_OBLIQUITY_DEG = 23.4392911;
