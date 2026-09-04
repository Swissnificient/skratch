const scrapeBtn = document.getElementById("scrapeBtn");
const statusElement = document.getElementById("status");
const resultsElement = document.getElementById("results");

scrapeBtn.addEventListener("click", async () => {
  statusElement.textContent = "Skratching...";
  resultsElement.textContent = "";

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "scrapeEmails"
    });

    const emails = response.emails;

    if (emails.length === 0) {
      statusElement.textContent = "No emails found.";
      return;
    }

    // Get previously saved emails
    const stored = await chrome.storage.local.get({
      emails: []
    });

    // Combine old and new emails
    const allEmails = [
      ...new Set([
        ...stored.emails,
        ...emails
      ])
    ];

    // Save the updated list
    await chrome.storage.local.set({
      emails: allEmails
    });

    statusElement.textContent =
      `${emails.length} new email(s) found.`;

    resultsElement.innerHTML = allEmails
      .map(email => `<div>${email}</div>`)
      .join("");

  } catch (error) {
    console.error(error);

    statusElement.textContent =
      "Could not communicate with the webpage.";
  }
});