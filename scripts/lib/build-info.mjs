import { execFileSync } from 'node:child_process';
import path from 'node:path';

const shaPattern = /^[0-9a-f]{40}$/;

export function readBuildInfo(root, { env = process.env, context = 'build' } = {}) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  }).trim();
  let commit = null;
  let worktree = 'unknown';
  let source = 'unavailable';
  try {
    // Do not accidentally identify an extracted folder as its parent repository.
    if (path.resolve(git('rev-parse', '--show-toplevel')) === path.resolve(root)) {
      const head = git('rev-parse', '--verify', 'HEAD');
      if (shaPattern.test(head)) {
        commit = head;
        source = 'git';
        worktree = git('status', '--porcelain', '--untracked-files=normal') ? 'modified' : 'clean';
      }
    }
  } catch {
    // Without a readable worktree, never assume a clean checkout.
  }
  const pagesCommit = env.CF_PAGES_COMMIT_SHA?.trim().toLowerCase();
  if (pagesCommit) {
    if (!shaPattern.test(pagesCommit)) throw new Error('Invalid CF_PAGES_COMMIT_SHA');
    if (commit && commit !== pagesCommit) throw new Error('CF_PAGES_COMMIT_SHA does not match the checked-out HEAD');
    if (!commit) {
      commit = pagesCommit;
      source = 'cloudflare';
    }
  }
  return { schemaVersion: 1, commit, shortCommit: commit?.slice(0, 7) ?? null, worktree, source, context };
}
