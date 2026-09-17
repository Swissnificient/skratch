import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLeadCollections, normalizeEmail } from '../utils/leads.js';

test('normalizes email addresses', () => {
  assert.equal(normalizeEmail(' Sales@Example.COM '), 'sales@example.com');
});

test('re-scraping a map lead preserves enriched fields', () => {
  const current = [{
    id: 'lead-1',
    name: 'Acme Ltd',
    mapsUrl: 'https://google.com/maps/place/acme',
    website: 'https://acme.example/',
    email: 'hello@acme.example'
  }];

  const merged = mergeLeadCollections(current, [{
    name: 'Acme Ltd',
    mapsUrl: 'https://google.com/maps/place/acme',
    source: 'google-maps'
  }], () => 'new-id');

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'lead-1');
  assert.equal(merged[0].email, 'hello@acme.example');
  assert.equal(merged[0].website, 'https://acme.example/');
});

test('new leads receive stable ids', () => {
  const merged = mergeLeadCollections([], [{ email: 'hello@example.com' }], () => 'lead-42');
  assert.equal(merged[0].id, 'lead-42');
});

test('array fields are merged without duplicates', () => {
  const merged = mergeLeadCollections(
    [{ id: '1', mapsUrl: 'https://google.com/maps/place/a', emails: ['one@example.com'] }],
    [{ mapsUrl: 'https://google.com/maps/place/a', emails: ['one@example.com', 'two@example.com'] }],
    () => 'new'
  );
  assert.deepEqual(merged[0].emails, ['one@example.com', 'two@example.com']);
});
