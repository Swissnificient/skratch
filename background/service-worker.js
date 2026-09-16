const JOB = 'enrichmentJob';
const TAB = 'enrichmentTab';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.action !== 'startEnrichment') return;
  startEnrichment(message.leads).then(() => sendResponse({ started: true }));
  return true;
});

async function startEnrichment(leads) {
  const job = { leads, index: 0, done: 0, failed: 0, running: true };
  await chrome.storage.local.set({ [JOB]: job });
  await chrome.notifications.create({
    type: 'basic', iconUrl: 'icon128.png', title: 'Skratch',
    message: `Enrichment started for ${leads.length} leads.`
  }).catch(() => {});
  void runJob();
}

async function runJob() {
  const { [JOB]: job } = await chrome.storage.local.get(JOB);
  if (!job?.running) return;

  for (; job.index < job.leads.length; job.index++) {
    const lead = job.leads[job.index];
    try {
      const tabId = await getTab();
      await chrome.tabs.update(tabId, { url: lead.mapsUrl, active: false });
      await waitForLoad(tabId);
      await wait(1200);

      const details = await chrome.tabs.sendMessage(tabId, { action: 'businessDetails' });
      const emails = details.website ? await findEmails(details.website) : [];
      job.leads[job.index] = {
        ...lead,
        ...details,
        email: emails[0] || lead.email || '',
        emails,
        source: 'google-maps'
      };
      job.done++;
      await updateStoredLead(job.leads[job.index]);
    } catch {
      job.failed++;
    }

    await chrome.storage.local.set({ [JOB]: job });
  }

  await finish(job);
}

async function updateStoredLead(lead) {
  const { leads = [] } = await chrome.storage.local.get('leads');
  const key = lead.mapsUrl || lead.email;
  const index = leads.findIndex(item => (item.mapsUrl || item.email) === key);
  if (index >= 0) leads[index] = { ...leads[index], ...lead };
  else leads.push(lead);
  await chrome.storage.local.set({ leads });
}

async function getTab() {
  const { [TAB]: tabId } = await chrome.storage.local.get(TAB);
  if (tabId) {
    try { await chrome.tabs.get(tabId); return tabId; } catch {}
  }
  const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
  await chrome.storage.local.set({ [TAB]: tab.id });
  return tab.id;
}

function waitForLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Page load timed out.'));
    }, 15000);
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function findEmails(website) {
  const urls = [website, ...['/contact', '/contact-us', '/about', '/about-us'].map(p => {
    try { return new URL(p, website).href; } catch { return null; }
  }).filter(Boolean)];
  const found = new Set();
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) continue;
      const html = await response.text();
      (html.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || []).forEach(e => found.add(e.toLowerCase()));
      if (found.size) break;
    } catch {}
  }
  return [...found];
}

async function finish(job) {
  if (!job) return;
  job.running = false;
  await chrome.storage.local.set({ [JOB]: job });
  await chrome.notifications.create({
    type: 'basic', iconUrl: 'icon128.png', title: 'Skratch',
    message: `Enrichment complete: ${job.done}/${job.leads.length} leads enriched.`
  }).catch(() => {});
}
