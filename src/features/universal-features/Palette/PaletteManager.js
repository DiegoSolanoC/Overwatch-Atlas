/**
 * PaletteManager - Handles color palette toggle functionality
 * Extracted from component-loader.js to improve maintainability
 */

import { applyCurrentPaletteToTransportVehicles } from '../../Interactive-Worldview/utils/TransportPaletteColors.js';
import { applyPaletteToExistingEventMarkers } from '../../system-interface/managers/helpers/MarkerCreationHelpers.js';

// Track if palette toggle is already set up to prevent duplicate listeners
let paletteToggleSetup = false;

const MAP_TEXTURE_BLUE = 'src/assets/images/Maps/Earth%20Textures/MAP Blue.png';
const MAP_TEXTURE_GRAY = 'src/assets/images/Maps/Earth%20Textures/MAP Black.png';
const MAP_TEXTURE_CRIMSON = 'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png';
const MAP_TEXTURE_NULLED = 'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png';

const MOON_TEXTURE = 'src/assets/images/Misc/Celestial%20Panels/Moon.png';
const MARS_TEXTURE = 'src/assets/images/Misc/Celestial%20Panels/Mars.png';

const WEBSITE_LOGO_DEFAULT = 'src/assets/images/Misc/Website%20Icons/Website.png';
const WEBSITE_LOGO_CRIMSON = 'src/assets/images/Misc/Website%20Icons/Website%20Crimson.png';
const WEBSITE_LOGO_NULLED = 'src/assets/images/Misc/Website%20Icons/Website%20Nulled.png';

function normalizeSavedPalette(saved) {
    if (saved === 'gray') return 'gray';
    if (saved === 'crimson') return 'crimson';
    if (saved === 'nulled') return 'nulled';
    return 'blue';
}

function applyPaletteBodyClasses(palette) {
    document.body.classList.remove('color-palette-gray', 'color-palette-crimson', 'color-palette-nulled');
    if (palette === 'gray') document.body.classList.add('color-palette-gray');
    else if (palette === 'crimson') document.body.classList.add('color-palette-crimson');
    else if (palette === 'nulled') document.body.classList.add('color-palette-nulled');
}

function updateHeaderWebsiteLogo(palette) {
    const img = document.querySelector('.header-title-badge-logo');
    if (!img) return;
    const p = normalizeSavedPalette(palette);
    if (p === 'crimson') img.src = WEBSITE_LOGO_CRIMSON;
    else if (p === 'nulled') img.src = WEBSITE_LOGO_NULLED;
    else img.src = WEBSITE_LOGO_DEFAULT;
}

function texturePathForPalette(mapKind, normalized) {
    if (mapKind === 'moon') return MOON_TEXTURE;
    if (mapKind === 'mars') return MARS_TEXTURE;
    if (normalized === 'gray') return MAP_TEXTURE_GRAY;
    if (normalized === 'crimson') return MAP_TEXTURE_CRIMSON;
    if (normalized === 'nulled') return MAP_TEXTURE_NULLED;
    return MAP_TEXTURE_BLUE;
}

/**
 * Setup palette toggle functionality
 * This is needed when the button is added dynamically after DOMContentLoaded
 */
export function setupPaletteToggle() {
    const colorPaletteToggle = document.getElementById('colorPaletteToggle');
    if (!colorPaletteToggle) return;
    
    // Check if already set up - if so, just ensure state is applied and listeners exist
    const wasAlreadySetup = paletteToggleSetup && colorPaletteToggle.dataset.setup === 'true';
    
    // Always apply saved state
    const savedPalette = localStorage.getItem('colorPalette');
    const activePalette = normalizeSavedPalette(savedPalette);
    applyPaletteBodyClasses(activePalette);
    updateHeaderWebsiteLogo(activePalette);
    
    // If already set up, verify listeners are still attached, then return
    if (wasAlreadySetup) {
        // Verify menu exists and has listeners
        const paletteMenu = document.getElementById('paletteMenu');
        if (paletteMenu) {
            const optionButtons = paletteMenu.querySelectorAll('.palette-option-btn');
            // Check if any button is missing its handler
            let needsReattach = false;
            optionButtons.forEach(btn => {
                if (!btn._paletteOptionHandler) {
                    needsReattach = true;
                }
            });
            // If listeners are missing, continue with setup to reattach them
                if (!needsReattach && colorPaletteToggle._paletteButtonHandler) {
                updateHeaderWebsiteLogo(activePalette);
                // Update active state
                if (window.updatePaletteMenuActiveState) {
                    window.updatePaletteMenuActiveState(activePalette);
                }
                return;
            }
        }
        // If we get here, something is missing - continue with full setup
    }
    
    // Mark as set up
    colorPaletteToggle.dataset.setup = 'true';
    paletteToggleSetup = true;
    
    // Create palette menu if it doesn't exist
    let paletteMenu = document.getElementById('paletteMenu');
    if (!paletteMenu) {
        paletteMenu = document.createElement('div');
        paletteMenu.id = 'paletteMenu';
        paletteMenu.className = 'palette-menu';
        
        // Blue palette option button
        const blueBtn = document.createElement('button');
        blueBtn.className = 'palette-option-btn blue';
        blueBtn.dataset.palette = 'blue';
        blueBtn.title = 'Blue Palette';
        blueBtn.setAttribute('aria-label', 'Blue Palette');
        // Add a visual indicator inside the button
        blueBtn.innerHTML = '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';
        paletteMenu.appendChild(blueBtn);
        console.log('[Palette] Created blue button:', blueBtn);
        
        // Black/Gray palette option button
        const blackBtn = document.createElement('button');
        blackBtn.className = 'palette-option-btn black';
        blackBtn.dataset.palette = 'gray';
        blackBtn.title = 'Gray Palette';
        blackBtn.setAttribute('aria-label', 'Gray Palette');
        // Add a visual indicator inside the button
        blackBtn.innerHTML = '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';
        paletteMenu.appendChild(blackBtn);
        console.log('[Palette] Created black button:', blackBtn);

        const crimsonBtn = document.createElement('button');
        crimsonBtn.className = 'palette-option-btn crimson';
        crimsonBtn.dataset.palette = 'crimson';
        crimsonBtn.title = 'Crimson Palette';
        crimsonBtn.setAttribute('aria-label', 'Crimson Palette');
        crimsonBtn.innerHTML = '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';
        paletteMenu.appendChild(crimsonBtn);

        const nulledBtn = document.createElement('button');
        nulledBtn.className = 'palette-option-btn nulled';
        nulledBtn.dataset.palette = 'nulled';
        nulledBtn.title = 'Nulled Palette';
        nulledBtn.setAttribute('aria-label', 'Nulled Palette');
        nulledBtn.innerHTML = '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';
        paletteMenu.appendChild(nulledBtn);
        
        document.body.appendChild(paletteMenu);
        console.log('[Palette] Menu appended to body, total children:', paletteMenu.children.length);
    } else {
        if (!paletteMenu.querySelector('[data-palette="crimson"]')) {
            const crimsonBtn = document.createElement('button');
            crimsonBtn.className = 'palette-option-btn crimson';
            crimsonBtn.dataset.palette = 'crimson';
            crimsonBtn.title = 'Crimson Palette';
            crimsonBtn.setAttribute('aria-label', 'Crimson Palette');
            crimsonBtn.innerHTML = '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';
            paletteMenu.appendChild(crimsonBtn);
        }
        if (!paletteMenu.querySelector('[data-palette="nulled"]')) {
            const nulledBtn = document.createElement('button');
            nulledBtn.className = 'palette-option-btn nulled';
            nulledBtn.dataset.palette = 'nulled';
            nulledBtn.title = 'Nulled Palette';
            nulledBtn.setAttribute('aria-label', 'Nulled Palette');
            nulledBtn.innerHTML = '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';
            paletteMenu.appendChild(nulledBtn);
        }
    }
    
    // Update menu active state and icon (savedPalette was already retrieved and applied above)
    updatePaletteMenuActiveState(activePalette);
    updatePaletteButtonIcon(activePalette);
    
    // Function to update palette button icon based on active palette
    function updatePaletteButtonIcon(palette) {
        const colorPaletteToggle = document.getElementById('colorPaletteToggle');
        if (!colorPaletteToggle) return;
        
        const iconSpan = colorPaletteToggle.querySelector('#colorPaletteIcon');
        if (!iconSpan) return;
        
        let iconPath = 'src/assets/images/Icons/Palette%20Icons/Blue%20Palette%20Icon.png';
        if (palette === 'gray') {
            iconPath = 'src/assets/images/Icons/Palette%20Icons/Dark%20Palette%20Icon.png';
        } else if (palette === 'crimson') {
            iconPath = 'src/assets/images/Icons/Palette%20Icons/Red%20Palette%20Icon.png';
        } else if (palette === 'nulled') {
            iconPath = 'src/assets/images/Icons/Palette%20Icons/Purple%20Palette%20Icon.png';
        }
        
        // Check if img already exists, update src; otherwise create new img
        let img = iconSpan.querySelector('img');
        if (img) {
            img.src = iconPath;
            img.alt = 'Color Palette';
            // Ensure it matches header button icon styling
            img.className = img.className || 'header-hub-icon';
        } else {
            iconSpan.innerHTML = '';
            img = document.createElement('img');
            img.src = iconPath;
            img.alt = 'Color Palette';
            img.className = 'header-hub-icon';
            iconSpan.appendChild(img);
        }
    }
    
    // Function to update active state of palette menu buttons
    function updatePaletteMenuActiveState(palette) {
        const menu = document.getElementById('paletteMenu');
        if (!menu) return;
        
        const buttons = menu.querySelectorAll('.palette-option-btn');
        buttons.forEach(btn => {
            if (btn.dataset.palette === palette) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update palette button icon
        updatePaletteButtonIcon(palette);
    }
    
    // Function to change palette
    function changePalette(palette) {
        const normalized = normalizeSavedPalette(palette);
        const previousPalette = normalizeSavedPalette(localStorage.getItem('colorPalette'));
        applyPaletteBodyClasses(normalized);
        updateHeaderWebsiteLogo(normalized);
        
        updatePaletteMenuActiveState(normalized);
        
        // Save preference
        localStorage.setItem('colorPalette', normalized);
        
        console.log('Palette changed to:', normalized);
        
        const isGray = normalized === 'gray';
        const isCrimson = normalized === 'crimson';
        const isNulled = normalized === 'nulled';
        
        // Change globe texture (only on pages with globe)
        if (window.globeController && window.globeController.globeView) {
            window.globeController.globeView.changeGlobeTexture(texturePathForPalette('map', normalized));
            if (typeof window.globeController.globeView.applyCelestialPaletteTint === 'function') {
                window.globeController.globeView.applyCelestialPaletteTint(normalized);
            }

            // Update rim glow to match palette (blue → light blue, gray → white, crimson → warm red, nulled → soft violet)
            if (typeof window.globeController.globeView.updateRimGlowPalette === 'function') {
                window.globeController.globeView.updateRimGlowPalette(normalized);
            }
        }
        
        // Change scene background color (starfield background) (only on pages with globe)
        if (window.globeController && window.globeController.sceneModel) {
            const bgColor = isGray ? 0x0f0f0f : (isCrimson ? 0x14080c : (isNulled ? 0x100818 : 0x050d18));
            window.globeController.sceneModel.setBackgroundColor(bgColor);
        }

        if (window.globeController?.transportModel) {
            applyCurrentPaletteToTransportVehicles(window.globeController.transportModel);
        }

        if (window.globeController?.sceneModel) {
            applyPaletteToExistingEventMarkers(window.globeController.sceneModel);
        }
        
        // Play sound effect if available
        if (window.SoundEffectsManager) {
            if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['colorChange']) {
                window.SoundEffectsManager.play('colorChange');
            } else {
                // Load and play if not already loaded
                window.SoundEffectsManager.loadSound('colorChange', 'src/assets/audio/sfx/Color Change.mp3');
                setTimeout(() => {
                    window.SoundEffectsManager.play('colorChange');
                }, 100);
            }
        }
        
        if (window.MusicPaletteDefaultHelpers && window.MusicPaletteDefaultHelpers.notifyMusicDefaultPaletteChange) {
            window.MusicPaletteDefaultHelpers.notifyMusicDefaultPaletteChange(previousPalette, normalized);
        }

        // Close menu after selection
        closePaletteMenu();
    }
    
    // Handle palette button click - toggle menu
    const handlePaletteButtonClick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('[Palette] Button clicked');
        const menu = document.getElementById('paletteMenu');
        if (!menu) {
            console.error('[Palette] Menu not found!');
            return;
        }
        
        console.log('[Palette] Menu found, current state:', menu.classList.contains('open') ? 'open' : 'closed');
        
        if (menu.classList.contains('open')) {
            console.log('[Palette] Closing menu');
            closePaletteMenu();
        } else {
            console.log('[Palette] Opening menu');
            openPaletteMenu();
            
            // Play sound effect when opening menu
            if (window.SoundEffectsManager) {
                if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['colorChange']) {
                    window.SoundEffectsManager.play('colorChange');
                } else {
                    // Load and play if not already loaded
                    window.SoundEffectsManager.loadSound('colorChange', 'src/assets/audio/sfx/Color Change.mp3');
                    setTimeout(() => {
                        if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['colorChange']) {
                            window.SoundEffectsManager.play('colorChange');
                        }
                    }, 100);
                }
            }
        }
    };
    
    // Handle palette option button clicks
    const handlePaletteOptionClick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const palette = this.dataset.palette;
        if (palette) {
            changePalette(palette);
        }
    };
    
    // Open palette menu
    function openPaletteMenu() {
        const menu = document.getElementById('paletteMenu');
        const toggle = document.getElementById('colorPaletteToggle');
        console.log('[Palette] openPaletteMenu called, menu:', menu, 'toggle:', toggle);
        if (menu) {
            // Position the palette menu directly under the palette button (header or floating).
            const getBodyScale = () => {
                try {
                    const t = window.getComputedStyle(document.body).transform;
                    if (!t || t === 'none') return 1;
                    // matrix(a, b, c, d, tx, ty)
                    const m = t.match(/^matrix\(([^)]+)\)$/);
                    if (!m) return 1;
                    const parts = m[1].split(',').map(s => parseFloat(s.trim()));
                    const a = parts[0];
                    return (Number.isFinite(a) && a > 0) ? a : 1;
                } catch (_) {
                    return 1;
                }
            };

            const positionMenuUnderToggle = () => {
                if (!toggle) return;
                const gap = 8;

                // NOTE: Desktop uses `body { transform: scale(...) }`, which means `position: fixed`
                // elements are positioned in the body's unscaled coordinate space. Convert all
                // viewport rect coordinates into that same space so we stay perfectly aligned.
                const scale = getBodyScale();
                const rect = toggle.getBoundingClientRect();
                const cx = (rect.left + (rect.width / 2)) / scale;
                const belowY = (rect.bottom + gap) / scale;
                const aboveY = (rect.top - gap) / scale;

                const vw = Math.max(1, (window.innerWidth || 1) / scale);
                const vh = Math.max(1, (window.innerHeight || 1) / scale);

                const optionBtns = menu.querySelectorAll('.palette-option-btn');
                const btnN = optionBtns.length || 4;
                const firstBtn = menu.querySelector('.palette-option-btn');
                const btnW = firstBtn ? parseFloat(window.getComputedStyle(firstBtn).width) : 45;
                const btnH = firstBtn ? parseFloat(window.getComputedStyle(firstBtn).height) : 45;
                const menuGap = parseFloat(window.getComputedStyle(menu).gap) || 10;
                const menuWidth = (btnW * btnN) + (menuGap * Math.max(0, btnN - 1));
                const menuHeight = btnH;
                const halfW = menuWidth / 2;
                const margin = 8;

                let left = cx;
                let top = belowY;

                if (left - halfW < margin) left = halfW + margin;
                if (left + halfW > vw - margin) left = vw - halfW - margin;

                // If we would go off the bottom, pop the menu above the button.
                if (top + menuHeight > vh - margin) {
                    top = aboveY - menuHeight;
                }

                menu.style.left = `${left}px`;
                menu.style.top = `${top}px`;
                menu.style.right = 'auto';
                menu.style.bottom = 'auto';
            };

            positionMenuUnderToggle();
            menu.classList.add('open');
            // Force visibility with inline styles as fallback
            menu.style.opacity = '1';
            menu.style.visibility = 'visible';
            menu.style.transform = '';
            menu.style.pointerEvents = 'auto';
            menu.style.display = 'flex';
            menu.style.position = 'fixed';
            menu.style.zIndex = '300';
            menu.style.flexDirection = 'row';
            menu.style.gap = '';
            menu.style.alignItems = '';

            // Reposition on layout-affecting events only. A perpetual rAF here stacked with
            // the globe render loop and caused main-thread stalls on some machines.
            try {
                if (menu._paletteRepositionCleanup) menu._paletteRepositionCleanup();
            } catch (_) {}

            let menuReposRaf = null;
            const scheduleMenuReposition = () => {
                if (menuReposRaf != null) return;
                menuReposRaf = requestAnimationFrame(() => {
                    menuReposRaf = null;
                    if (!menu.classList.contains('open')) return;
                    positionMenuUnderToggle();
                });
            };

            const onWinScroll = () => scheduleMenuReposition();
            const onWinResize = () => scheduleMenuReposition();
            window.addEventListener('scroll', onWinScroll, true);
            window.addEventListener('resize', onWinResize);

            const headerHub = toggle ? toggle.closest('.header-hub') : null;
            if (headerHub) headerHub.addEventListener('scroll', onWinScroll);

            scheduleMenuReposition();

            menu._paletteRepositionCleanup = () => {
                window.removeEventListener('scroll', onWinScroll, true);
                window.removeEventListener('resize', onWinResize);
                if (headerHub) headerHub.removeEventListener('scroll', onWinScroll);
                if (menuReposRaf != null) {
                    cancelAnimationFrame(menuReposRaf);
                    menuReposRaf = null;
                }
                menu._paletteRepositionCleanup = null;
            };

            console.log('[Palette] Added "open" class to menu, classes:', menu.className);
            console.log('[Palette] Menu computed styles:', {
                opacity: window.getComputedStyle(menu).opacity,
                visibility: window.getComputedStyle(menu).visibility,
                display: window.getComputedStyle(menu).display,
                zIndex: window.getComputedStyle(menu).zIndex
            });
            
            // Check if buttons exist
            const buttons = menu.querySelectorAll('.palette-option-btn');
            console.log('[Palette] Number of option buttons found:', buttons.length);
            buttons.forEach((btn, index) => {
                console.log(`[Palette] Button ${index}:`, btn, 'classes:', btn.className);
            });
        } else {
            console.error('[Palette] Menu element not found!');
        }
        if (toggle) {
            toggle.classList.add('active');
            console.log('[Palette] Added "active" class to toggle');
        }
    }
    
    // Close palette menu
    function closePaletteMenu() {
        const menu = document.getElementById('paletteMenu');
        const toggle = document.getElementById('colorPaletteToggle');
        if (menu) {
            menu.classList.remove('open');
            try {
                if (menu._paletteRepositionCleanup) menu._paletteRepositionCleanup();
            } catch (_) {}
            // Reset inline styles
            menu.style.opacity = '';
            menu.style.visibility = '';
            menu.style.transform = '';
            menu.style.pointerEvents = '';
        }
        if (toggle) {
            toggle.classList.remove('active');
        }
    }
    
    // Store close function globally so click outside handler can access it
    window._closePaletteMenu = closePaletteMenu;
    
    // Remove old event listeners if they exist (to prevent duplicates)
    const oldHandler = colorPaletteToggle._paletteButtonHandler;
    if (oldHandler) {
        colorPaletteToggle.removeEventListener('click', oldHandler, true);
    }
    
    // Attach handlers - store reference to allow removal later
    colorPaletteToggle._paletteButtonHandler = handlePaletteButtonClick;
    colorPaletteToggle.addEventListener('click', handlePaletteButtonClick, true);
    
    // Remove old listeners from option buttons and attach new ones
    const optionButtons = paletteMenu.querySelectorAll('.palette-option-btn');
    optionButtons.forEach(btn => {
        const oldOptionHandler = btn._paletteOptionHandler;
        if (oldOptionHandler) {
            btn.removeEventListener('click', oldOptionHandler);
        }
        btn._paletteOptionHandler = handlePaletteOptionClick;
        btn.addEventListener('click', handlePaletteOptionClick);
    });
    
    // Close menu when clicking outside - only add once globally
    // Use capture phase to ensure it runs before stopPropagation() in option buttons
    if (!window._paletteClickOutsideHandler) {
        window._paletteClickOutsideHandler = function(e) {
            const menu = document.getElementById('paletteMenu');
            const toggle = document.getElementById('colorPaletteToggle');
            
            if (menu && menu.classList.contains('open')) {
                // Check if click is outside both menu and toggle button
                // Also check if click is on a palette option button (which should close the menu via changePalette)
                const isPaletteOption = e.target.closest('.palette-option-btn');
                if (!menu.contains(e.target) && toggle && !toggle.contains(e.target) && !isPaletteOption) {
                    if (window._closePaletteMenu) {
                        window._closePaletteMenu();
                    }
                }
            }
        };
        // Use capture phase (true) to catch events before they're stopped by stopPropagation
        document.addEventListener('click', window._paletteClickOutsideHandler, true);
    }
    
    // Make updatePaletteMenuActiveState available globally for state updates
    window.updatePaletteMenuActiveState = updatePaletteMenuActiveState;
}

/**
 * Reset palette toggle setup flag
 * Used when unloading palette
 */
export function resetPaletteToggleSetup() {
    paletteToggleSetup = false;
}
