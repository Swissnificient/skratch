const KEY = 'leads';

export async function getLeads() {
  const { [KEY]: leads = [] } = await chrome.storage.local.get(KEY);
  return leads;
}

export async function saveLeads(leads) {
  await chrome.storage.local.set({ [KEY]: leads });
}

export async function mergeLeads(leads) {
  const current = await getLeads();
  const merged = [...new Map(
    [...current, ...leads].map(lead => [lead.email || lead.mapsUrl, lead])
  ).values()];
  await saveLeads(merged);
  return merged;
}

export async function clearLeads() {
  await saveLeads([]);
}
