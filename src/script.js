// Modal functionality
function showDetails(feature) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    
    const featureDetails = {
        feature1: {
            title: 'Feature 1 Details',
            text: 'This is detailed information about Feature 1. You can customize this text with your own content.'
        },
        feature2: {
            title: 'Feature 2 Details',
            text: 'This is detailed information about Feature 2. Add your own descriptions here!'
        },
        feature3: {
            title: 'Feature 3 Details',
            text: 'This is detailed information about Feature 3. Make it your own!'
        }
    };
    
    if (featureDetails[feature]) {
        modalTitle.textContent = featureDetails[feature].title;
        modalText.textContent = featureDetails[feature].text;
        modal.style.display = 'block';
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// Navigation functions (for single-page navigation if needed)
function showHome() {
    // Legacy: previously navigated to map.html (now removed)
    window.location.href = 'index.html';
}

function showAbout() {
    window.location.href = 'filters.html';
}

// Sound Effects Manager is now loaded from src/features/universal-features/Audio/SoundEffects/SoundEffectsManager.js
// It's available globally as window.SoundEffectsManager

function showContact() {
    // Legacy: previously navigated to map.html (now removed)
    window.location.href = 'index.html';
}

// Contact form handling
function handleSubmit(event) {
    event.preventDefault();
    
    const formMessage = document.getElementById('form-message');
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    
    // Since this is a static site, we'll just show a success message
    // In a real application, you'd send this to a backend server
    
    console.log('Form submitted:', { name, email, message });
    
    formMessage.className = 'form-message success';
    formMessage.textContent = 'Thank you for your message! (Note: This is a demo - no email was actually sent)';
    
    // Reset the form
    document.getElementById('contactForm').reset();
    
    // Hide message after 5 seconds
    setTimeout(() => {
        formMessage.style.display = 'none';
    }, 5000);
}

// Asset loading order tracking
const assetLoadOrder = [];
const logAssetLoad = (assetType, assetName) => {
    const timestamp = performance.now().toFixed(2);
    const entry = `[${timestamp}ms] ${assetType}: ${assetName}`;
    assetLoadOrder.push(entry);
    console.log(entry);
};

// Log page name
const pageName = window.location.pathname.split('/').pop() || 'index.html';
logAssetLoad('PAGE', pageName);

// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    logAssetLoad('DOM', 'DOMContentLoaded event fired');
    console.log('Website loaded successfully!');
    
    // Initialize sound effects manager
    if (window.SoundEffectsManager) {
        logAssetLoad('SOUND_EFFECTS', 'Initializing SoundEffectsManager');
        window.SoundEffectsManager.init();
    }
    
    // Optional service: sidebar controls may not exist in every page build.
    if (window.SidebarService && typeof window.SidebarService.init === 'function') {
        window.SidebarService.init();
    }
    
    // NOTE: MusicManager.init() is now called from LoadingOrchestrator.js after music components are loaded
    // This ensures the music button and panel elements exist before initialization
    // The old initialization here has been moved to loadMusic() function
    
    setTimeout(() => {
        // Then initialize Filters Panel (if elements exist - they may be created later when Events component loads)
        if (typeof logAssetLoad === 'function') logAssetLoad('INIT', 'Initializing Filters Panel');
        // Only try to initialize if elements exist, otherwise it will be initialized when Events component loads
        const filtersButton = document.getElementById('filtersToggle');
        const filtersPanel = document.getElementById('filtersPanel');
        const filtersGrid = document.getElementById('filtersGrid');
        // Use FilterService if available
        if (window.FilterService && typeof window.FilterService.init === 'function') {
            window.FilterService.init();
        } else {
            console.warn('FilterService not available - make sure src/features/system-interface/services/FilterService.js is loaded before script.js');
        }
        
        // Log asset loading summary
        if (typeof logAssetLoad === 'function' && assetLoadOrder.length > 0) {
            console.log('\n=== ASSET LOADING ORDER SUMMARY ===');
            assetLoadOrder.forEach((entry, index) => {
                console.log(`${index + 1}. ${entry}`);
            });
            console.log(`\nTotal assets logged: ${assetLoadOrder.length}`);
            console.log('=====================================\n');
        }
    }, 100);
});

// Music Panel functionality has been moved to src/features/universal-features/Audio/Music/MusicManager.js
// The old initMusicPanel function is no longer needed - use MusicManager.init() instead

// Filters Panel functionality has been moved to src/features/system-interface/services/FilterService.js
// The old initFiltersPanel function is no longer needed - use FilterService.init() instead

// Optional: Add keyboard shortcut to close modal (ESC key)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Color Palette Menu Functionality
document.addEventListener('DOMContentLoaded', function() {
    
    const colorPaletteToggle = document.getElementById('colorPaletteToggle');
    if (!colorPaletteToggle) return;
    
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
        paletteMenu.appendChild(blueBtn);
        
        // Black/Gray palette option button
        const blackBtn = document.createElement('button');
        blackBtn.className = 'palette-option-btn black';
        blackBtn.dataset.palette = 'gray';
        blackBtn.title = 'Gray Palette';
        paletteMenu.appendChild(blackBtn);

        const crimsonBtn = document.createElement('button');
        crimsonBtn.className = 'palette-option-btn crimson';
        crimsonBtn.dataset.palette = 'crimson';
        crimsonBtn.title = 'Crimson Palette';
        paletteMenu.appendChild(crimsonBtn);

        const nulledBtn = document.createElement('button');
        nulledBtn.className = 'palette-option-btn nulled';
        nulledBtn.dataset.palette = 'nulled';
        nulledBtn.title = 'Nulled Palette';
        paletteMenu.appendChild(nulledBtn);
        
        document.body.appendChild(paletteMenu);
    } else {
        const pm = document.getElementById('paletteMenu');
        if (pm && !pm.querySelector('[data-palette="crimson"]')) {
            const crimsonBtn = document.createElement('button');
            crimsonBtn.className = 'palette-option-btn crimson';
            crimsonBtn.dataset.palette = 'crimson';
            crimsonBtn.title = 'Crimson Palette';
            pm.appendChild(crimsonBtn);
        }
        if (pm && !pm.querySelector('[data-palette="nulled"]')) {
            const nulledBtn = document.createElement('button');
            nulledBtn.className = 'palette-option-btn nulled';
            nulledBtn.dataset.palette = 'nulled';
            nulledBtn.title = 'Nulled Palette';
            pm.appendChild(nulledBtn);
        }
    }
    
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
        if (p === 'crimson') img.src = 'src/assets/images/Misc/Website%20Icons/Website%20Crimson.png';
        else if (p === 'nulled') img.src = 'src/assets/images/Misc/Website%20Icons/Website%20Nulled.png';
        else img.src = 'src/assets/images/Misc/Website%20Icons/Website.png';
    }

    // Load saved color palette preference (default to blue if not set)
    const savedPalette = localStorage.getItem('colorPalette');
    const activePalette = normalizeSavedPalette(savedPalette);
    applyPaletteBodyClasses(activePalette);
    updateHeaderWebsiteLogo(activePalette);
    updatePaletteMenuActiveState(activePalette);
    
    // Update icon on initial load
    updatePaletteButtonIcon(activePalette);
    
    // Function to update palette button icon based on active palette
    function updatePaletteButtonIcon(palette) {
        const colorPaletteToggle = document.getElementById('colorPaletteToggle');
        if (!colorPaletteToggle) return;
        
        const iconSpan = colorPaletteToggle.querySelector('#colorPaletteIcon');
        if (!iconSpan) return;
        
        let iconPath = 'src/assets/images/Icons/Palette%20Icons/Blue%20Palette%20Icon.png';
        if (palette === 'gray') iconPath = 'src/assets/images/Icons/Palette%20Icons/Dark%20Palette%20Icon.png';
        else if (palette === 'crimson') iconPath = 'src/assets/images/Icons/Palette%20Icons/Red%20Palette%20Icon.png';
        else if (palette === 'nulled') iconPath = 'src/assets/images/Icons/Palette%20Icons/Purple%20Palette%20Icon.png';
        
        // Check if img already exists, update src; otherwise create new img
        let img = iconSpan.querySelector('img');
        if (img) {
            img.src = iconPath;
            img.alt = 'Color Palette';
        } else {
            iconSpan.innerHTML = `<img src="${iconPath}" alt="Color Palette" style="width: 100%; height: 100%; object-fit: contain;">`;
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
        applyPaletteBodyClasses(normalized);
        updateHeaderWebsiteLogo(normalized);
        
        updatePaletteMenuActiveState(normalized);
        
        localStorage.setItem('colorPalette', normalized);
        
        const isGray = normalized === 'gray';
        const isCrimson = normalized === 'crimson';
        const isNulled = normalized === 'nulled';
        
        if (window.globeController && window.globeController.globeView) {
            const texturePath = isGray
                ? 'src/assets/images/Maps/Earth%20Textures/MAP Black.png'
                : (isCrimson ? 'src/assets/images/Maps/Earth%20Textures/MAP Crimson.png' : (isNulled ? 'src/assets/images/Maps/Earth%20Textures/MAP Nulled.png' : 'src/assets/images/Maps/Earth%20Textures/MAP Blue.png'));
            window.globeController.globeView.changeGlobeTexture(texturePath);
            
            if (typeof window.globeController.globeView.applyCelestialPaletteTint === 'function') {
                window.globeController.globeView.applyCelestialPaletteTint(
                    isGray ? 'gray' : isCrimson ? 'crimson' : isNulled ? 'nulled' : 'blue'
                );
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
        
        // Play sound effect if available
        if (window.SoundEffectsManager) {
            console.log('Attempting to play colorChange sound...');
            console.log('Available sounds:', Object.keys(window.SoundEffectsManager.sounds || {}));
            
            if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['colorChange']) {
                const result = window.SoundEffectsManager.play('colorChange');
                if (!result) {
                    console.warn('Failed to play colorChange sound');
                }
            } else {
                console.warn('colorChange sound not loaded. Attempting to load now...');
                // Load and play if not already loaded
                window.SoundEffectsManager.loadSound('colorChange', 'src/assets/audio/sfx/Color Change.mp3');
                setTimeout(() => {
                    if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['colorChange']) {
                        console.log('colorChange sound loaded, playing now...');
                        window.SoundEffectsManager.play('colorChange');
                    } else {
                        console.error('Failed to load Color Change sound effect. Check if file exists at: src/assets/audio/sfx/Color Change.mp3');
                    }
                }, 100);
            }
        } else {
            console.warn('SoundEffectsManager not available');
        }
        
        // Close menu after selection
        closePaletteMenu();
    }
    
    // Handle palette button click - toggle menu
    colorPaletteToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const menu = document.getElementById('paletteMenu');
        if (!menu) return;
        
        if (menu.classList.contains('open')) {
            closePaletteMenu();
        } else {
            openPaletteMenu();
        }
    });
    
    // Handle palette option button clicks
    const optionButtons = paletteMenu.querySelectorAll('.palette-option-btn');
    optionButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const palette = this.dataset.palette;
            if (palette) {
                changePalette(palette);
            }
        });
    });
    
    // Open palette menu
    function openPaletteMenu() {
        const menu = document.getElementById('paletteMenu');
        const toggle = document.getElementById('colorPaletteToggle');
        if (menu) {
            menu.classList.add('open');
        }
        if (toggle) {
            toggle.classList.add('active');
        }
    }
    
    // Close palette menu
    function closePaletteMenu() {
        const menu = document.getElementById('paletteMenu');
        const toggle = document.getElementById('colorPaletteToggle');
        if (menu) {
            menu.classList.remove('open');
        }
        if (toggle) {
            toggle.classList.remove('active');
        }
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('paletteMenu');
        const toggle = document.getElementById('colorPaletteToggle');
        
        if (menu && menu.classList.contains('open')) {
            // Check if click is outside both menu and toggle button
            if (!menu.contains(e.target) && !toggle.contains(e.target)) {
                closePaletteMenu();
            }
        }
    });
});


