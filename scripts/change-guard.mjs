#!/usr/bin/env node
// PreToolUse hook for Edit/Write/MultiEdit/NotebookEdit. In an OpenSpec project
// with no active change, it stops source edits so Claude classifies the work
// first (sdd-workflow). Deny-then-allow pattern adapted from ECC's GateGuard.
//
// SDD_GUARD=nudge  (default) deny the first source edit per session, then allow
// SDD_GUARD=strict deny every source edit until an active change exists
// SDD_GUARD=off    disable
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readStdinJson, projectDir, openspecDir, activeChanges } from './lib.mjs';

const EXEMPT_DIRS = ['openspec', '.claude', '.git'];
const EXEMPT_EXT = new Set(['.md', '.mdx', '.txt', '.rst', '.adoc']);

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }) + '\n',
  );
  process.exit(0);
}

function isExempt(root, file) {
  const rel = path.relative(root, path.resolve(root, file));
  if (rel.startsWith('..') || path.isAbsolute(rel)) return true; // outside the project
  const first = rel.split(path.sep)[0];
  if (EXEMPT_DIRS.includes(first)) return true;
  return EXEMPT_EXT.has(path.extname(rel).toLowerCase());
}

function markerPath(sessionId) {
  const safe = String(sessionId || 'nosession').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(os.tmpdir(), 'sdd-harness', `${safe}.nudged`);
}

try {
  const mode = (process.env.SDD_GUARD || 'nudge').toLowerCase();
  if (mode === 'off') allow();

  const input = readStdinJson();
  const toolInput = input.tool_input || {};
  const file = toolInput.file_path || toolInput.notebook_path;
  if (!file) allow();

  const root = projectDir(input);
  const osDir = openspecDir(root);
  if (!osDir || isExempt(root, file)) allow();
  if (activeChanges(osDir).length > 0) allow();

  const base =
    `[sdd-harness] No active OpenSpec change, and this edits source (${path.relative(root, path.resolve(root, file))}). ` +
    'Classify the request with the sdd-workflow skill before editing: ' +
    'standard or large work (observable behavior, API, security surface) starts with /opsx:propose and waits for approval.';

  if (mode === 'strict') {
    deny(`${base} Strict mode: create the change first, or ask the user to set SDD_GUARD=nudge for trivial edits.`);
  }

  const marker = markerPath(input.session_id);
  if (fs.existsSync(marker)) allow();
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, new Date().toISOString());
  deny(`${base} If it is honestly trivial or small, state the tier in one line and retry the edit; it will be allowed for the rest of this session.`);
} catch {
  allow(); // a broken guard must never block work
}
