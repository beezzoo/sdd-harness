import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newestSemverTag } from '../scripts/upstream-check.mjs';

test('newestSemverTag picks the highest release and ignores pre-releases', () => {
  assert.equal(newestSemverTag(['v1.9.0', 'v1.10.0', 'v1.2.3', 'v2.0.0-beta.1', 'nightly']), 'v1.10.0');
  assert.equal(newestSemverTag(['1.0.0', 'v1.0.1']), 'v1.0.1');
  assert.equal(newestSemverTag(['latest']), null);
});
