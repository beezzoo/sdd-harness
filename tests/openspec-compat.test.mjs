// Checks that the harness still matches the installed OpenSpec CLI: the
// spec-miner output format validates under --strict and the config template
// loads without warnings and reaches the generated instructions.
// Skipped when `openspec` is not on PATH, unless OPENSPEC_REQUIRED=1 (CI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, OPENSPEC_TELEMETRY: '0', NO_COLOR: '1' };

function openspec(cwd, ...args) {
  const res = spawnSync('openspec', args, { cwd, env, encoding: 'utf8', shell: process.platform === 'win32' });
  return { code: res.status, out: `${res.stdout}${res.stderr}`, error: res.error };
}

const probe = openspec(os.tmpdir(), '--version');
const available = !probe.error && probe.code === 0;
const skip = !available && process.env.OPENSPEC_REQUIRED !== '1' ? 'openspec CLI not installed' : false;

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-harness-openspec-'));
  fs.mkdirSync(path.join(dir, 'openspec', 'specs', 'billing'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'openspec', 'changes'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tests', 'fixtures', 'billing', 'spec.md'), path.join(dir, 'openspec', 'specs', 'billing', 'spec.md'));
  fs.copyFileSync(path.join(repo, 'templates', 'openspec', 'config.yaml'), path.join(dir, 'openspec', 'config.yaml'));
  return dir;
}

// OpenSpec reports config problems as warnings and keeps going; treat any as failure.
const CONFIG_WARNING = /unknown (field|operation|key)|invalid '|must be (an? )?(array|object|string)|ignoring/i;

test('openspec CLI is installed', { skip }, () => {
  assert.ok(available, `openspec --version failed: ${probe.error?.message ?? probe.out}`);
});

test('spec-miner format passes openspec validate --strict', { skip }, () => {
  const r = openspec(project(), 'validate', '--specs', '--strict');
  assert.equal(r.code, 0, r.out);
});

test('config template loads cleanly and reaches artifact and apply instructions', { skip }, () => {
  const dir = project();
  const created = openspec(dir, 'new', 'change', 'compat-check');
  assert.equal(created.code, 0, created.out);

  const tasks = openspec(dir, 'instructions', 'tasks', '--change', 'compat-check');
  assert.equal(tasks.code, 0, tasks.out);
  assert.doesNotMatch(tasks.out, CONFIG_WARNING);
  assert.match(tasks.out, /red-to-green/, 'rules.tasks from the template should be injected');

  const apply = openspec(dir, 'instructions', 'apply', '--change', 'compat-check');
  assert.equal(apply.code, 0, apply.out);
  assert.doesNotMatch(apply.out, CONFIG_WARNING);
  assert.match(apply.out, /tdd-from-scenarios/, 'operations.apply.guidance from the template should be injected');
});
