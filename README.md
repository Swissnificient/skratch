# Skratch

> A lightweight Chrome extension for extracting email addresses from webpages.

Skratch is a Chrome Extension built to help collect publicly visible email addresses from webpages. The project is currently in its early development stage, with the initial focus on reliable email extraction, local storage, and building a foundation for more advanced lead-scraping capabilities.

## 🚧 Project Status

**Current version:** `0.1.0`

Skratch is currently under active development.

### Implemented

* Extract email addresses from webpages
* Detect emails contained in visible page text
* Detect emails from `mailto:` links
* Remove duplicate email addresses
* Normalize extracted emails to lowercase
* Display extracted emails in the extension popup
* Save extracted emails using Chrome's local storage
* Preserve previously collected emails between scraping sessions

### Planned

* [ ] Improved email/lead management
* [ ] Clear saved emails
* [ ] Export collected emails to CSV
* [ ] Capture additional lead information
* [ ] Google Business / Google Maps extraction
* [ ] LinkedIn-specific extraction of publicly accessible information
* [ ] Improved validation and normalization
* [ ] Better UI/UX
* [ ] Testing and production packaging

---

## Features

### Email Extraction

Skratch scans the current webpage and identifies publicly visible email addresses using pattern matching.

It also checks `mailto:` links to catch email addresses that may not appear directly in the visible page text.

### Duplicate Prevention

Extracted emails are stored using JavaScript,`Set`, preventing the same email address from being saved multiple times.

### Local Storage

Collected emails are stored using Chrome's `chrome.storage.local` API, allowing the extension to retain collected addresses between popup sessions.

---

## Project Structure

```text
skratch/
├── background/
│   └── service-worker.js
│
├── content/
│   └── content.js
│
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
│
└── manifest.json
```

### `manifest.json`

Defines the Chrome Extension configuration, permissions, popup, background service worker, and content scripts.

### `content/content.js`

Responsible for interacting with the webpage and extracting email addresses.

### `popup/popup.html`

Defines the extension popup interface.

### `popup/popup.js`

Handles communication between the popup and content script, displaying results, and saving collected emails.

### `popup/popup.css`

Contains the styling for the popup interface.

### `background/service-worker.js`

Contains the extension's background service worker. It will be used for background functionality as the project grows.

---

## How It Works

Skratch uses a simple Chrome Extension architecture:

```text
User opens webpage
        │
        ▼
Skratch popup
        │
        │  Request email extraction
        ▼
Content Script
        │
        │  Scan webpage
        ▼
Email Extraction
        │
        ▼
Popup receives emails
        │
        ▼
Chrome Local Storage
```

The popup communicates with the content script using Chrome's messaging API.

---

## Installation

Skratch is currently installed manually as an unpacked Chrome Extension for development.

### Prerequisites

* Google Chrome or a Chromium-based browser
* Git
* A code editor such as VS Code

### Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/skratch.git
cd skratch
```

Replace `YOUR_USERNAME` with your GitHub username.

### Load the Extension

1. Open Chrome.
2. Navigate to:

```text
chrome://extensions
```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `skratch` project directory.
6. Skratch should now appear in your installed extensions.

---

## Usage

1. Open a webpage containing publicly visible email addresses.
2. Click the **Skratch** extension.
3. Click **Scrape Page**.
4. Skratch scans the webpage for email addresses.
5. Extracted emails are displayed in the popup.
6. Collected emails are saved locally by the extension.

### Example

If a webpage contains:

```text
Contact us at hello@example.com
or sales@example.com
```

Skratch will return:

```text
hello@example.com
sales@example.com
```

Duplicate occurrences of the same email are only stored once.

---

## Development

The project currently uses standard Chrome Extension technologies:

* JavaScript
* HTML
* CSS
* Chrome Extensions Manifest V3

No build system is currently required.

Changes to the extension can be tested by:

1. Editing the source files.
2. Returning to `chrome://extensions`.
3. Clicking **Reload** on Skratch.
4. Refreshing the webpage being tested.
5. Opening the extension and testing the changed functionality.

> **Note:** After reloading the extension, refresh the webpage before testing content-script functionality. Chrome content scripts are injected when the webpage loads.

---

## Permissions

Skratch currently requests the following Chrome permissions:

| Permission  | Purpose                                            |
| ----------- | -------------------------------------------------- |
| `activeTab` | Allows interaction with the currently active tab   |
| `storage`   | Stores collected email addresses locally           |
| `scripting` | Provides access to Chrome's scripting capabilities |

The extension currently uses a content script to inspect webpages and extract publicly accessible email addresses.

---

## Privacy

Skratch is currently designed to process publicly accessible webpage information.

Collected email addresses are stored locally using Chrome's extension storage.

The current version does **not** send collected emails to an external server.

As the project evolves, any external services or data transmission should be clearly documented here.

---

## Responsible Use

Skratch is intended for legitimate research, lead generation, and other lawful purposes involving publicly accessible information.

Users are responsible for complying with:

* Website terms of service
* Applicable privacy and data-protection laws
* Anti-spam regulations
* Platform-specific policies
* Applicable rules governing the collection and use of contact information

Skratch should not be used to bypass authentication, CAPTCHAs, access controls, or other technical protections.

---

## Roadmap

The long-term goal is to develop Skratch into a practical lead-scraping and lead-management tool.

### Phase 1 — Foundation

* [x] Chrome Extension setup
* [x] Manifest V3
* [x] Basic popup interface
* [x] Email extraction
* [x] `mailto:` extraction
* [x] Duplicate prevention
* [x] Local storage

### Phase 2 — Lead Management

* [ ] Saved email management
* [ ] Clear collected data
* [ ] CSV export
* [ ] Source URL tracking
* [ ] Improved result interface

### Phase 3 — Website-Specific Extraction

* [ ] Google Business / Google Maps extraction
* [ ] Business name extraction
* [ ] Website extraction
* [ ] LinkedIn public information extraction

### Phase 4 — Advanced Features

* [ ] Email validation
* [ ] Better normalization
* [ ] Lead categorization
* [ ] Search/filter functionality
* [ ] Improved performance
* [ ] Automated testing

---

## Contributing

Contributions, suggestions, and bug reports are welcome.

For significant changes, please open an issue first to discuss what you would like to change.

### Development Workflow

```bash
git clone https://github.com/Swissnificient/skratch.git
cd skratch
```

Create your changes, test them locally, and submit a pull request.

---

## License

License information will be added before the first public release.

---

## Author

**Sadiq Abubakar**

Skratch is being developed as a learning and practical software engineering project, with a focus on browser extension development, web data extraction, and lead management.
