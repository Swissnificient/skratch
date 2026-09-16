import { getLeads, mergeLeads, clearLeads } from '../utils/storage.js';
import { exportCSV } from '../utils/csv.js';

const $ = id => document.getElementById(id);
const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

function render(leads) {
  $('results').innerHTML = leads.map(lead =>
    `<div><strong>${escapeHTML(lead.name || 'Unnamed')}</strong><br>${escapeHTML(lead.email || 'No email')}</div>`
  ).join('');
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

$('page').onclick = async () => {
  try {
    $('status').textContent = 'Scanning…';
    const tab = await activeTab();
    const { emails = [] } = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeEmails' });
    render(await mergeLeads(emails.map(email => ({ email, source: 'webpage' }))));
    $('status').textContent = `${emails.length} email(s) found.`;
  } catch (e) { $('status').textContent = e.message; }
};

$('maps').onclick = async () => {
  try {
    $('status').textContent = 'Scanning all available Maps results…';
    const tab = await activeTab();
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeMaps' });
    if (response.error) throw new Error(response.error);
    const leads = await mergeLeads(response.leads.map(lead => ({ ...lead, source: 'google-maps' })));
    render(leads);
    chrome.runtime.sendMessage({ action: 'startEnrichment', leads: response.leads });
    $('status').textContent = `${response.leads.length} businesses found. Enrichment running in background.`;
  } catch (e) { $('status').textContent = e.message; }
};

$('export').onclick = async () => exportCSV(await getLeads());
$('clear').onclick = async () => { await clearLeads(); render([]); $('status').textContent = 'Cleared.'; };
getLeads().then(render);
chrome.storage.local.get('enrichmentJob').then(({ enrichmentJob }) => {
  if (enrichmentJob?.running) $('status').textContent = `Enriching ${enrichmentJob.index}/${enrichmentJob.leads.length}…`;
});
