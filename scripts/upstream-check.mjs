#!/usr/bin/env node
// Detects upstream changes that may need porting into this harness.
//
//   node scripts/upstream-check.mjs [--out report.md] [--json summary.json]
//                                   [--update-lock] [--cache DIR] [--lock FILE]
//
// For every upstream in upstream.lock.json it finds the latest ref (newest
// semver tag or branch head), and lists commits and diffstats that touch the
// upstream paths each of our files was derived from. It never edits our
// adapted files: porting is a judgement call (see .claude/commands/upstream-sync.md).
// --update-lock bumps the lock to the latest refs; run it only after porting.
// Exit code is 0 whether or not updates exist; read `changed` in the JSON.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_LOG = 30;

function parseArgs(argv) {
  const args = {
    out: null,
    json: null,
    updateLock: false,
    cache: path.join(os.tmpdir(), 'sdd-harness-upstreams'),
    lock: path.join(root, 'upstream.lock.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--update-lock') args.updateLock = true;
    else if (a === '--cache') args.cache = argv[++i];
    else if (a === '--lock') args.lock = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

function syncMirror(cache, name, repo) {
  const dir = path.join(cache, name);
  if (!fs.existsSync(path.join(dir, 'HEAD'))) {
    fs.mkdirSync(cache, { recursive: true });
    execFileSync('git', ['clone', '--quiet', '--bare', '--filter=blob:none', repo, dir], { stdio: 'inherit' });
  }
  git(dir, 'fetch', '--quiet', '--prune', '--tags', '--force', 'origin', '+refs/heads/*:refs/heads/*');
  return dir;
}

function semverKey(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  return m ? m.slice(1).map(Number) : null;
}

// Pre-releases (v2.0.0-beta.1) and non-version tags are ignored.
export function newestSemverTag(tags) {
  const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  let best = null;
  for (const tag of tags) {
    const key = semverKey(tag);
    if (key && (!best || cmp(key, best.key) > 0)) best = { tag, key };
  }
  return best ? best.tag : null;
}

function latestRef(dir, up) {
  if (up.follow === 'tag') {
    const tag = newestSemverTag(git(dir, 'tag', '--list').split('\n').filter(Boolean));
    if (!tag) throw new Error('no semver tags found');
    return { tag, commit: git(dir, 'rev-parse', `${tag}^{commit}`) };
  }
  return { commit: git(dir, 'rev-parse', `refs/heads/${up.branch}`) };
}

function checkUpstream(name, up, cache) {
  const dir = syncMirror(cache, name, up.repo);
  const latest = latestRef(dir, up);
  const result = { name, repo: up.repo, from: { tag: up.tag, commit: up.commit }, to: latest, changed: false, files: [] };
  if (latest.commit === up.commit) return result;

  for (const [ours, theirs] of Object.entries(up.tracks)) {
    const log = git(dir, 'log', '--no-merges', '--format=%h %s', `${up.commit}..${latest.commit}`, '--', ...theirs)
      .split('\n')
      .filter(Boolean);
    if (log.length === 0) continue;
    const stat = git(dir, 'diff', '--stat=100', up.commit, latest.commit, '--', ...theirs);
    const missing = theirs.filter((p) => {
      try {
        git(dir, 'cat-file', '-e', `${latest.commit}:${p}`);
        return false;
      } catch {
        return true;
      }
    });
    result.files.push({ ours, theirs, commits: log.length, log: log.slice(0, MAX_LOG), stat, missing });
  }
  result.changed = result.files.length > 0;
  return result;
}

function short(ref) {
  return ref.tag ? `${ref.tag} (${ref.commit.slice(0, 7)})` : ref.commit.slice(0, 7);
}

function renderReport(results) {
  const lines = ['# Upstream changes to review', ''];
  for (const r of results) {
    lines.push(`## ${r.name} — ${short(r.from)} → ${short(r.to)}`, '');
    if (r.from.commit === r.to.commit) {
      lines.push('Up to date.', '');
      continue;
    }
    lines.push(`Compare: ${r.repo}/compare/${r.from.commit.slice(0, 12)}...${r.to.commit.slice(0, 12)}`, '');
    if (!r.changed) {
      lines.push('New upstream commits, but none touch tracked paths. Safe to bump the lock.', '');
      continue;
    }
    for (const f of r.files) {
      lines.push(`### \`${f.ours}\` ← ${f.theirs.map((t) => `\`${t}\``).join(', ')}`, '');
      if (f.missing.length) lines.push(`**Removed or moved upstream:** ${f.missing.map((t) => `\`${t}\``).join(', ')}`, '');
      lines.push(`${f.commits} commit(s):`, '');
      for (const l of f.log) lines.push(`- ${l}`);
      if (f.commits > f.log.length) lines.push(`- … ${f.commits - f.log.length} more`);
      lines.push('', '```', f.stat, '```', '');
    }
  }
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const lock = JSON.parse(fs.readFileSync(args.lock, 'utf8'));
  const results = Object.entries(lock.upstreams).map(([name, up]) => checkUpstream(name, up, args.cache));
  const report = renderReport(results);
  const summary = {
    changed: results.some((r) => r.changed),
    behind: results.some((r) => r.from.commit !== r.to.commit),
    upstreams: results.map(({ name, from, to, changed, files }) => ({
      name,
      from,
      to,
      changed,
      files: files.map((f) => ({ ours: f.ours, commits: f.commits, missing: f.missing })),
    })),
  };

  if (args.out) fs.writeFileSync(args.out, report + '\n');
  else process.stdout.write(report + '\n');
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(summary, null, 2) + '\n');

  if (args.updateLock) {
    for (const r of results) {
      const up = lock.upstreams[r.name];
      up.commit = r.to.commit;
      if (r.to.tag) up.tag = r.to.tag;
    }
    fs.writeFileSync(args.lock, JSON.stringify(lock, null, 2) + '\n');
    process.stderr.write('upstream.lock.json updated to latest refs\n');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
