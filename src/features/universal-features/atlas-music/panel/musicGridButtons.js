/**
 * musicGridButtons — build the catalog track grid and keep the selected tile in sync.
 */

/**
 * @param {Array<{ filename: string, name: string }>} musicFiles
 * @param {HTMLElement} musicGrid
 * @param {string|null} currentSong
 * @param {(path: string) => void} onSongClick
 * @param {(btnPath: string, songPath: string) => boolean} matchesSongPath
 */
export function renderMusicGridButtons(musicFiles, musicGrid, currentSong, onSongClick, matchesSongPath) {
    if (!musicGrid) return;

    musicGrid.innerHTML = '';

    musicFiles.forEach((song) => {
        const musicBtn = document.createElement('div');
        musicBtn.className = 'music-grid-btn';
        musicBtn.dataset.songPath = `src/assets/audio/music/${song.filename}`;
        musicBtn.dataset.songName = song.name;

        const imageContainer = document.createElement('div');
        imageContainer.className = 'music-icon-container';

        const img = document.createElement('img');
        const iconName = song.filename.replace(/\.(mp3|wav|ogg)$/i, '');
        const imageCacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const encodedIconName = encodeURIComponent(iconName);
        img.src = `src/assets/images/Music/${encodedIconName}.png?v=${imageCacheBuster}`;
        img.alt = song.name;
        img.onerror = function () {
            const originalSrc = this.src;
            console.warn(`[DEBUG] Image failed to load: ${originalSrc}`);

            const altEncoded = iconName.replace(/\s+/g, '%20');
            if (this.src !== `src/assets/images/Music/${altEncoded}.png?v=${imageCacheBuster}`) {
                this.src = `src/assets/images/Music/${altEncoded}.png?v=${imageCacheBuster}`;
                return;
            }

            this.style.display = 'none';
            console.error(`[DEBUG] Image failed to load after retry: ${iconName}`);
        };

        imageContainer.appendChild(img);

        const label = document.createElement('div');
        label.className = 'music-label';
        const labelText = document.createElement('span');
        labelText.className = 'music-label-text';
        labelText.textContent = song.name;
        label.appendChild(labelText);

        musicBtn.appendChild(imageContainer);
        musicBtn.appendChild(label);

        const songPath = `src/assets/audio/music/${song.filename}`;
        if (matchesSongPath && matchesSongPath(songPath, currentSong)) {
            musicBtn.classList.add('selected');
        }

        musicBtn.addEventListener('click', () => {
            const sp = musicBtn.dataset.songPath;
            document.querySelectorAll('.music-grid-btn').forEach((btn) => btn.classList.remove('selected'));
            musicBtn.classList.add('selected');
            if (onSongClick) onSongClick(sp);
        });

        musicGrid.appendChild(musicBtn);
    });
}

/** @param {(btnPath: string, songPath: string) => boolean} matchesSongPathFn */
export function updateMusicGridSelection(currentSong, matchesSongPathFn) {
    if (!currentSong || !matchesSongPathFn) return;
    document.querySelectorAll('.music-grid-btn').forEach((btn) => {
        btn.classList.remove('selected');
        const btnPath = btn.dataset.songPath;
        if (matchesSongPathFn(btnPath, currentSong)) {
            btn.classList.add('selected');
        }
    });
}
