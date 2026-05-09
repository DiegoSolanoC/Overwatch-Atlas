/**
 * MusicFileService - Handles loading music files from manifest and creating UI buttons
 */

// Use window.logAssetLoad if available (defined in script.js)
// Check if getLogAssetLoad already exists to avoid redeclaration
if (typeof getLogAssetLoad === 'undefined') {
    var getLogAssetLoad = () => {
        return (typeof window !== 'undefined' && typeof window.logAssetLoad === 'function') 
            ? window.logAssetLoad 
            : (() => {});
    };
}

class MusicFileService {
    constructor() {
        this.musicFiles = [];
    }

    /**
     * Load music files from manifest.json
     */
    async loadMusicFiles() {
        try {
            const logAssetLoad = getLogAssetLoad();
            logAssetLoad('MUSIC', 'Loading manifest.json (PRIORITY)');
            
            // Add cache busting to ensure we get the latest manifest
            const cacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const response = await fetch(`src/data/manifest.json?v=${cacheBuster}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            if (!response.ok) {
                throw new Error(`manifest.json HTTP ${response.status}`);
            }
            const manifest = await response.json();
            logAssetLoad('MUSIC', `manifest.json loaded (${manifest.music ? manifest.music.length : 0} music files)`);
            
            if (manifest.music && manifest.music.length > 0) {
                this.musicFiles = manifest.music;
                console.log(`Loaded ${this.musicFiles.length} music files from manifest:`, this.musicFiles.map(s => s.name));
                
                // Log each music file
                this.musicFiles.forEach(song => {
                    logAssetLoad('MUSIC_FILE', `${song.filename} (${song.name})`);
                });
                
                return this.musicFiles;
            } else {
                console.warn('No music files found in manifest.json');
                return [];
            }
        } catch (error) {
            console.error('Error loading manifest.json:', error);
            throw error;
        }
    }

    /**
     * Get music files
     */
    getMusicFiles() {
        return this.musicFiles;
    }

    /**
     * Preload a priority song
     */
    preloadPrioritySong(songPath, encodeMusicPath) {
        if (!songPath) return;
        
        const logAssetLoad = getLogAssetLoad();
        const prioritySongFile = this.musicFiles.find(s => {
            const filePath = `src/assets/audio/music/${s.filename}`;
            return filePath === songPath || filePath.replace(/ /g, '%20') === songPath;
        });
        
        if (prioritySongFile) {
            logAssetLoad('MUSIC_PRIORITY', `Preloading current song: ${prioritySongFile.filename}`);
            const encodedPath = encodeMusicPath(`src/assets/audio/music/${prioritySongFile.filename}`);
            const priorityAudio = new Audio(encodedPath);
            priorityAudio.preload = 'auto';
            priorityAudio.load();
        }
    }

    /**
     * Preload all music files and icons
     */
    preloadAllMusic(encodeMusicPath) {
        this.musicFiles.forEach(song => {
            // Encode filename to handle special characters
            const encodedFilename = encodeURIComponent(song.filename);
            const audio = new Audio(`src/assets/audio/music/${encodedFilename}`);
            audio.preload = 'auto';
            
            // Also preload the icon images
            const iconName = song.filename.replace(/\.(mp3|wav|ogg)$/i, '');
            const iconImg = new Image();
            const imageCacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const encodedIconName = encodeURIComponent(iconName);
            iconImg.src = `src/assets/images/Music/${encodedIconName}.png?v=${imageCacheBuster}`;
        });
    }

    /**
     * Create music button elements
     */
    createMusicButtons(musicGrid, currentSong, onSongClick, encodeMusicPath, matchesSongPath) {
        if (!musicGrid) return;
        
        musicGrid.innerHTML = '';

        this.musicFiles.forEach(song => {
            const musicBtn = document.createElement('div');
            musicBtn.className = 'music-grid-btn';
            // Store original path (will be encoded when used)
            musicBtn.dataset.songPath = `src/assets/audio/music/${song.filename}`;
            musicBtn.dataset.songName = song.name;
            
            // Image container
            const imageContainer = document.createElement('div');
            imageContainer.className = 'music-icon-container';
            
            const img = document.createElement('img');
            // Use image from src/assets/images/Music folder with same name as music file
            const iconName = song.filename.replace(/\.(mp3|wav|ogg)$/i, '');
            // Add cache busting to ensure latest images load
            const imageCacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // Encode the path properly for URLs (handles spaces and special characters)
            const encodedIconName = encodeURIComponent(iconName);
            img.src = `src/assets/images/Music/${encodedIconName}.png?v=${imageCacheBuster}`;
            img.alt = song.name;
            img.onerror = function() {
                // If image fails to load, try alternative encodings/cases for GitHub Pages compatibility
                const originalSrc = this.src;
                console.warn(`[DEBUG] Image failed to load: ${originalSrc}`);
                
                // Try with different encoding (some servers handle spaces differently)
                const altEncoded = iconName.replace(/\s+/g, '%20');
                if (this.src !== `src/assets/images/Music/${altEncoded}.png?v=${imageCacheBuster}`) {
                    this.src = `src/assets/images/Music/${altEncoded}.png?v=${imageCacheBuster}`;
                    return; // Let it try again with this encoding
                }
                
                // If still fails, hide the button or show placeholder
                this.style.display = 'none';
                console.error(`[DEBUG] Image failed to load after retry: ${iconName}`);
            };
            
            imageContainer.appendChild(img);
            
            // Label (outer centers; inner holds line-clamp — same pattern as filter buttons)
            const label = document.createElement('div');
            label.className = 'music-label';
            const labelText = document.createElement('span');
            labelText.className = 'music-label-text';
            labelText.textContent = song.name;
            label.appendChild(labelText);
            
            musicBtn.appendChild(imageContainer);
            musicBtn.appendChild(label);
            
            // Check if this is the current song
            const songPath = `src/assets/audio/music/${song.filename}`;
            if (matchesSongPath && matchesSongPath(songPath, currentSong)) {
                musicBtn.classList.add('selected');
            }
            
            // Click handler
            musicBtn.addEventListener('click', () => {
                const songPath = musicBtn.dataset.songPath;
                
                // Remove selected from all buttons
                document.querySelectorAll('.music-grid-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                
                // Add selected to clicked button
                musicBtn.classList.add('selected');
                
                // Call the provided callback
                if (onSongClick) {
                    onSongClick(songPath);
                }
            });
            
            musicGrid.appendChild(musicBtn);
        });
    }

    /**
     * Update selected button based on current song
     */
    updateSelectedButton(currentSong, matchesSongPathFn) {
        if (!currentSong || !matchesSongPathFn) return;
        document.querySelectorAll('.music-grid-btn').forEach(btn => {
            btn.classList.remove('selected');
            const btnPath = btn.dataset.songPath;
            if (matchesSongPathFn(btnPath, currentSong)) {
                btn.classList.add('selected');
            }
        });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicFileService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.MusicFileService = MusicFileService;
}
