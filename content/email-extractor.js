const EMAIL_RE = /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g;

function extractEmails(text = document.body?.innerText || "") {
  const found = new Set(text.match(EMAIL_RE) || []);

  document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
    const email = decodeURIComponent(link.href.slice(7).split('?')[0]).trim();
    if (email) found.add(email);
  });

  return [...found].map(email => email.toLowerCase());
}
