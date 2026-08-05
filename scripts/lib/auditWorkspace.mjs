/**
 * Scratch workspace for wiki caches + audit JSON/CSV (outside the repo).
 * Override with OVERWATCH_ATLAS_AUDIT_DIR if needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_AUDIT_WORKSPACE = path.join(
    os.homedir(),
    'OneDrive',
    'Escritorio',
    'interactions',
    'overwatch-atlas-audits',
);

export const AUDIT_WORKSPACE = String(process.env.OVERWATCH_ATLAS_AUDIT_DIR || '')
    .trim() || DEFAULT_AUDIT_WORKSPACE;

/**
 * @param {...string} parts
 * @returns {string}
 */
export function auditPath(...parts) {
    return path.join(AUDIT_WORKSPACE, ...parts);
}

export function ensureAuditWorkspace() {
    fs.mkdirSync(AUDIT_WORKSPACE, { recursive: true });
    return AUDIT_WORKSPACE;
}

export const WIKI_QUOTES_CACHE_DIR = auditPath('_wiki-quotes-cache');
