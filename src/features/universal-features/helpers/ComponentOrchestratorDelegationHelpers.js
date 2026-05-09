/**
 * ComponentOrchestratorDelegationHelpers - Run/kill/restore delegations to ComponentOrchestrator
 * Extracted from component-loader.js to reduce boilerplate
 */

/**
 * Create delegation functions for ComponentOrchestrator run/kill/restore operations.
 * @param {Object} o - ComponentOrchestrator instance
 * @returns {Object} Delegation functions
 */
export function createOrchestratorDelegations(o) {
    return {
        runMenuComponents: () => o.runMenuComponents(),
        runUniversalFeatures: (options = {}) => o.runUniversalFeatures(options),
        runGlobeComponents: (isAutoLoad = false) => o.runGlobeComponents(isAutoLoad),
        killMenuComponents: () => o.killMenuComponents(),
        killUniversalFeatures: () => o.killUniversalFeatures(),
        restoreMainMenu: () => o.restoreMainMenu(),
        killGlobeComponents: () => o.killGlobeComponents(),
        runGlossaryComponents: (isAutoLoad = false) => o.runGlossaryComponents(isAutoLoad),
        killGlossaryComponents: () => o.killGlossaryComponents(),
        runBiographyComponents: (isAutoLoad = false) => o.runBiographyComponents(isAutoLoad),
        killBiographyComponents: () => o.killBiographyComponents()
    };
}
