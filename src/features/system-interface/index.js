/**
 * System interface load-out (story dock, markers, globe sync glue).
 * Most scripts still attach to `window` for legacy tag order; ES module consumers may import here.
 */
export { EventMarkerManager } from './presentation/markers/EventMarkerManager.js';
export { syncEventsWithGlobeCore } from './integration/syncEventsWithGlobeCore.js';
