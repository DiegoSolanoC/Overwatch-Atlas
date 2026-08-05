#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT = auditPath('_audit-removed-vs-matchtalk.json');
const CANVAS_OUT = path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-diego-OneDrive-Escritorio-Projects-Overwatch-Atlas',
    'canvases',
    'removed-vs-matchtalk.canvas.tsx',
);

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));

function dedupeByName(rows) {
    const seen = new Set();
    return rows.filter((row) => {
        const key = `${row.conversationName || ''}::${(row.speakers || []).join('+')}::${String(row.preview || '').slice(0, 60)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const overlap = dedupeByName(report.overlapWikiRemovedAndNoMatchTalk || []);
const wikiRemovedInAtlas = dedupeByName(report.wikiRemovedInAtlas || []);
const wikiRemovedNotInAtlas = report.wikiRemovedMissingFromAtlas || [];
const noMtNotRemoved = report.noMatchTalkNotWikiRemoved || [];
const partial = report.conversationsPartialMatchTalk || [];

function embed(v) {
    return JSON.stringify(v, null, 2);
}

const canvas = `import {
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
} from 'cursor/canvas';

const SUMMARY = ${embed(report.summary)};
const OVERLAP = ${embed(overlap)};
const WIKI_REMOVED_IN_ATLAS = ${embed(wikiRemovedInAtlas)};
const WIKI_REMOVED_NOT_IN_ATLAS = ${embed(wikiRemovedNotInAtlas)};
const NO_MT_NOT_REMOVED = ${embed(
    noMtNotRemoved.map((r) => ({
        name: r.conversationName,
        id: r.conversationId,
        missing: r.missing,
        lineCount: r.lineCount,
        sample: (r.missingLines || []).slice(0, 2).join(' | '),
    })),
)};
const GENERATED_AT = ${embed(report.generatedAt)};

export default function RemovedVsMatchTalk() {
  const [panel, setPanel] = useCanvasState('panel', 'overlap');
  const [query, setQuery] = useCanvasState('query', '');
  const q = String(query || '').trim().toLowerCase();

  const filterPreview = (rows: Array<{ preview?: string; conversationName?: string; name?: string; sample?: string }>) =>
    rows.filter((row) => {
      if (!q) return true;
      const hay = \`\${row.conversationName || ''} \${row.name || ''} \${row.preview || ''} \${row.sample || ''}\`.toLowerCase();
      return hay.includes(q);
    });

  return (
    <Stack gap={24} style={{ padding: 24 }}>
      <Stack gap={8}>
        <H1>Removed tag cross-check</H1>
        <Text tone="secondary">
          Wiki Interactions marked REMOVED vs conversations missing MatchTalk extract audio.
          Generated {GENERATED_AT}. No tags applied yet.
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(SUMMARY.wikiRemovedMatchedToAtlasConversations)} label="Wiki REMOVED in Atlas" />
        <Stat value={String(SUMMARY.conversationsWithNoMatchTalkAudio)} label="Conversations with 0 MatchTalk hits" tone="warning" />
        <Stat value={String(SUMMARY.overlap_wikiRemoved_and_noMatchTalk)} label="Overlap (both)" tone="danger" />
        <Stat value={String(SUMMARY.noMatchTalk_but_notWikiRemoved)} label="No MatchTalk, not wiki-REMOVED" />
      </Grid>

      <Callout tone="info" title="Read this first">
        Every Atlas conversation that matched a wiki REMOVED interaction also has zero MatchTalk
        coverage ({SUMMARY.overlap_wikiRemoved_and_noMatchTalk}/{SUMMARY.wikiRemovedMatchedToAtlasConversations}).
        That overlap is the strongest Removed-tag candidate set. The larger
        "no MatchTalk" list also includes Classic / old / alternate-source lines that are not
        necessarily wiki-REMOVED — review before tagging.
      </Callout>

      <Select
        value={panel}
        onChange={setPanel}
        options={[
          { value: 'overlap', label: \`Overlap — wiki REMOVED ∩ no MatchTalk (\${OVERLAP.length})\` },
          { value: 'wikiInAtlas', label: \`All wiki REMOVED in Atlas (\${WIKI_REMOVED_IN_ATLAS.length})\` },
          { value: 'wikiMissing', label: \`Wiki REMOVED not in Atlas (\${WIKI_REMOVED_NOT_IN_ATLAS.length})\` },
          { value: 'noMt', label: \`No MatchTalk, not wiki-REMOVED (\${NO_MT_NOT_REMOVED.length})\` },
        ]}
      />
      <TextInput value={query} onChange={setQuery} placeholder="Filter…" />

      {panel === 'overlap' ? (
        <Stack gap={12}>
          <H2>Overlap candidates for Removed tag</H2>
          <Pill tone="neutral">{filterPreview(OVERLAP).length} shown</Pill>
          <Table
            headers={['Conversation', 'Speakers', 'Wiki preview']}
            rows={filterPreview(OVERLAP).map((row) => [
              row.conversationName || '',
              (row.speakers || []).join(' + '),
              row.preview || '',
            ])}
          />
        </Stack>
      ) : null}

      {panel === 'wikiInAtlas' ? (
        <Stack gap={12}>
          <H2>Wiki REMOVED interactions we already have</H2>
          <Table
            headers={['Conversation', 'Speakers', 'Preview']}
            rows={filterPreview(WIKI_REMOVED_IN_ATLAS).map((row) => [
              row.conversationName || '',
              (row.speakers || []).join(' + '),
              row.preview || '',
            ])}
          />
        </Stack>
      ) : null}

      {panel === 'wikiMissing' ? (
        <Stack gap={12}>
          <H2>Wiki REMOVED not found in Atlas</H2>
          <Text tone="secondary" size="small">
            May be true absences, or matcher misses (wiki link text pollution, wording drift).
          </Text>
          <Table
            headers={['Page', 'Speakers', 'Preview']}
            rows={filterPreview(WIKI_REMOVED_NOT_IN_ATLAS).map((row) => [
              row.pageHero || '',
              (row.speakers || []).join(' + '),
              row.preview || '',
            ])}
          />
        </Stack>
      ) : null}

      {panel === 'noMt' ? (
        <Stack gap={12}>
          <H2>Conversations with no MatchTalk audio (not wiki-REMOVED)</H2>
          <Text tone="secondary" size="small">
            Likely Classic / alternate-source / still-in-game-but-not-in-this-extract. Do not
            auto-tag Removed from this list alone. Partial MatchTalk gaps also exist:
            {SUMMARY.conversationsWithPartialMatchTalkAudio}.
          </Text>
          <Pill tone="neutral">{filterPreview(NO_MT_NOT_REMOVED).length} shown</Pill>
          <Table
            headers={['Conversation', 'Missing lines', 'Sample']}
            rows={filterPreview(NO_MT_NOT_REMOVED)
              .slice(0, 300)
              .map((row) => [
                row.name || '',
                \`\${row.missing}/\${row.lineCount}\`,
                row.sample || '',
              ])}
          />
          <Text tone="secondary" size="small">
            Full CSV: scripts/_audit-removed-vs-matchtalk.csv
          </Text>
        </Stack>
      ) : null}

      <Divider />
      <H3>Files</H3>
      <Text size="small">
        scripts/_audit-removed-vs-matchtalk.json · scripts/_audit-removed-vs-matchtalk.csv
      </Text>
    </Stack>
  );
}
`;

fs.writeFileSync(CANVAS_OUT, canvas);
console.log(`Canvas: ${CANVAS_OUT}`);
console.log(`Overlap unique: ${overlap.length}; noMT not removed: ${noMtNotRemoved.length}; partial: ${partial.length}`);
