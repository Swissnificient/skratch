function extractEmails() {
  const emails = new Set();

  // 1. Extract emails from visible page text
  const pageText = document.body.innerText;

  const emailRegex =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  const textMatches = pageText.match(emailRegex) || [];

  textMatches.forEach(email => {
    emails.add(email.toLowerCase());
  });

  // 2. Extract emails from mailto links
  const mailtoLinks = document.querySelectorAll(
    'a[href^="mailto:"]'
  );

  mailtoLinks.forEach(link => {
    const email = link.href
      .replace(/^mailto:/i, "")
      .split("?")[0]
      .trim();

    if (email) {
      emails.add(email.toLowerCase());
    }
  });

  return [...emails];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Skratch received:", message);

  if (message.action === "scrapeEmails") {
    const emails = extractEmails();

    sendResponse({
      emails
    });
  }

  return true;
});