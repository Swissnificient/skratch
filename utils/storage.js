import { mergeLead, mergeLeadCollections } from './leads.js';

const KEY = 'leads';
const MAX_LEADS = 10_000;

export async function getLeads() {
  const { [KEY]: leads = [] } = await chrome.storage.local.get(KEY);
  return Array.isArray(leads) ? leads : [];
}

export async function saveLeads(leads) {
  if (!Array.isArray(leads)) throw new TypeError('Leads must be an array.');
  if (leads.length > MAX_LEADS) throw new Error(`Lead storage limit reached (${MAX_LEADS}). Export or clear saved leads.`);
  await chrome.storage.local.set({ [KEY]: leads });
  return leads;
}

export async function mergeLeads(incoming) {
  if (!Array.isArray(incoming)) throw new TypeError('Incoming leads must be an array.');
  const current = await getLeads();
  const merged = mergeLeadCollections(current, incoming, () => crypto.randomUUID());
  return saveLeads(merged);
}

export async function updateLead(id, patch) {
  if (!id) throw new Error('A lead id is required.');
  const leads = await getLeads();
  const index = leads.findIndex(lead => lead.id === id);
  if (index === -1) return mergeLeads([{ ...patch, id }]);
  leads[index] = mergeLead(leads[index], { ...patch, id });
  return saveLeads(leads);
}

export async function clearLeads() {
  await chrome.storage.local.set({ [KEY]: [] });
}
