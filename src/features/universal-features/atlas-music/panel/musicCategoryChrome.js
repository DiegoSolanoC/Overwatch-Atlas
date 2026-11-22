/**
 * musicCategoryChrome — category tabs + gear-driven edit mode.
 *
 * Selecting a category filters the main grid for playback. The gear toggles
 * edit mode: + New / Delete / reorder / membership chips / add-remove boards.
 */

import { renderMusicTileBoard } from './musicGridButtons.js';

/**
 * @param {import('../MusicService.js').MusicService} service
 */
export function mountMusicCategoryChrome(service) {
    if (!service || service._musicCategoryChromeMounted) return;
    const tabs = document.getElementById('musicCategoryTabs');
    const manage = document.getElementById('musicCategoryManage');
    const gearBtn = document.getElementById('musicCategoryGearBtn');
    const deleteBtn = document.getElementById('musicCategoryDeleteBtn');
    const outGrid = document.getElementById('musicCategoryOutGrid');
    const inHeading = document.getElementById('musicCategoryInHeading');
    const outToolbar = document.getElementById('musicCategoryOutToolbar');
    const outModeGroup = document.getElementById('musicCategoryOutMode');
    if (!tabs || !manage || !gearBtn || !deleteBtn || !outGrid || !service.categoryService) {
        return;
    }

    service._musicCategoryChromeMounted = true;
    service.categoryEditMode = false;

    /** @type {'not-in'|'uncategorized'} */
    let outMode = 'not-in';

    const refreshAll = () => {
        renderTabs();
        syncManageVisibility();
        service.createMusicButtons();
    };

    service.refreshMusicCategoryPicker = () => {
        if (service.categoryService.getActiveCategoryId() && service.categoryEditMode) {
            renderOutGrid();
        }
    };

    const setEditMode = (on) => {
        service.categoryEditMode = !!on;
        refreshAll();
    };

    const clearPicker = () => {
        outGrid.innerHTML = '';
    };

    const syncOutModeButtons = () => {
        if (!outModeGroup) return;
        outModeGroup.querySelectorAll('[data-out-mode]').forEach((btn) => {
            const mode = btn.getAttribute('data-out-mode');
            btn.classList.toggle('active', mode === outMode);
            btn.setAttribute('aria-pressed', mode === outMode ? 'true' : 'false');
        });
    };

    const syncGearButton = () => {
        const editing = !!service.categoryEditMode;
        gearBtn.classList.toggle('active', editing);
        gearBtn.setAttribute('aria-pressed', editing ? 'true' : 'false');
        gearBtn.title = editing ? 'Done editing categories' : 'Edit categories';
        gearBtn.setAttribute('aria-label', editing ? 'Done editing categories' : 'Edit categories');
    };

    const syncManageVisibility = () => {
        const activeId = service.categoryService.getActiveCategoryId();
        const editing = !!service.categoryEditMode;
        const editingCategory = !!(editing && activeId);

        syncGearButton();

        // Delete only while editing a selected (non-All) category.
        manage.hidden = !editingCategory;

        if (inHeading) inHeading.hidden = !editingCategory;
        if (outToolbar) outToolbar.hidden = !editingCategory;
        outGrid.hidden = !editingCategory;

        if (!editingCategory) {
            clearPicker();
            return;
        }
        syncOutModeButtons();
        renderOutGrid();
    };

    const listOutSongs = () => {
        const activeId = service.categoryService.getActiveCategoryId();
        if (!activeId) return [];
        return (service.musicFiles || [])
            .filter((song) => {
                const ids = service.categoryService.getCategoryIdsForSong(song.filename) || [];
                if (outMode === 'uncategorized') return ids.length === 0;
                return !ids.includes(activeId);
            })
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const outEmptyMessage = () => (
        outMode === 'uncategorized'
            ? 'No uncategorized songs left.'
            : 'Every song is already in this category.'
    );

    const renderOutGrid = () => {
        const activeId = service.categoryService.getActiveCategoryId();
        if (!activeId || !service.categoryEditMode) {
            outGrid.innerHTML = '';
            return;
        }

        const scrollTop = outGrid.scrollTop;
        renderMusicTileBoard(listOutSongs(), outGrid, {
            emptyMessage: outEmptyMessage(),
            markAllSelected: false,
            onSongActivate: (song) => {
                service.categoryService.addSongToCategory(song.filename, activeId);
                service.createMusicButtons();
            },
        });
        outGrid.scrollTop = scrollTop;
    };

    gearBtn.addEventListener('click', () => {
        setEditMode(!service.categoryEditMode);
    });

    if (outModeGroup) {
        outModeGroup.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const btn = target.closest('[data-out-mode]');
            if (!btn || !outModeGroup.contains(btn)) return;
            const mode = btn.getAttribute('data-out-mode');
            if (mode !== 'not-in' && mode !== 'uncategorized') return;
            if (mode === outMode) return;
            outMode = mode;
            syncOutModeButtons();
            renderOutGrid();
        });
    }

    const playCategorySwitchSound = () => {
        try {
            window.SoundEffectsManager?.play?.('filterPick');
        } catch (_) { /* ignore */ }
    };

    const selectCategory = (categoryId) => {
        const prev = service.categoryService.getActiveCategoryId();
        const next = categoryId == null ? null : categoryId;
        if (prev === next) return;
        service.categoryService.setActiveCategoryId(next);
        playCategorySwitchSound();
        // Gear owns edit mode — switching tabs keeps it.
        refreshAll();
    };

    /** @type {string|null} */
    let dragCategoryId = null;

    const moveCategoryBy = (categoryId, delta) => {
        if (!service.categoryEditMode) return;
        if (service.categoryService.moveCategory(categoryId, delta)) {
            refreshAll();
        }
    };

    const renderTabs = () => {
        const categories = service.categoryService.getCategories();
        const activeId = service.categoryService.getActiveCategoryId();
        const editing = !!service.categoryEditMode;
        tabs.innerHTML = '';
        tabs.classList.toggle('music-category-tabs--editing', editing);

        const makeTabLabel = (text) => {
            const label = document.createElement('span');
            label.className = 'music-category-tab-label';
            label.textContent = text;
            return label;
        };

        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = `music-category-tab music-category-tab--slant${activeId == null ? ' active' : ''}`;
        allBtn.setAttribute('role', 'tab');
        allBtn.setAttribute('aria-selected', activeId == null ? 'true' : 'false');
        allBtn.appendChild(makeTabLabel('All'));
        allBtn.addEventListener('click', () => selectCategory(null));
        tabs.appendChild(allBtn);

        categories.forEach((cat, index) => {
            const wrap = document.createElement('div');
            wrap.className = 'music-category-tab-wrap';
            wrap.dataset.categoryId = cat.id;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `music-category-tab music-category-tab--slant${activeId === cat.id ? ' active' : ''}`;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', activeId === cat.id ? 'true' : 'false');
            btn.dataset.categoryId = cat.id;
            btn.appendChild(makeTabLabel(cat.name));
            btn.addEventListener('click', () => selectCategory(cat.id));

            if (editing) {
                btn.draggable = true;
                btn.title = 'Drag to reorder';
                btn.addEventListener('dragstart', (event) => {
                    dragCategoryId = cat.id;
                    wrap.classList.add('is-dragging');
                    event.dataTransfer?.setData('text/plain', cat.id);
                    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                });
                btn.addEventListener('dragend', () => {
                    dragCategoryId = null;
                    wrap.classList.remove('is-dragging');
                    tabs.querySelectorAll('.music-category-tab-wrap.is-drop-target').forEach((el) => {
                        el.classList.remove('is-drop-target');
                    });
                });
                wrap.addEventListener('dragover', (event) => {
                    if (!dragCategoryId || dragCategoryId === cat.id) return;
                    event.preventDefault();
                    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
                    wrap.classList.add('is-drop-target');
                });
                wrap.addEventListener('dragleave', () => {
                    wrap.classList.remove('is-drop-target');
                });
                wrap.addEventListener('drop', (event) => {
                    event.preventDefault();
                    wrap.classList.remove('is-drop-target');
                    const fromId = dragCategoryId || event.dataTransfer?.getData('text/plain');
                    if (!fromId || fromId === cat.id) return;
                    const ids = service.categoryService.getCategories().map((c) => c.id);
                    const from = ids.indexOf(fromId);
                    const to = ids.indexOf(cat.id);
                    if (from < 0 || to < 0) return;
                    ids.splice(from, 1);
                    ids.splice(to, 0, fromId);
                    if (service.categoryService.reorderCategories(ids)) refreshAll();
                });

                const reorder = document.createElement('div');
                reorder.className = 'music-category-tab-reorder';
                reorder.setAttribute('role', 'group');
                reorder.setAttribute('aria-label', `Reorder ${cat.name}`);

                const leftBtn = document.createElement('button');
                leftBtn.type = 'button';
                leftBtn.className = 'music-category-tab-move';
                leftBtn.setAttribute('aria-label', `Move ${cat.name} left`);
                leftBtn.textContent = '‹';
                leftBtn.disabled = index === 0;
                leftBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveCategoryBy(cat.id, -1);
                });

                const rightBtn = document.createElement('button');
                rightBtn.type = 'button';
                rightBtn.className = 'music-category-tab-move';
                rightBtn.setAttribute('aria-label', `Move ${cat.name} right`);
                rightBtn.textContent = '›';
                rightBtn.disabled = index === categories.length - 1;
                rightBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveCategoryBy(cat.id, 1);
                });

                reorder.appendChild(leftBtn);
                reorder.appendChild(rightBtn);
                wrap.appendChild(btn);
                wrap.appendChild(reorder);
            } else {
                wrap.appendChild(btn);
            }

            tabs.appendChild(wrap);
        });

        if (editing) {
            const newBtn = document.createElement('button');
            newBtn.type = 'button';
            newBtn.className = 'music-category-tab music-category-tab--slant music-category-tab--new';
            newBtn.setAttribute('aria-label', 'Create category');
            newBtn.appendChild(makeTabLabel('+ New'));
            newBtn.addEventListener('click', () => beginCreateCategory());
            tabs.appendChild(newBtn);
        }
    };

    const beginCreateCategory = () => {
        if (!service.categoryEditMode) return;
        if (tabs.querySelector('.music-category-create')) return;

        const form = document.createElement('div');
        form.className = 'music-category-create';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'music-category-create-input';
        input.placeholder = 'Category name';
        input.maxLength = 40;
        input.setAttribute('aria-label', 'New category name');

        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'music-category-action-btn';
        confirm.textContent = 'Create';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'music-category-action-btn music-category-action-btn--ghost';
        cancel.textContent = 'Cancel';

        const finish = () => {
            form.remove();
        };

        const submit = () => {
            const created = service.categoryService.createCategory(input.value);
            if (!created) {
                input.classList.add('music-category-create-input--invalid');
                input.focus();
                return;
            }
            finish();
            refreshAll();
        };

        confirm.addEventListener('click', submit);
        cancel.addEventListener('click', finish);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                finish();
            }
        });

        form.appendChild(input);
        form.appendChild(confirm);
        form.appendChild(cancel);
        tabs.appendChild(form);
        input.focus();
    };

    deleteBtn.addEventListener('click', () => {
        if (!service.categoryEditMode) return;
        const activeId = service.categoryService.getActiveCategoryId();
        if (!activeId) return;
        const cat = service.categoryService.getCategoryById(activeId);
        const label = cat?.name || 'this category';
        if (!window.confirm(`Delete category “${label}”? Songs stay in the library.`)) return;
        service.categoryService.deleteCategory(activeId);
        refreshAll();
    });

    renderTabs();
    syncManageVisibility();
}

/**
 * Songs currently in the active category (for the in-board).
 * @param {import('../MusicService.js').MusicService} service
 * @returns {Array<{ filename: string, name: string }>}
 */
export function getActiveCategorySongs(service) {
    const cats = service.categoryService;
    if (!cats) return service.musicFiles || [];
    return cats.filterSongsByCategory(cats.getActiveCategoryId(), service.musicFiles || []);
}

/**
 * Membership chips with × only while gear edit mode is on and browsing All
 * (category boards own membership while a category is selected).
 * @param {import('../MusicService.js').MusicService} service
 */
export function buildMusicGridCategoryHooks(service) {
    const cats = service.categoryService;
    if (!cats || !service.categoryEditMode) return null;
    if (cats.getActiveCategoryId()) return null;
    return {
        getCategoriesForSong: (filename) => cats.getCategoriesForSong(filename),
        onRemoveCategory: (filename, categoryId) => {
            cats.removeSongFromCategory(filename, categoryId);
            service.createMusicButtons();
        },
    };
}
