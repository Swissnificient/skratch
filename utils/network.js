const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function normalizePublicHttpUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (isNonPublicHostname(url.hostname)) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function isNonPublicHostname(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return true;

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }

  if (host.includes(':')) return isNonPublicIpv6(host);

  const octets = parseIpv4(host);
  if (!octets) return false;
  const [a, b] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && octets[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    a >= 224
  );
}

export async function fetchPublicUrl(value, {
  timeoutMs = 5_000,
  maxRedirects = 5,
  fetchImpl = fetch
} = {}) {
  let current = normalizePublicHttpUrl(value);
  if (!current) throw new Error('URL is not a public HTTP(S) destination.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out.', 'TimeoutError')), timeoutMs);

  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      const response = await fetchImpl(current, {
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });

      if (!REDIRECT_STATUSES.has(response.status)) return response;

      const location = response.headers.get('location');
      if (!location) return response;
      if (redirects === maxRedirects) throw new Error('Redirect limit exceeded.');

      const next = normalizePublicHttpUrl(new URL(location, current).href);
      if (!next) {
        await response.body?.cancel().catch(() => {});
        throw new Error('Redirect target is not a public HTTP(S) destination.');
      }

      await response.body?.cancel().catch(() => {});
      current = next;
    }

    throw new Error('Redirect limit exceeded.');
  } finally {
    clearTimeout(timeout);
  }
}

function parseIpv4(host) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const octets = host.split('.').map(Number);
  return octets.every(part => part >= 0 && part <= 255) ? octets : null;
}

function isNonPublicIpv6(host) {
  if (host === '::' || host === '::1') return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(host)) return true;
  if (host.startsWith('ff')) return true;
  if (host.startsWith('2001:db8:')) return true;
  if (host.startsWith('::ffff:')) return true;
  return false;
}
