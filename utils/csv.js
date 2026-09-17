const COLUMNS = ['name', 'email', 'website', 'mapsUrl', 'source'];

export function buildCSV(leads) {
  const rows = leads.map(lead => COLUMNS.map(key => csvCell(lead[key] ?? '')));
  return [COLUMNS.join(','), ...rows.map(row => row.join(','))].join('\r\n');
}

export function exportCSV(leads) {
  const content = `\uFEFF${buildCSV(leads)}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `skratch-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function csvCell(value) {
  const safe = protectSpreadsheetFormula(String(value));
  return `"${safe.replaceAll('"', '""')}"`;
}

function protectSpreadsheetFormula(value) {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}
