/**
 * PaletteService - Handles palette loading, unloading, and toggle functionality
 */

const MAP_TEXTURE_BLUE = 'src/assets/images/Maps/Earth%20Textures/MAP Blue.png';
const MAP_TEXTURE_GRAY = 'src/assets/images/Maps/Earth%20Textures/MAP Black.png';
const MAP_TEXTURE_CRIMSON = 'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png';
const MAP_TEXTURE_NULLED = 'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png';

const MOON_TEXTURE = 'src/assets/images/Misc/Celestial%20Panels/Moon.png';
const MARS_TEXTURE = 'src/assets/images/Misc/Celestial%20Panels/Mars.png';

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

const WEBSITE_LOGO_DEFAULT = 'src/assets/images/Misc/Website%20Icons/Website.png';
const WEBSITE_LOGO_CRIMSON = 'src/assets/images/Misc/Website%20Icons/Website%20Crimson.png';
const WEBSITE_LOGO_NULLED = 'src/assets/images/Misc/Website%20Icons/Website%20Nulled.png';

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

class PaletteService {
    constructor() {
        this.paletteToggleSetup = false;
    }

    setupToggle() {
        const colorPaletteToggle = document.getElementById('colorPaletteToggle');
        if (!colorPaletteToggle) return;
        
        const wasAlreadySetup = this.paletteToggleSetup && colorPaletteToggle.dataset.setup === 'true';
        const savedPalette = localStorage.getItem('colorPalette');
        const activePalette = normalizeSavedPalette(savedPalette);
        applyPaletteBodyClasses(activePalette);
        updateHeaderWebsiteLogo(activePalette);
        
        if (wasAlreadySetup) {
            const paletteMenu = document.getElementById('paletteMenu');
            if (paletteMenu) {
                const optionButtons = paletteMenu.querySelectorAll('.palette-option-btn');
                let needsReattach = false;
                optionButtons.forEach(btn => {
                    if (!btn._paletteOptionHandler) {
                        needsReattach = true;
                    }
                });
                if (!needsReattach && colorPaletteToggle._paletteButtonHandler) {
                    updateHeaderWebsiteLogo(activePalette);
                    if (window.updatePaletteMenuActiveState) {
                        window.updatePaletteMenuActiveState(activePalette);
                    }
                    return;
                }
            }
        }
        
        colorPaletteToggle.dataset.setup = 'true';
        this.paletteToggleSetup = true;
        
        let paletteMenu = document.getElementById('paletteMenu');
        if (!paletteMenu) {
            paletteMenu = document.createElement('div');
            paletteMenu.id = 'paletteMenu';
            paletteMenu.className = 'palette-menu';
            
            const blueBtn = document.createElement('button');
            blueBtn.className = 'palette-option-btn blue';
            blueBtn.dataset.palette = 'blue';
            blueBtn.title = 'Blue Palette';
            blueBtn.setAttribute('aria-label', 'Blue Palette');
            blueBtn.innerHTML = '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';
            paletteMenu.appendChild(blueBtn);
            
            const blackBtn = document.createElement('button');
            blackBtn.className = 'palette-option-btn black';
            blackBtn.dataset.palette = 'gray';
            blackBtn.title = 'Gray Palette';
            blackBtn.setAttribute('aria-label', 'Gray Palette');
            blackBtn.innerHTML = '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';
            paletteMenu.appendChild(blackBtn);

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
        
        this.updateMenuActiveState(activePalette);
        this.updateButtonIcon(activePalette);
        
        const handlePaletteButtonClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const menu = document.getElementById('paletteMenu');
            if (!menu) return;
            
            if (menu.classList.contains('open')) {
                this.closeMenu();
            } else {
                this.openMenu();
                if (window.SoundEffectsManager) {
                    if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['colorChange']) {
                        window.SoundEffectsManager.play('colorChange');
                    } else {
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
        
        const handlePaletteOptionClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const palette = e.currentTarget?.dataset?.palette;
            if (palette) {
                this.changePalette(palette);
            }
        };
        
        const oldHandler = colorPaletteToggle._paletteButtonHandler;
        if (oldHandler) {
            colorPaletteToggle.removeEventListener('click', oldHandler, true);
        }
        
        colorPaletteToggle._paletteButtonHandler = handlePaletteButtonClick;
        colorPaletteToggle.addEventListener('click', handlePaletteButtonClick, true);
        
        const optionButtons = paletteMenu.querySelectorAll('.palette-option-btn');
        optionButtons.forEach(btn => {
            const oldOptionHandler = btn._paletteOptionHandler;
            if (oldOptionHandler) {
                btn.removeEventListener('click', oldOptionHandler);
            }
            btn._paletteOptionHandler = handlePaletteOptionClick;
            btn.addEventListener('click', handlePaletteOptionClick);
        });
        
        if (!window._paletteClickOutsideHandler) {
            window._paletteClickOutsideHandler = (e) => {
                const menu = document.getElementById('paletteMenu');
                const toggle = document.getElementById('colorPaletteToggle');
                if (menu && menu.classList.contains('open')) {
                    const isPaletteOption = e.target.closest('.palette-option-btn');
                    if (!menu.contains(e.target) && toggle && !toggle.contains(e.target) && !isPaletteOption) {
                        this.closeMenu();
                    }
                }
            };
            document.addEventListener('click', window._paletteClickOutsideHandler, true);
        }
        
        window.updatePaletteMenuActiveState = (palette) => this.updateMenuActiveState(palette);
        window._closePaletteMenu = () => this.closeMenu();
    }

    updateButtonIcon(palette) {
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
        let img = iconSpan.querySelector('img');
        if (img) {
            img.src = iconPath;
            img.alt = 'Color Palette';
        } else {
            iconSpan.innerHTML = `<img src="${iconPath}" alt="Color Palette" style="width: 100%; height: 100%; object-fit: contain;">`;
        }
    }

    updateMenuActiveState(palette) {
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
        this.updateButtonIcon(palette);
    }

    changePalette(palette) {
        const normalized = normalizeSavedPalette(palette);
        const previousPalette = normalizeSavedPalette(localStorage.getItem('colorPalette'));
        applyPaletteBodyClasses(normalized);
        updateHeaderWebsiteLogo(normalized);
        
        this.updateMenuActiveState(normalized);
        localStorage.setItem('colorPalette', normalized);
        
        const isGray = normalized === 'gray';
        const isCrimson = normalized === 'crimson';
        const isNulled = normalized === 'nulled';
        
        if (window.globeController && window.globeController.globeView) {
            window.globeController.globeView.changeGlobeTexture(texturePathForPalette('map', normalized));
            if (typeof window.globeController.globeView.applyCelestialPaletteTint === 'function') {
                window.globeController.globeView.applyCelestialPaletteTint(normalized);
            }

            if (typeof window.globeController.globeView.updateRimGlowPalette === 'function') {
                window.globeController.globeView.updateRimGlowPalette(normalized);
            }
        }
        
        if (window.globeController && window.globeController.sceneModel) {
            const bgColor = isGray ? 0x0f0f0f : (isCrimson ? 0x14080c : (isNulled ? 0x100818 : 0x050d18));
            window.globeController.sceneModel.setBackgroundColor(bgColor);
        }

        if (typeof window.applyCurrentPaletteToTransportVehicles === 'function' && window.globeController?.transportModel) {
            window.applyCurrentPaletteToTransportVehicles(window.globeController.transportModel);
        }

        if (typeof window.applyPaletteToExistingEventMarkers === 'function' && window.globeController?.sceneModel) {
            window.applyPaletteToExistingEventMarkers(window.globeController.sceneModel);
        }
        
        if (window.SoundEffectsManager) {
            if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['colorChange']) {
                window.SoundEffectsManager.play('colorChange');
            } else {
                window.SoundEffectsManager.loadSound('colorChange', 'src/assets/audio/sfx/Color Change.mp3');
                setTimeout(() => {
                    window.SoundEffectsManager.play('colorChange');
                }, 100);
            }
        }

        if (window.MusicPaletteDefaultHelpers && window.MusicPaletteDefaultHelpers.notifyMusicDefaultPaletteChange) {
            window.MusicPaletteDefaultHelpers.notifyMusicDefaultPaletteChange(previousPalette, normalized);
        }
        
        this.closeMenu();
    }

    openMenu() {
        const menu = document.getElementById('paletteMenu');
        const toggle = document.getElementById('colorPaletteToggle');
        if (menu) {
            menu.classList.add('open');
            menu.style.opacity = '1';
            menu.style.visibility = 'visible';
            menu.style.transform = 'translateY(0)';
            menu.style.pointerEvents = 'auto';
            menu.style.display = 'flex';
            menu.style.position = 'fixed';
            // Desktop uses a scaled body (see styles/base.css). Compensate so the menu
            // visually clears the footer/button area even under transform: scale(...).
            const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
            const desktopBottomPx = 190; // tuned: 190*0.67 ≈ 127px visual
            menu.style.bottom = isMobile ? '150px' : `${desktopBottomPx}px`;
            menu.style.right = '20px';
            menu.style.zIndex = '300';
            menu.style.flexDirection = 'column';
            menu.style.gap = '10px';
            menu.style.alignItems = 'flex-end';
        }
        if (toggle) {
            toggle.classList.add('active');
        }
    }

    closeMenu() {
        const menu = document.getElementById('paletteMenu');
        const toggle = document.getElementById('colorPaletteToggle');
        if (menu) {
            menu.classList.remove('open');
            menu.style.opacity = '';
            menu.style.visibility = '';
            menu.style.transform = '';
            menu.style.pointerEvents = '';
        }
        if (toggle) {
            toggle.classList.remove('active');
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.PaletteService = PaletteService;
}
