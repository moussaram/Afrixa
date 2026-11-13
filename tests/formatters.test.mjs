import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber } from '../src/lib/formatters.ts';

test('formatNumber preserves small values and abbreviates thousands', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1000), '1K');
  assert.equal(formatNumber(1250), '1.3K');
});

test('formatNumber abbreviates millions without redundant decimals', () => {
  assert.equal(formatNumber(1_000_000), '1M');
  assert.equal(formatNumber(1_250_000), '1.3M');
});
