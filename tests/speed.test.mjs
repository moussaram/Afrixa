import test from 'node:test';
import assert from 'node:assert/strict';
import { speeds, getSpeedMultiplier } from '../src/components/create/speed.ts';

test('speed selector exposes the supported playback rates', () => {
  assert.deepEqual(speeds, ['0.3x', '0.5x', '1x', '2x', '3x']);
});

test('speed values map to their numeric multipliers', () => {
  assert.equal(getSpeedMultiplier('0.3x'), 0.3);
  assert.equal(getSpeedMultiplier('0.5x'), 0.5);
  assert.equal(getSpeedMultiplier('1x'), 1);
  assert.equal(getSpeedMultiplier('2x'), 2);
  assert.equal(getSpeedMultiplier('3x'), 3);
});
