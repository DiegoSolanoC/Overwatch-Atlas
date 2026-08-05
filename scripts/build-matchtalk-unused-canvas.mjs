#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Build canvas + CSV from scripts/_audit-matchtalk-unused.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const REPORT = auditPath('_audit-matchtalk-unused.json');
const CSV_OUT = auditPath('_audit-matchtalk-unused.csv');
const CANVAS_OUT = path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-diego-OneDrive-Escritorio-Projects-Overwatch-Atlas',
    'canvases',
    'matchtalk-unused-audit.canvas.tsx',
);

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const { summary } = report;

const heroRows = Object.entries(report.unusedByHero)
    .map(([hero, counts]) => ({
        hero,
        dialogue: counts.dialogue,
        inRepo: counts.inRepoDialogue,
        notImported: counts.dialogue - counts.inRepoDialogue,
        sfx: counts.sfx,
    }))
    .sort((a, b) => b.dialogue - a.dialogue || a.hero.localeCompare(b.hero));

const priority = report.unusedDialogueInVoicelines.map((row) => ({
    hero: row.hero,
    label: row.label,
    atlasName: row.atlasName,
    repoFilename: row.repoFilename || row.atlasName,
    sourceRel: row.sourceRel,
}));

const missing = report.unusedDialogueNotImported.map((row) => ({
    hero: row.hero,
    label: row.label,
    atlasName: row.atlasName,
    sourceRel: row.sourceRel,
}));

function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const csvLines = [
    'bucket,hero,label,atlasName,repoFilename,sourceRel',
    ...priority.map((row) =>
        ['in-voicelines-unused', row.hero, row.label, row.atlasName, row.repoFilename, row.sourceRel]
            .map(csvEscape)
            .join(','),
    ),
    ...missing.map((row) =>
        ['not-in-voicelines', row.hero, row.label, row.atlasName, '', row.sourceRel]
            .map(csvEscape)
            .join(','),
    ),
];
fs.writeFileSync(CSV_OUT, `${csvLines.join('\n')}\n`);

function embed(value) {
    return JSON.stringify(value, null, 2);
}

const canvas = `import {
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
} from 'cursor/canvas';

const GENERATED_AT = ${embed(report.generatedAt)};
const SUMMARY = ${embed(summary)};
const HERO_ROWS = ${embed(heroRows)};
const PRIORITY_ROWS = ${embed(priority)};
const MISSING_ROWS = ${embed(missing)};

const HERO_OPTIONS = [
  { value: 'all', label: 'All heroes' },
  ...HERO_ROWS.map((row) => ({
    value: row.hero,
    label: \`\${row.hero} (\${row.dialogue})\`,
  })),
];

export default function MatchTalkUnusedAudit() {
  const [hero, setHero] = useCanvasState('hero', 'all');
  const [query, setQuery] = useCanvasState('query', '');
  const [bucket, setBucket] = useCanvasState('bucket', 'priority');

  const q = String(query || '').trim().toLowerCase();

  const filterRows = (rows: typeof PRIORITY_ROWS) =>
    rows.filter((row: (typeof PRIORITY_ROWS)[number]) => {
      if (hero !== 'all' && row.hero !== hero) return false;
      if (!q) return true;
      return (
        row.label.toLowerCase().includes(q) ||
        row.atlasName.toLowerCase().includes(q) ||
        row.hero.toLowerCase().includes(q)
      );
    });

  const priorityFiltered = filterRows(PRIORITY_ROWS);
  const missingFiltered = filterRows(MISSING_ROWS);
  const activeRows = bucket === 'priority' ? priorityFiltered : missingFiltered;

  return (
    <Stack gap={24} style={{ padding: 24 }}>
      <Stack gap={8}>
        <H1>MatchTalk unused-voice audit</H1>
        <Text tone="secondary">
          Source: HeroVoice/*/MatchTalk vs conversations.json voice/voicePrefix.
          Generated {GENERATED_AT}. No files were auto-wired.
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(SUMMARY.matchTalkUniqueAtlasNames)} label="Unique MatchTalk lines" />
        <Stat value={String(SUMMARY.usedInConversations)} label="Used in conversations" tone="success" />
        <Stat value={String(SUMMARY.unusedDialogueInVoicelines)} label="In Voicelines, unused" tone="warning" />
        <Stat value={String(SUMMARY.unusedDialogueNotImported)} label="Not in Voicelines, unused" tone="danger" />
      </Grid>

      <Callout tone="info" title="How to read this">
        A MatchTalk extract file counts as used if conversations reference the same spoken line
        by exact filename, cleaned label (including mid-line (pause)/(sigh) stripped), truncated
        filename prefix, or strong same-hero word overlap. Priority = still unused after that,
        yet a copy exists under Theater/Voicelines. Not in Voicelines = extract-only.
        Pure paren SFX ({SUMMARY.unusedSfx}) are omitted from the dialogue tables.
      </Callout>

      <Stack gap={12}>
        <H2>Unused dialogue by hero</H2>
        <Text tone="secondary" size="small">
          Columns: total unused dialogue / already in Voicelines / extract-only.
        </Text>
        <Table
          headers={['Hero', 'Unused dialogue', 'In Voicelines', 'Not imported', 'SFX unused']}
          rows={HERO_ROWS.map((row) => [
            row.hero,
            String(row.dialogue),
            String(row.inRepo),
            String(row.notImported),
            String(row.sfx),
          ])}
        />
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>Possible omissions</H2>
        <Row gap={12} style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Stack gap={4} style={{ minWidth: 180 }}>
            <Text size="small" weight="semibold">Bucket</Text>
            <Select
              value={bucket}
              onChange={setBucket}
              options={[
                { value: 'priority', label: \`In Voicelines unused (\${PRIORITY_ROWS.length})\` },
                { value: 'missing', label: \`Not in Voicelines (\${MISSING_ROWS.length})\` },
              ]}
            />
          </Stack>
          <Stack gap={4} style={{ minWidth: 220 }}>
            <Text size="small" weight="semibold">Hero</Text>
            <Select value={hero} onChange={setHero} options={HERO_OPTIONS} />
          </Stack>
          <Stack gap={4} style={{ minWidth: 260, flex: 1 }}>
            <Text size="small" weight="semibold">Search label</Text>
            <TextInput value={query} onChange={setQuery} placeholder="Filter by line text…" />
          </Stack>
          <Pill tone="neutral">{activeRows.length} shown</Pill>
        </Row>

        <H3>{bucket === 'priority' ? 'In Voicelines but unused' : 'MatchTalk only (not in Voicelines)'}</H3>
        <Table
          headers={
            bucket === 'priority'
              ? ['Hero', 'MatchTalk label', 'Repo filename']
              : ['Hero', 'MatchTalk label', 'Extract path']
          }
          rows={activeRows.slice(0, 500).map((row) =>
            bucket === 'priority'
              ? [row.hero, row.label, row.repoFilename || row.atlasName]
              : [row.hero, row.label, row.sourceRel],
          )}
        />
        {activeRows.length > 500 ? (
          <Text tone="secondary" size="small">
            Showing first 500 of {activeRows.length}. Narrow with hero/search, or open
            scripts/_audit-matchtalk-unused.csv for the full list.
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}
`;

fs.writeFileSync(CANVAS_OUT, canvas);
console.log(`CSV: ${CSV_OUT} (${csvLines.length - 1} data rows)`);
console.log(`Canvas: ${CANVAS_OUT}`);
