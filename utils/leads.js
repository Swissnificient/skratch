const EMPTY_VALUES = new Set(['', undefined]);

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeLead(lead = {}) {
  const normalized = { ...lead };

  for (const key of ['id', 'name', 'website', 'mapsUrl', 'resolvedMapsUrl', 'source', 'enrichmentStatus', 'enrichmentError']) {
    if (typeof normalized[key] === 'string') normalized[key] = normalized[key].trim();
  }

  if ('email' in normalized) normalized.email = normalizeEmail(normalized.email);
  if (Array.isArray(normalized.emails)) {
    normalized.emails = [...new Set(normalized.emails.map(normalizeEmail).filter(Boolean))];
  }

  return normalized;
}

export function leadKey(lead = {}) {
  const normalized = normalizeLead(lead);
  if (normalized.id) return `id:${normalized.id}`;
  if (normalized.mapsUrl) return `maps:${normalized.mapsUrl}`;
  if (normalized.email) return `email:${normalized.email}`;
  if (normalized.website && normalized.name) return `site:${normalized.website}|${normalized.name.toLowerCase()}`;
  return '';
}

export function mergeLead(existing = {}, incoming = {}) {
  const left = normalizeLead(existing);
  const right = normalizeLead(incoming);
  const merged = { ...left };

  for (const [key, value] of Object.entries(right)) {
    if (Array.isArray(value)) {
      const previous = Array.isArray(merged[key]) ? merged[key] : [];
      merged[key] = [...new Set([...previous, ...value].filter(Boolean))];
      continue;
    }

    if (value === null) {
      merged[key] = null;
      continue;
    }

    if (!EMPTY_VALUES.has(value)) merged[key] = value;
  }

  return merged;
}

export function mergeLeadCollections(current = [], incoming = [], idFactory = () => '') {
  const result = current.map(lead => {
    const normalized = normalizeLead(lead);
    return normalized.id ? normalized : { ...normalized, id: idFactory() };
  });

  const byId = new Map(result.filter(lead => lead.id).map((lead, index) => [lead.id, index]));
  const byMapsUrl = new Map(result.filter(lead => lead.mapsUrl).map((lead, index) => [lead.mapsUrl, index]));
  const byEmail = new Map(result.filter(lead => lead.email).map((lead, index) => [lead.email, index]));

  for (const rawLead of incoming) {
    const lead = normalizeLead(rawLead);
    let index = lead.id ? byId.get(lead.id) : undefined;
    if (index === undefined && lead.mapsUrl) index = byMapsUrl.get(lead.mapsUrl);
    if (index === undefined && lead.email) index = byEmail.get(lead.email);

    if (index === undefined) {
      const created = { ...lead, id: lead.id || idFactory() };
      result.push(created);
      index = result.length - 1;
    } else {
      result[index] = mergeLead(result[index], lead);
    }

    const saved = result[index];
    if (saved.id) byId.set(saved.id, index);
    if (saved.mapsUrl) byMapsUrl.set(saved.mapsUrl, index);
    if (saved.email) byEmail.set(saved.email, index);
  }

  return result;
}
