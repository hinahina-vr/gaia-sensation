// Inventory a fixed Git commit without copying the working tree or publishing it.
// This is a review plan, not an approved export list or a release check.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function classify(file, mode = '100644') {
  if (!['100644', '100755'].includes(mode)) return ['review', 'symlink-or-submodule'];
  if (/(^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|id_rsa|id_ed25519)$|\.(?:pem|p12|pfx|key)$/i.test(file)
      && !/\.(?:example|sample)$/.test(file)) return ['exclude', 'potential-secret-file'];
  if (/^(?:\.agents|\.codex|node_modules|\.wrangler|tmp)\//.test(file) || /(^|\/)AGENTS\.md$/.test(file)) return ['exclude', 'development-only'];
  if (/^artifacts\/gx-setting-bible\/[^/]+\.png$/.test(file)) return ['candidate', 'exhibition-asset-do-not-drop'];
  if (/^(?:artifacts|output)\//.test(file)) return ['review', 'captures-or-book-assets-check-references'];
  if (/^\.github\//.test(file) || /(^|\/)wrangler[^/]*\.jsonc?$/.test(file)) return ['review', 'ci-or-production-destination'];
  if (/^docs\/internal\//.test(file)) return ['review', 'internal-record-check-rights-dependencies'];
  const publicDocs = new Set(['README.md', 'LICENSE.md', 'PRIVACY.md', 'SECURITY.md',
    'docs/README.md', 'docs/CONTEST_2026_SUBMISSION.md', 'docs/ARCHITECTURE.md',
    'docs/DATA_SOURCES.md', 'docs/MEDIA_RIGHTS_LEDGER.md', 'docs/REGION-CODE-SOURCES.md']);
  if (publicDocs.has(file)) return ['candidate', 'public-document'];
  if (/\.md$/i.test(file)) return ['review', 'documentation-or-provenance-check-consumers'];
  if (/^docs\//.test(file)) return ['review', 'rights-inventory-or-support-file'];
  // Data is opt-in at export: directory names alone cannot prove runtime use.
  // Generated URLs, historical series and fallback files must be traced first.
  if (/^data\/sources\//.test(file)) return ['review', 'raw-source-exclude-unless-production-required'];
  if (/^data\//.test(file)) return ['review', 'data-requires-runtime-build-or-rights-reference'];
  if (/(?:candidates|selected)-\d{8}\//.test(file)) return ['review', 'artwork-check-runtime-and-rights-ledger'];
  return ['candidate', 'source-data-tests-or-assets'];
}

export function parseTree(value) {
  return value.split('\0').filter(Boolean).map(entry => {
    const separator = entry.indexOf('\t');
    if (separator < 0) throw new Error('Invalid Git tree entry');
    const [mode, type, blob, size] = entry.slice(0, separator).trim().split(/\s+/);
    const file = entry.slice(separator + 1);
    if (file.startsWith('/') || file.split('/').includes('..')) throw new Error('Unsafe tree path');
    const [decision, reason] = classify(file, mode);
    return { path: file, mode, type, blob, bytes: size === '-' ? null : Number(size), decision, reason };
  });
}

export function prepare(root, ref = 'HEAD') {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20e6, windowsHide: true });
  if (!/^(?:HEAD|[a-f0-9]{40})$/.test(ref)) throw new Error('Use HEAD or a full commit SHA');
  const sourceCommit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  const files = parseTree(git(['ls-tree', '-rlz', sourceCommit]));
  const counts = { candidate: 0, review: 0, exclude: 0 };
  for (const file of files) counts[file.decision]++;
  // Record only that concurrent work exists; never include its contents in the snapshot.
  const worktreeDirty = git(['status', '--porcelain', '--untracked-files=normal']).length > 0;
  return {
    schemaVersion: 1, status: 'preparation-only', sourceCommit,
    sourceTree: git(['rev-parse', `${sourceCommit}^{tree}`]).trim(),
    worktreeDirty, workingChangesIncluded: false, historyIncluded: false,
    exported: false, secretContentScanPerformed: false,
    note: 'candidate means proposed inclusion, not verified safe or release-ready. No files are exported.',
    counts, totalBytes: files.reduce((n, f) => n + (f.bytes || 0), 0),
    largeFilesForReview: files.filter(f => f.bytes >= 50 * 1024 * 1024).map(f => f.path),
    pending: [
      'Finish and verify development; select a full commit SHA. Dirty changes are excluded from this plan.',
      'Resolve review entries and references before building an explicit export allowlist.',
      'Exclude production-unused data from the new repository only; verify dynamic URLs, history, fallbacks, build inputs and required attribution before removal.',
      'Preserve original media provenance across history reset; recheck rights scope after export.',
      'Reconcile package scripts and tests with removed internal records; do not silently disable checks.',
      'Run secret-content scan and verify source URLs point to the chosen new repository.',
      'Choose repository name, access, and reviewer permissions; initially private.',
      'Inspect live Pages integration and isolate development credentials before production cutover.',
      'Test a fresh history-free export, then authorize publish and separately verify production.'
    ], files,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '..');
  const report = prepare(root, process.argv[2] || 'HEAD');
  const artifacts = path.join(root, 'artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const directory = fs.mkdtempSync(path.join(artifacts, 'repository-preparation-'));
  fs.writeFileSync(path.join(directory, 'inventory.json'), JSON.stringify(report, null, 2) + '\n');
  const lines = ['# Production repository preparation', '', `Source commit: ${report.sourceCommit}`,
    '', 'Preparation only. No export, Git mutation, network write, or deployment.', '',
    `Files: ${report.files.length}; candidates: ${report.counts.candidate}; review: ${report.counts.review}; exclude: ${report.counts.exclude}.`,
    `Working tree dirty: ${report.worktreeDirty}; uncommitted changes are NOT included.`, '',
    '## Before publication', '', ...report.pending.map(item => `- ${item}`), '',
    '## Review / exclusion candidates', '',
    ...report.files.filter(f => f.decision !== 'candidate').map(f => `- ${f.decision}: ${f.path} (${f.reason})`), ''];
  fs.writeFileSync(path.join(directory, 'REPORT.md'), lines.join('\n'));
  console.log(JSON.stringify({ status: report.status, sourceCommit: report.sourceCommit, counts: report.counts, worktreeDirty: report.worktreeDirty, directory }, null, 2));
}
