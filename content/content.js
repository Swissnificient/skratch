const CONTENT_ACTIONS = new Set(['scrapeEmails', 'scrapeMaps', 'businessDetails']);

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (!CONTENT_ACTIONS.has(message?.action)) return false;

  void handleContentMessage(message)
    .then(sendResponse)
    .catch(error => sendResponse({ error: error instanceof Error ? error.message : String(error) }));

  return true;
});

async function handleContentMessage(message) {
  if (message.action === 'scrapeEmails') {
    return { emails: extractEmails() };
  }

  if (message.action === 'scrapeMaps') {
    const options = { maxResults: 250, maxDurationMs: 30_000 };
    const pagination = await loadMapResults(options);
    return { leads: extractMapResults(options.maxResults), pagination };
  }

  if (message.action === 'businessDetails') {
    return extractBusinessDetails();
  }

  throw new Error('Unsupported content action.');
}
