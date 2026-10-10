// Shared helpers for sdd-harness hooks. Hooks must never break a session:
// every entry point catches errors and exits 0.
import fs from 'node:fs';
import path from 'node:path';

export function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

export function openspecDir(root) {
  const dir = path.join(root, 'openspec');
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null;
}

// Same rule as OpenSpec: a box holding only x (any case, any spacing) is done.
const TASK_RE = /^\s*[-*]\s+\[([^\]]*)\]/;

export function taskProgress(tasksFile) {
  let done = 0;
  let total = 0;
  let text;
  try {
    text = fs.readFileSync(tasksFile, 'utf8');
  } catch {
    return null;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = TASK_RE.exec(line);
    if (!m) continue;
    total += 1;
    if (m[1].trim().toLowerCase() === 'x') done += 1;
  }
  return { done, total };
}

export function activeChanges(osDir) {
  const changesDir = path.join(osDir, 'changes');
  let entries;
  try {
    entries = fs.readdirSync(changesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && e.name !== 'archive' && !e.name.startsWith('.'))
    .map((e) => ({
      name: e.name,
      progress: taskProgress(path.join(changesDir, e.name, 'tasks.md')),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function specCount(osDir) {
  const specsDir = path.join(osDir, 'specs');
  let count = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'spec.md') count += 1;
    }
  };
  walk(specsDir);
  return count;
}
