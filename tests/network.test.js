import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicUrl, isNonPublicHostname, normalizePublicHttpUrl } from '../utils/network.js';

test('rejects local and reserved destinations', () => {
  for (const host of [
    'localhost', '127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.1.1',
    '172.16.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1'
  ]) {
    assert.equal(isNonPublicHostname(host), true, host);
  }
});

test('accepts normal public hostnames', () => {
  assert.equal(normalizePublicHttpUrl('https://example.com/contact'), 'https://example.com/contact');
});

test('blocks a redirect to a private destination before following it', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    return new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/admin' }
    });
  };

  await assert.rejects(
    fetchPublicUrl('https://example.com', { fetchImpl }),
    /Redirect target is not a public/
  );
  assert.deepEqual(calls, ['https://example.com/']);
});

test('follows validated public redirects', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (calls.length === 1) {
      return new Response(null, { status: 302, headers: { location: '/contact' } });
    }
    return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
  };

  const response = await fetchPublicUrl('https://example.com', { fetchImpl });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['https://example.com/', 'https://example.com/contact']);
});
