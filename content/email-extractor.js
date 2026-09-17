const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function extractEmails(text = document.body?.innerText || '') {
  const found = new Set((text.match(EMAIL_RE) || []).map(normalizeEmail).filter(Boolean));

  document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
    try {
      const addressPart = decodeURIComponent(link.getAttribute('href').slice(7).split('?')[0]);
      addressPart.split(/[;,]/).map(normalizeEmail).filter(Boolean).forEach(email => found.add(email));
    } catch (error) {
      console.debug('Skratch: invalid mailto link skipped.', error);
    }
  });

  return [...found];
}
