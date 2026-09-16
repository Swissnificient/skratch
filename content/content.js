chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  (async () => {
    if (message.action === 'scrapeEmails') {
      sendResponse({ emails: extractEmails() });
      return;
    }

    if (message.action === 'scrapeMaps') {
      await loadMapResults();
      sendResponse({ leads: extractMapResults() });
      return;
    }

    if (message.action === 'businessDetails') {
      sendResponse(await extractBusinessDetails());
    }
  })().catch(error => sendResponse({ error: error.message }));

  return true;
});
