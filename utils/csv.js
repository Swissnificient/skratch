export function exportCSV(leads) {
  const columns = ['name', 'email', 'website', 'mapsUrl', 'source'];
  const rows = leads.map(lead => columns.map(key => csv(lead[key] || '')));
  const content = [columns.join(','), ...rows.map(row => row.join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'skratch-leads.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function csv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
