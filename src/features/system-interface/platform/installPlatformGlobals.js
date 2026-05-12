/**
 * Side-effect imports: populate the small set of `window.Navigation*Helpers`
 * aliases that pre-ES-module consumers (load-out, event-system interaction)
 * still read at runtime. Each imported module attaches its own globals on load.
 *
 * Plus the dock's NavigationPaginationHelpers barrel for the same reason.
 */
import './navigation/getEventImagePath.js';
import './navigation/locationTypeCamera.js';
import '../dock/NavigationPaginationHelpers.js';
