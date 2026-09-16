const MAPS = {
  feed: 'div[role="feed"]',
  places: 'a.hfpxzc',
  website: 'a[data-item-id="authority"]'
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function loadMapResults(maxRounds = 40) {
  const feed = document.querySelector(MAPS.feed);
  if (!feed) throw new Error('Google Maps results feed not found.');

  let previous = 0;
  let stable = 0;

  for (let i = 0; i < maxRounds && stable < 4; i++) {
    feed.scrollTop = feed.scrollHeight;
    document.querySelectorAll('button').forEach(button => {
      const text = button.textContent?.trim().toLowerCase();
      const label = button.getAttribute('aria-label')?.toLowerCase() || '';
      if (text?.includes('load more') || label.includes('load more')) button.click();
    });
    await wait(1000);

    const count = feed.querySelectorAll(MAPS.places).length;
    stable = count === previous ? stable + 1 : 0;
    previous = count;
  }
}

function extractMapResults() {
  const seen = new Set();
  return [...document.querySelectorAll(MAPS.places)]
    .map(link => ({
      name: link.getAttribute('aria-label')?.trim(),
      mapsUrl: link.href
    }))
    .filter(lead => {
      if (!lead.name || !lead.mapsUrl || seen.has(lead.mapsUrl)) return false;
      seen.add(lead.mapsUrl);
      return true;
    });
}

async function extractBusinessDetails() {
  const name = document.querySelector('h1')?.textContent?.trim() || '';
  const website = document.querySelector(MAPS.website)?.href || '';
  return { name, website, mapsUrl: location.href };
}
