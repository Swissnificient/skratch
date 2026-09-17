import { clearLeads, getLeads, mergeLeads, updateLead } from '../utils/storage.js';
import { fetchPublicUrl, normalizePublicHttpUrl } from '../utils/network.js';
import { createLogger } from '../utils/logger.js';

const JOB_KEY = 'enrichmentJob';
const TAB_KEY = 'enrichmentTab';
const WATCHDOG = 'enrichmentWatchdog';
const MAX_JOB_LEADS = 500;
const FETCH_TIMEOUT_MS = 5_000;
const FETCH_RETRIES = 2;
const MAX_RESPONSE_BYTES = 2_000_000;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

let storageQueue = Promise.resolve();
let processingLead = false;
const log = createLogger('background');

void restrictStorageAccess();

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (!isBackgroundAction(message?.action)) return false;

  void handleMessage(message)
    .then(data => sendResponse({ ok: true, data }))
    .catch(error => {
      log.error('message_failed', { action: message?.action, error });
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') void processLoadedEnrichmentTab(tabId);
});

chrome.tabs.onRemoved.addListener(tabId => {
  void clearTrackedTabIfRemoved(tabId);
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === WATCHDOG) void resumeJob();
});

chrome.runtime.onStartup.addListener(() => void resumeJob());
chrome.runtime.onInstalled.addListener(() => void migrateState());

function isBackgroundAction(action) {
  return new Set(['mergeLeads', 'startEnrichment', 'cancelEnrichment', 'clearData']).has(action);
}

async function handleMessage(message) {
  if (message.action === 'mergeLeads') {
    return withStorageLock(() => mergeLeads(message.leads || []));
  }

  if (message.action === 'startEnrichment') {
    return startEnrichment(message.leads || []);
  }

  if (message.action === 'cancelEnrichment') {
    return cancelEnrichment('Cancelled by user.');
  }

  if (message.action === 'clearData') {
    await cancelEnrichment('Cleared by user.', { removeJob: true });
    await withStorageLock(() => clearLeads());
    return [];
  }

  throw new Error('Unsupported background action.');
}

async function startEnrichment(rawLeads) {
  if (!Array.isArray(rawLeads)) throw new TypeError('Leads must be an array.');
  const candidates = rawLeads.filter(lead => isGoogleMapsUrl(lead?.mapsUrl)).slice(0, MAX_JOB_LEADS);
  if (!candidates.length) throw new Error('No valid Google Maps leads were found.');

  const existing = await getJob();
  if (existing?.running) throw new Error('An enrichment job is already running.');

  const storedLeads = await withStorageLock(() => mergeLeads(
    candidates.map(lead => ({ ...lead, source: 'google-maps', enrichmentStatus: 'queued' }))
  ));

  const candidateUrls = new Set(candidates.map(lead => lead.mapsUrl));
  const jobLeads = storedLeads
    .filter(lead => lead.id && candidateUrls.has(lead.mapsUrl))
    .map(lead => ({ id: lead.id, mapsUrl: lead.mapsUrl, name: lead.name || '' }));

  const now = new Date().toISOString();
  const job = {
    id: crypto.randomUUID(),
    leads: jobLeads,
    index: 0,
    done: 0,
    failed: 0,
    running: true,
    status: 'running',
    startedAt: now,
    updatedAt: now,
    lastError: null
  };

  await setJob(job);
  await chrome.alarms.create(WATCHDOG, { delayInMinutes: 0.5, periodInMinutes: 0.5 });
  log.info('job_started', { jobId: job.id, leadCount: jobLeads.length });
  await notify(`Enrichment started for ${jobLeads.length} leads.`);
  await navigateToCurrentLead(job);

  return { job, leads: storedLeads };
}

async function navigateToCurrentLead(job = null) {
  job ||= await getJob();
  if (!job?.running) return;
  if (job.index >= job.leads.length) {
    await finishJob(job.id);
    return;
  }

  const lead = job.leads[job.index];
  const tabId = await ensureEnrichmentTab();
  await chrome.tabs.update(tabId, { url: lead.mapsUrl, active: false });
}

async function processLoadedEnrichmentTab(tabId) {
  if (processingLead) return;

  const [{ [TAB_KEY]: trackedTabId }, job] = await Promise.all([
    chrome.storage.local.get(TAB_KEY),
    getJob()
  ]);

  if (!job?.running || trackedTabId !== tabId || job.index >= job.leads.length) return;

  processingLead = true;
  const jobId = job.id;
  const expectedIndex = job.index;
  const lead = job.leads[expectedIndex];

  try {
    log.debug('lead_started', { jobId, leadId: lead.id, index: expectedIndex });
    const details = await readBusinessDetails(tabId);
    const emails = details.website ? await findEmails(details.website) : [];
    const patch = {
      ...details,
      mapsUrl: lead.mapsUrl,
      resolvedMapsUrl: details.mapsUrl || lead.mapsUrl,
      email: emails[0] || '',
      emails,
      source: 'google-maps',
      enrichmentStatus: 'completed',
      enrichmentError: null
    };

    await withStorageLock(() => updateLead(lead.id, patch));
    const advanced = await advanceJob(jobId, expectedIndex, current => ({
      ...current,
      index: current.index + 1,
      done: current.done + 1,
      updatedAt: new Date().toISOString(),
      lastError: null
    }));

    log.info('lead_completed', { jobId, leadId: lead.id, index: expectedIndex, emailCount: emails.length, hasWebsite: Boolean(details.website) });
    if (advanced) await navigateToCurrentLead(advanced);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn('lead_failed', { jobId, leadId: lead.id, index: expectedIndex, error });

    await withStorageLock(() => updateLead(lead.id, {
      enrichmentStatus: 'failed',
      enrichmentError: message
    }));

    const advanced = await advanceJob(jobId, expectedIndex, current => ({
      ...current,
      index: current.index + 1,
      failed: current.failed + 1,
      updatedAt: new Date().toISOString(),
      lastError: message
    }));

    if (advanced) await navigateToCurrentLead(advanced);
  } finally {
    processingLead = false;
  }
}

async function readBusinessDetails(tabId) {
  let lastError;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const details = await chrome.tabs.sendMessage(tabId, { action: 'businessDetails' });
      if (details?.error) throw new Error(details.error);
      if (details?.name || details?.website) return details;
      lastError = new Error('Business details were not ready.');
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }

  throw lastError || new Error('Unable to read Google Maps business details.');
}

async function findEmails(website) {
  const base = normalizePublicHttpUrl(website);
  if (!base) return [];

  const urls = [base, ...['/contact', '/contact-us', '/about', '/about-us'].map(path => new URL(path, base).href)];
  const found = new Set();

  for (const url of [...new Set(urls)]) {
    try {
      const response = await fetchWithRetry(url, FETCH_RETRIES);
      if (!response.ok || !isReadableContentType(response.headers.get('content-type'))) continue;
      const html = await readTextLimited(response, MAX_RESPONSE_BYTES);
      for (const email of html.match(EMAIL_RE) || []) found.add(email.toLowerCase());
      if (found.size) break;
    } catch (error) {
      log.debug('email_lookup_skipped', { host: safeHost(url), error });
    }
  }

  return [...found];
}

async function fetchWithRetry(url, maxAttempts) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchPublicUrl(url, { timeoutMs: FETCH_TIMEOUT_MS });
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === maxAttempts) {
        return response;
      }
      await response.body?.cancel().catch(() => {});
      log.debug('fetch_retry_status', { attempt, status: response.status, host: safeHost(url) });
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
      log.debug('fetch_retry_error', { attempt, host: safeHost(url), error });
    }

    await wait(250 * attempt);
  }

  throw lastError || new Error('Website request failed.');
}

async function readTextLimited(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error('Response is too large to scan safely.');
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Response exceeded scan size limit.');
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

async function advanceJob(jobId, expectedIndex, updater) {
  return withStorageLock(async () => {
    const current = await getJob();
    if (!current?.running || current.id !== jobId || current.index !== expectedIndex) return null;

    const next = updater(current);
    await setJob(next);
    if (next.index >= next.leads.length) {
      await finishJob(next.id);
      return null;
    }
    return next;
  });
}

async function finishJob(jobId) {
  const job = await getJob();
  if (!job || job.id !== jobId) return;

  const finished = {
    ...job,
    running: false,
    status: 'completed',
    finishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setJob(finished);
  await chrome.alarms.clear(WATCHDOG);
  await closeEnrichmentTab();
  log.info('job_completed', { jobId: finished.id, processed: finished.done, failed: finished.failed });
  await notify(`Enrichment complete: ${finished.done} processed, ${finished.failed} failed.`);
}

async function cancelEnrichment(reason, { removeJob = false } = {}) {
  const job = await getJob();

  if (job && !removeJob) {
    await setJob({
      ...job,
      running: false,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      lastError: reason
    });
  } else if (removeJob) {
    await chrome.storage.local.remove(JOB_KEY);
  }

  await chrome.alarms.clear(WATCHDOG);
  await closeEnrichmentTab();
  if (job) log.info('job_cancelled', { jobId: job.id, reason });
  return job ? { ...job, running: false, status: 'cancelled' } : null;
}

async function resumeJob() {
  const job = await getJob();
  if (!job?.running) return;

  if (job.index >= job.leads.length) {
    await finishJob(job.id);
    return;
  }

  const tabId = await ensureEnrichmentTab();
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const targetUrl = job.leads[job.index].mapsUrl;

  if (!tab) {
    await navigateToCurrentLead(job);
  } else if (tab.status === 'complete' && isGoogleMapsUrl(tab.url)) {
    await processLoadedEnrichmentTab(tabId);
  } else if (tab.url !== targetUrl) {
    await chrome.tabs.update(tabId, { url: targetUrl, active: false });
  }
}

async function ensureEnrichmentTab() {
  const { [TAB_KEY]: savedTabId } = await chrome.storage.local.get(TAB_KEY);
  if (savedTabId) {
    const tab = await chrome.tabs.get(savedTabId).catch(() => null);
    if (tab) return savedTabId;
  }

  const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
  await chrome.storage.local.set({ [TAB_KEY]: tab.id });
  return tab.id;
}

async function closeEnrichmentTab() {
  const { [TAB_KEY]: tabId } = await chrome.storage.local.get(TAB_KEY);
  await chrome.storage.local.remove(TAB_KEY);
  if (tabId) await chrome.tabs.remove(tabId).catch(() => {});
}

async function clearTrackedTabIfRemoved(tabId) {
  const { [TAB_KEY]: trackedTabId } = await chrome.storage.local.get(TAB_KEY);
  if (trackedTabId === tabId) await chrome.storage.local.remove(TAB_KEY);
}

async function migrateState() {
  await restrictStorageAccess();
  await withStorageLock(() => mergeLeads([]));

  const job = await getJob();
  if (job && (!job.id || !Array.isArray(job.leads))) {
    await cancelEnrichment('Previous enrichment state was reset after an extension upgrade.', { removeJob: true });
  } else {
    await resumeJob();
  }
}

async function restrictStorageAccess() {
  if (!chrome.storage.local.setAccessLevel) return;
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
}

async function getJob() {
  const { [JOB_KEY]: job } = await chrome.storage.local.get(JOB_KEY);
  return job || null;
}

async function setJob(job) {
  await chrome.storage.local.set({ [JOB_KEY]: job });
}

function withStorageLock(task) {
  const run = storageQueue.then(task, task);
  storageQueue = run.catch(() => {});
  return run;
}

function isGoogleMapsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)google\.[a-z.]+$/i.test(url.hostname) && url.pathname.includes('/maps');
  } catch {
    return false;
  }
}

function isReadableContentType(contentType) {
  if (!contentType) return true;
  return /(?:text\/|application\/(?:xhtml\+xml|xml))/i.test(contentType);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

async function notify(message) {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'Skratch',
    message
  }).catch(() => {});
}
