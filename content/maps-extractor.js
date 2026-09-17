const MAPS = Object.freeze({
  feed: ['div[role="feed"]', 'div[aria-label][role="main"] div[role="feed"]'],
  places: [
    'a.hfpxzc[href]',
    'a[href*="/maps/place/"][aria-label]',
    'a[href*="/maps/place/"]'
  ],
  website: [
    'a[data-item-id="authority"][href]',
    'a[aria-label^="Website:"][href]',
    'a[href][data-value="Website"]'
  ],
  name: ['h1.DUwDvf', 'h1.fontHeadlineLarge', 'h1']
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function loadMapResults({ maxResults = 250, maxDurationMs = 30_000 } = {}) {
  const feed = firstMatch(MAPS.feed);
  if (!feed) throw new Error('Open a Google Maps search results page before scraping.');

  const deadline = Date.now() + maxDurationMs;
  let previousCount = countPlaces(feed);
  let stableRounds = 0;

  while (previousCount < maxResults && stableRounds < 4 && Date.now() < deadline) {
    feed.scrollTop = feed.scrollHeight;
    clickLoadMore();
    await waitForResultGrowth(feed, previousCount, 1_500);

    const nextCount = countPlaces(feed);
    stableRounds = nextCount > previousCount ? 0 : stableRounds + 1;
    previousCount = nextCount;
  }

  return {
    count: Math.min(previousCount, maxResults),
    truncated: previousCount >= maxResults || Date.now() >= deadline
  };
}

function extractMapResults(maxResults = 250) {
  const feed = firstMatch(MAPS.feed);
  if (!feed) return [];

  const seen = new Set();
  const leads = [];

  for (const link of allMatches(feed, MAPS.places)) {
    const mapsUrl = normalizeGoogleMapsUrl(link.href);
    const name = extractPlaceName(link);
    if (!name || !mapsUrl || seen.has(mapsUrl)) continue;

    seen.add(mapsUrl);
    leads.push({ name, mapsUrl });
    if (leads.length >= maxResults) break;
  }

  return leads;
}

async function extractBusinessDetails() {
  const name = textFromFirst(MAPS.name);
  const websiteNode = firstMatch(MAPS.website);
  const website = normalizeHttpUrl(websiteNode?.href || '');
  return { name, website, mapsUrl: location.href };
}

function countPlaces(feed) {
  return allMatches(feed, MAPS.places).length;
}

function clickLoadMore() {
  for (const button of document.querySelectorAll('button')) {
    const text = button.textContent?.trim().toLowerCase() || '';
    const label = button.getAttribute('aria-label')?.trim().toLowerCase() || '';
    if (text.includes('load more') || label.includes('load more') || label.includes('more results')) {
      button.click();
      return true;
    }
  }
  return false;
}

function waitForResultGrowth(feed, previousCount, timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const finish = grew => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      observer.disconnect();
      resolve(grew);
    };

    const observer = new MutationObserver(() => {
      if (countPlaces(feed) > previousCount) finish(true);
    });

    const timeout = setTimeout(() => finish(false), timeoutMs);
    observer.observe(feed, { childList: true, subtree: true });
  });
}

function firstMatch(selectors, root = document) {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function allMatches(root, selectors) {
  const seen = new Set();
  const nodes = [];
  for (const selector of selectors) {
    for (const node of root.querySelectorAll(selector)) {
      if (seen.has(node)) continue;
      seen.add(node);
      nodes.push(node);
    }
  }
  return nodes;
}

function textFromFirst(selectors) {
  return firstMatch(selectors)?.textContent?.trim() || '';
}

function extractPlaceName(link) {
  const aria = link.getAttribute('aria-label')?.trim();
  if (aria) return aria;

  const text = link.textContent?.trim();
  if (text) return text;

  return link.querySelector('[aria-label]')?.getAttribute('aria-label')?.trim() || '';
}

function normalizeGoogleMapsUrl(value) {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return '';

  try {
    const url = new URL(normalized);
    if (!/(^|\.)google\.[a-z.]+$/i.test(url.hostname) || !url.pathname.includes('/maps')) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
