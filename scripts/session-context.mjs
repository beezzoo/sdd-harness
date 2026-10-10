#!/usr/bin/env node
// SessionStart hook: tells Claude which OpenSpec changes are in flight, so a
// fresh, resumed or compacted session picks the work back up. Silent when the
// project has no openspec/ directory.
import { readStdinJson, projectDir, openspecDir, activeChanges, specCount } from './lib.mjs';

try {
  const input = readStdinJson();
  const osDir = openspecDir(projectDir(input));
  if (!osDir) process.exit(0);

  const changes = activeChanges(osDir);
  const specs = specCount(osDir);
  const lines = [`[sdd-harness] OpenSpec project: ${specs} capability spec(s) in openspec/specs/.`];

  if (changes.length === 0) {
    lines.push('No active change. Classify new work with the sdd-workflow skill; standard+ changes start with /opsx:propose.');
  } else {
    lines.push('Active changes:');
    for (const c of changes) {
      const p = c.progress;
      const status = !p ? 'no tasks.md yet' : p.total === 0 ? 'tasks.md has no tasks' : `${p.done}/${p.total} tasks done`;
      lines.push(`- ${c.name}: ${status}`);
    }
    lines.push('Continue with /opsx:apply <change>; run /sdd-verify before /opsx:archive.');
  }
  process.stdout.write(lines.join('\n') + '\n');
} catch {
  // never block a session start
}
process.exit(0);
