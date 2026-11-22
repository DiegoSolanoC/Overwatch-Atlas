/**
 * musicGridButtons — build the catalog track grid and keep the selected tile in sync.
 */

/**
 * @typedef {{ filename: string, name: string }} MusicSong
 * @typedef {{ id: string, name: string }} MusicCategory
 * @typedef {{
 *   getCategoriesForSong?: (filename: string) => MusicCategory[],
 *   onRemoveCategory?: (filename: string, categoryId: string) => void,
 * }} MusicGridCategoryHooks
 */

/**
 * One catalog tile (icon + label), same look as the All grid.
 * @param {MusicSong} song
 * @param {{
 *   selected?: boolean,
 *   categoryHooks?: MusicGridCategoryHooks|null,
 *   onClick?: (song: MusicSong, el: HTMLElement) => void,
 * }} [options]
 * @returns {HTMLElement}
 */
export function createMusicGridTile(song, options = {}) {
    const musicBtn = document.createElement('div');
    musicBtn.className = 'music-grid-btn';
    musicBtn.dataset.songPath = `src/assets/audio/music/${song.filename}`;
    musicBtn.dataset.songName = song.name;
    musicBtn.dataset.filename = song.filename;

    const imageContainer = document.createElement('div');
    imageContainer.className = 'music-icon-container';

    const img = document.createElement('img');
    const iconName = song.filename.replace(/\.(mp3|wav|ogg)$/i, '');
    const imageCacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const encodedIconName = encodeURIComponent(iconName);
    img.src = `src/assets/images/Music/${encodedIconName}.png?v=${imageCacheBuster}`;
    img.alt = song.name;
    img.onerror = function () {
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

    if (options.categoryHooks) {
        const row = buildSongCategoryRow(song.filename, options.categoryHooks);
        if (row) musicBtn.appendChild(row);
    }

    if (options.selected) {
        musicBtn.classList.add('selected');
    }

    musicBtn.addEventListener('click', (event) => {
        if (event.target instanceof Element
            && event.target.closest('.music-song-categories')) {
            return;
        }
        if (typeof options.onClick === 'function') {
            options.onClick(song, musicBtn);
        }
    });

    return musicBtn;
}

/**
 * @param {MusicSong[]} musicFiles
 * @param {HTMLElement} musicGrid
 * @param {string|null} currentSong
 * @param {(path: string) => void} onSongClick
 * @param {(btnPath: string, songPath: string) => boolean} matchesSongPath
 * @param {MusicGridCategoryHooks} [categoryHooks]
 * @param {string} [emptyMessage]
 */
export function renderMusicGridButtons(
    musicFiles,
    musicGrid,
    currentSong,
    onSongClick,
    matchesSongPath,
    categoryHooks = null,
    emptyMessage = 'No music files found.',
) {
    if (!musicGrid) return;

    musicGrid.innerHTML = '';

    if (!musicFiles || musicFiles.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'music-grid-empty';
        empty.textContent = emptyMessage;
        musicGrid.appendChild(empty);
        return;
    }

    musicFiles.forEach((song) => {
        const songPath = `src/assets/audio/music/${song.filename}`;
        const selected = !!(matchesSongPath && matchesSongPath(songPath, currentSong));
        const tile = createMusicGridTile(song, {
            selected,
            categoryHooks,
            onClick: () => {
                document.querySelectorAll('.music-grid-btn').forEach((btn) => btn.classList.remove('selected'));
                tile.classList.add('selected');
                if (onSongClick) onSongClick(songPath);
            },
        });
        musicGrid.appendChild(tile);
    });
}

/**
 * Render a tile grid with a custom click handler (category edit boards).
 * @param {MusicSong[]} musicFiles
 * @param {HTMLElement} grid
 * @param {{
 *   emptyMessage?: string,
 *   markAllSelected?: boolean,
 *   onSongActivate: (song: MusicSong) => void,
 * }} options
 */
export function renderMusicTileBoard(musicFiles, grid, options) {
    if (!grid) return;
    grid.innerHTML = '';

    if (!musicFiles || musicFiles.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'music-grid-empty';
        empty.textContent = options.emptyMessage || 'No songs.';
        grid.appendChild(empty);
        return;
    }

    musicFiles.forEach((song) => {
        const tile = createMusicGridTile(song, {
            selected: !!options.markAllSelected,
            onClick: () => {
                if (typeof options.onSongActivate === 'function') {
                    options.onSongActivate(song);
                }
            },
        });
        grid.appendChild(tile);
    });
}

/**
 * @param {string} filename
 * @param {MusicGridCategoryHooks} hooks
 * @returns {HTMLElement|null}
 */
function buildSongCategoryRow(filename, hooks) {
    const assigned = typeof hooks.getCategoriesForSong === 'function'
        ? hooks.getCategoriesForSong(filename)
        : [];
    if (!assigned.length) return null;

    const row = document.createElement('div');
    row.className = 'music-song-categories';

    assigned.forEach((cat) => {
        const chip = document.createElement('span');
        chip.className = 'music-song-category-chip';
        chip.title = cat.name;

        const nameEl = document.createElement('span');
        nameEl.className = 'music-song-category-chip-name';
        nameEl.textContent = cat.name;
        chip.appendChild(nameEl);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'music-song-category-chip-remove';
        removeBtn.setAttribute('aria-label', `Remove from ${cat.name}`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof hooks.onRemoveCategory === 'function') {
                hooks.onRemoveCategory(filename, cat.id);
            }
        });
        chip.appendChild(removeBtn);
        row.appendChild(chip);
    });

    return row;
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
