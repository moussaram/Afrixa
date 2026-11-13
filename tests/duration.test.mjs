import test from 'node:test';
import assert from 'node:assert/strict';
import { durationTabs, getDurationSeconds } from '../src/components/create/duration.ts';

test('duration tabs expose the supported capture modes', () => {
  assert.deepEqual(durationTabs.map(({ id }) => id), ['15s', '60s', '3min', '10min', 'photo']);
});

test('duration modes map to their exact number of seconds', () => {
  assert.equal(getDurationSeconds('15s'), 15);
  assert.equal(getDurationSeconds('60s'), 60);
  assert.equal(getDurationSeconds('3min'), 180);
  assert.equal(getDurationSeconds('10min'), 600);
  assert.equal(getDurationSeconds('photo'), 0);
});
