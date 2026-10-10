// Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

function run(script, input, env = {}) {
  const res = spawnSync(process.execPath, [path.join(scripts, script)], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: '', SDD_GUARD: '', ...env },
  });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

function project({ openspec = true, changes = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-harness-test-'));
  if (openspec) {
    fs.mkdirSync(path.join(root, 'openspec', 'specs', 'billing'), { recursive: true });
    fs.writeFileSync(path.join(root, 'openspec', 'specs', 'billing', 'spec.md'), '# billing\n');
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'archive', 'old-change'), { recursive: true });
    for (const [name, tasks] of Object.entries(changes)) {
      const dir = path.join(root, 'openspec', 'changes', name);
      fs.mkdirSync(dir, { recursive: true });
      if (tasks !== null) fs.writeFileSync(path.join(dir, 'tasks.md'), tasks);
    }
  }
  return root;
}

const sessions = [];
const uniqueSession = () => {
  const id = `test-${process.pid}-${Math.random().toString(36).slice(2)}`;
  sessions.push(id);
  return id;
};
after(() => {
  for (const id of sessions) fs.rmSync(path.join(os.tmpdir(), 'sdd-harness', `${id}.nudged`), { force: true });
});
const isDeny = (out) => out.trim() !== '' && JSON.parse(out).hookSpecificOutput.permissionDecision === 'deny';

test('session-context is silent without openspec', () => {
  const r = run('session-context.mjs', { cwd: project({ openspec: false }) });
  assert.equal(r.code, 0);
  assert.equal(r.out, '');
});

test('session-context reports specs and no active change', () => {
  const r = run('session-context.mjs', { cwd: project() });
  assert.equal(r.code, 0);
  assert.match(r.out, /1 capability spec/);
  assert.match(r.out, /No active change/);
});

test('session-context lists active changes with task progress, skipping archive', () => {
  const tasks = '## 1. A\n- [x] 1.1 done\n- [ X ] 1.2 done too\n- [ ] 1.3 open\n- [~] 1.4 not done\n';
  const r = run('session-context.mjs', { cwd: project({ changes: { 'add-export': tasks, 'fresh-idea': null } }) });
  assert.match(r.out, /add-export: 2\/4 tasks done/);
  assert.match(r.out, /fresh-idea: no tasks\.md yet/);
  assert.doesNotMatch(r.out, /old-change/);
});

test('session-context prefers CLAUDE_PROJECT_DIR over cwd', () => {
  const r = run('session-context.mjs', { cwd: project({ openspec: false }) }, { CLAUDE_PROJECT_DIR: project() });
  assert.match(r.out, /OpenSpec project/);
});

test('guard allows when project has no openspec', () => {
  const root = project({ openspec: false });
  const r = run('change-guard.mjs', { cwd: root, session_id: uniqueSession(), tool_input: { file_path: path.join(root, 'src/a.ts') } });
  assert.equal(r.code, 0);
  assert.equal(r.out, '');
});

test('guard allows when an active change exists', () => {
  const root = project({ changes: { 'add-export': '- [ ] 1.1 x\n' } });
  const r = run('change-guard.mjs', { cwd: root, session_id: uniqueSession(), tool_input: { file_path: 'src/a.ts' } });
  assert.equal(r.out, '');
});

test('guard exempts openspec/, .claude/, markdown and files outside the project', () => {
  const root = project();
  for (const file of ['openspec/changes/x/proposal.md', '.claude/settings.json', 'README.md', '/etc/hosts', '../elsewhere.ts']) {
    const r = run('change-guard.mjs', { cwd: root, session_id: uniqueSession(), tool_input: { file_path: file } });
    assert.equal(r.out, '', `expected ${file} to be exempt`);
  }
});

test('guard nudge mode denies the first source edit, then allows', () => {
  const root = project();
  const session = uniqueSession();
  const input = { cwd: root, session_id: session, tool_input: { file_path: path.join(root, 'src/a.ts') } };
  const first = run('change-guard.mjs', input);
  assert.equal(first.code, 0);
  assert.ok(isDeny(first.out));
  assert.match(JSON.parse(first.out).hookSpecificOutput.permissionDecisionReason, /src[\\/]a\.ts/);
  const second = run('change-guard.mjs', input);
  assert.equal(second.out, '');
});

test('guard strict mode keeps denying', () => {
  const root = project();
  const input = { cwd: root, session_id: uniqueSession(), tool_input: { file_path: 'src/a.ts' } };
  assert.ok(isDeny(run('change-guard.mjs', input, { SDD_GUARD: 'strict' }).out));
  assert.ok(isDeny(run('change-guard.mjs', input, { SDD_GUARD: 'strict' }).out));
});

test('guard off mode allows everything', () => {
  const r = run('change-guard.mjs', { cwd: project(), session_id: uniqueSession(), tool_input: { file_path: 'src/a.ts' } }, { SDD_GUARD: 'off' });
  assert.equal(r.out, '');
});

test('guard handles notebook_path and malformed input without blocking', () => {
  const root = project();
  assert.ok(isDeny(run('change-guard.mjs', { cwd: root, session_id: uniqueSession(), tool_input: { notebook_path: 'nb/a.ipynb' } }).out));
  const res = spawnSync(process.execPath, [path.join(scripts, 'change-guard.mjs')], { input: 'not json', encoding: 'utf8' });
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
});
