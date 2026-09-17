import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCSV, csvCell } from '../utils/csv.js';

test('escapes embedded quotes', () => {
  assert.equal(csvCell('ACME "North"'), '"ACME ""North"""');
});

test('neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('=HYPERLINK("https://example.com")'), '"\'=HYPERLINK(""https://example.com"")"');
});

test('builds a CSV with stable columns', () => {
  const csv = buildCSV([{ name: 'Acme', email: 'hello@example.com' }]);
  assert.match(csv, /^name,email,website,mapsUrl,source\r\n/);
  assert.match(csv, /"Acme","hello@example.com"/);
});
