import { getLeads } from '../utils/storage.js';
import { exportCSV } from '../utils/csv.js';

const $ = id => document.getElementById(id);

function render(leads) {
  const results = $('results');
  results.replaceChildren();

  if (!leads.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No saved leads yet.';
    results.appendChild(empty);
    return;
  }

  for (const lead of leads) {
    const item = document.createElement('article');
    item.className = 'lead';

    const name = document.createElement('strong');
    name.textContent = lead.name || 'Unnamed lead';
    item.appendChild(name);

    const email = document.createElement('span');
    email.textContent = lead.email || 'No email found';
    item.appendChild(email);

    if (lead.website) {
      const website = document.createElement('span');
      website.className = 'muted';
      website.textContent = lead.website;
      item.appendChild(website);
    }

    results.appendChild(item);
  }
}

function renderJob(job) {
  const running = Boolean(job?.running);
  $('cancel').hidden = !running;
  $('maps').disabled = running;

  if (running) {
    $('status').textContent = `Enriching ${Math.min(job.index + 1, job.leads.length)} of ${job.leads.length}. ${job.failed} failed.`;
  } else if (job?.status === 'completed') {
    $('status').textContent = `Enrichment complete. ${job.done} processed, ${job.failed} failed.`;
  } else if (job?.status === 'cancelled') {
    $('status').textContent = 'Enrichment cancelled.';
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active browser tab is available.');
  return tab;
}

async function sendToActiveTab(message) {
  const tab = await activeTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    throw new Error('Skratch cannot access this page. Open a regular website tab and try again.');
  }
}

async function sendToBackground(action, payload = {}) {
  const response = await chrome.runtime.sendMessage({ action, ...payload });
  if (!response?.ok) throw new Error(response?.error || 'Background operation failed.');
  return response.data;
}

async function refresh() {
  const [{ enrichmentJob }, leads] = await Promise.all([
    chrome.storage.local.get('enrichmentJob'),
    getLeads()
  ]);
  render(leads);
  renderJob(enrichmentJob);
}

$('page').addEventListener('click', async () => {
  try {
    $('status').textContent = 'Scanning page…';
    const response = await sendToActiveTab({ action: 'scrapeEmails' });
    if (response?.error) throw new Error(response.error);
    const emails = response?.emails || [];
    const leads = await sendToBackground('mergeLeads', {
      leads: emails.map(email => ({ email, source: 'webpage' }))
    });
    render(leads);
    $('status').textContent = `${emails.length} email${emails.length === 1 ? '' : 's'} found.`;
  } catch (error) {
    $('status').textContent = error.message;
  }
});

$('maps').addEventListener('click', async () => {
  try {
    $('maps').disabled = true;
    $('status').textContent = 'Loading available Google Maps results…';
    const response = await sendToActiveTab({ action: 'scrapeMaps' });
    if (response?.error) throw new Error(response.error);
    if (!response?.leads?.length) throw new Error('No Google Maps businesses were found on this page.');

    const result = await sendToBackground('startEnrichment', { leads: response.leads });
    render(result.leads);
    renderJob(result.job);
  } catch (error) {
    $('status').textContent = error.message;
    $('maps').disabled = false;
  }
});

$('cancel').addEventListener('click', async () => {
  try {
    const job = await sendToBackground('cancelEnrichment');
    renderJob(job);
  } catch (error) {
    $('status').textContent = error.message;
  }
});

$('export').addEventListener('click', async () => {
  const leads = await getLeads();
  if (!leads.length) {
    $('status').textContent = 'There are no leads to export.';
    return;
  }
  exportCSV(leads);
  $('status').textContent = `${leads.length} leads exported.`;
});

$('clear').addEventListener('click', async () => {
  try {
    await sendToBackground('clearData');
    render([]);
    $('cancel').hidden = true;
    $('maps').disabled = false;
    $('status').textContent = 'Saved leads and enrichment state cleared.';
  } catch (error) {
    $('status').textContent = error.message;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.leads?.newValue) render(changes.leads.newValue);
  if (changes.enrichmentJob) renderJob(changes.enrichmentJob.newValue);
});

void refresh().catch(error => {
  $('status').textContent = error.message;
});
