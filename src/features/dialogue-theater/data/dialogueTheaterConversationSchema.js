/**
 * @returns {string}
 */
export function createConversationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @returns {string}
 */
export function createDialogueLineId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @returns {{ id: string, hero: string, voice: string, subtitles: string, render: string }}
 */
export function buildBlankDialogueLine() {
    return {
        id: createDialogueLineId(),
        hero: '',
        voice: '',
        subtitles: '',
        render: '',
    };
}

/**
 * @returns {import('./DialogueTheaterDataService.js').DialogueConversation}
 */
export function buildBlankConversationRecord() {
    return {
        id: createConversationId(),
        name: 'Untitled conversation',
        status: 'active',
        eraName: '',
        scene: '',
        lines: [],
    };
}

/**
 * @param {unknown} raw
 * @returns {{ id: string, hero: string, voice: string, subtitles: string, render: string }|null}
 */
export function normalizeDialogueLine(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id != null ? raw.id : '').trim() || createDialogueLineId();
    return {
        id,
        hero: String(raw.hero != null ? raw.hero : '').trim(),
        voice: String(raw.voice != null ? raw.voice : '').trim(),
        subtitles: String(raw.subtitles != null ? raw.subtitles : ''),
        render: String(raw.render != null ? raw.render : '').trim(),
    };
}

/**
 * @param {unknown} raw
 * @param {string} [fallbackId]
 * @returns {import('./DialogueTheaterDataService.js').DialogueConversation|null}
 */
export function normalizeConversationRecord(raw, fallbackId) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id != null ? raw.id : fallbackId || '').trim() || createConversationId();
    const statusRaw = String(raw.status != null ? raw.status : 'active').trim().toLowerCase();
    const status = statusRaw === 'outdated' ? 'outdated' : 'active';
    const name = String(raw.name != null ? raw.name : raw.title != null ? raw.title : '')
        .trim() || 'Untitled conversation';
    const eraName = String(raw.eraName != null ? raw.eraName : '').trim();
    const scene = String(raw.scene != null ? raw.scene : '').trim();
    const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
    const lines = [];
    const seenLineIds = new Set();
    for (let i = 0; i < linesRaw.length; i += 1) {
        const line = normalizeDialogueLine(linesRaw[i]);
        if (!line || seenLineIds.has(line.id)) continue;
        seenLineIds.add(line.id);
        lines.push(line);
    }
    return { id, name, status, eraName, scene, lines };
}
