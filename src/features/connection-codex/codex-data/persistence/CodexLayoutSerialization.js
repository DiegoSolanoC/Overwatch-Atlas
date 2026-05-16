/**
 * Codex save payload shape: nodes from the in-memory model + directed edges.
 * Used by save/export/import preview — DOM is not the source of truth for node positions.
 */

/**
 * @param {Array<object>} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {{ nodes: object[], edges: { fromId: string, toId: string }[] }}
 */
export function serializeCodexLayoutSnapshot(allNodes, edges) {
    const nodes = (allNodes || []).map((node) => {
        const kind = node.kind;
        const x = node.x;
        const y = node.y;
        const id = node.id;
        const scale = node.scale || 1;
        const bgColor = node.bgColor || null;
        if (kind === 'junction') {
            return { id, kind: 'junction', x, y, scale, bgColor };
        }
        if (kind === 'hero') {
            return { id, kind: 'hero', heroName: node.heroName || '', x, y, scale, bgColor };
        }
        if (kind === 'country') {
            return {
                id,
                kind: 'country',
                countryKey: node.countryKey || '',
                x,
                y,
                scale,
                bgColor
            };
        }
        if (kind === 'npc') {
            return { id, kind: 'npc', npcName: node.npcName || '', x, y, scale, bgColor };
        }
        return {
            id,
            kind: 'faction',
            factionFilename: node.factionFilename || '',
            factionDisplay: node.factionDisplay || '',
            x,
            y,
            scale,
            bgColor
        };
    });
    return {
        nodes,
        edges: (edges || []).map((e) => ({ fromId: e.fromId, toId: e.toId }))
    };
}

/**
 * @param {number} saveVersion
 * @param {object} snapshot `{ nodes, edges }`
 */
export function stringifyCodexLayoutJson(saveVersion, snapshot) {
    return `${JSON.stringify({ v: saveVersion, nodes: snapshot.nodes, edges: snapshot.edges }, null, 2)}\n`;
}

/**
 * @param {string} jsonText full file contents
 * @param {string} [filename] download attribute
 */
export function downloadTextFileAsJson(jsonText, filename) {
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
