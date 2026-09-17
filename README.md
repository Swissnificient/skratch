# Skratch

Skratch is a Manifest V3 Chrome extension for extracting publicly visible business contact information from webpages and Google Maps and storing the results locally.

Current version: `0.4.0`

## Features

- Extract visible email addresses and `mailto:` addresses from webpages.
- Load available Google Maps search results up to a bounded limit.
- Enrich Maps businesses with website and public email data.
- Persist enrichment progress across popup closure and Manifest V3 worker suspension.
- Store leads locally with stable IDs and non-destructive merges.
- Cancel enrichment and clean up the background tab.
- Export leads to CSV with spreadsheet-formula protection.
- Keep content scripts separated from lead storage.
- Validate every website redirect before following it during enrichment.
- Retry transient website failures without retrying permanent client errors.
- Emit structured diagnostic events without persisting lead content in a log store.

## Project structure

```text
skratch/
├── background/
│   └── service-worker.js
├── content/
│   ├── content.js
│   ├── email-extractor.js
│   └── maps-extractor.js
├── docs/
│   └── PRODUCTION.md
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── tests/
│   ├── csv.test.js
│   ├── leads.test.js
│   └── network.test.js
├── utils/
│   ├── csv.js
│   ├── leads.js
│   ├── logger.js
│   ├── network.js
│   └── storage.js
├── manifest.json
├── package.json
└── PRIVACY.md
```

## Local installation

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose this project directory.
5. Open a regular webpage or a Google Maps search page and launch Skratch.

After changing content-script files, reload the extension and refresh the page being tested.

## Validation

Requires Node.js 20 or newer for local tests.

```bash
npm test
npm run check
```

The extension itself has no runtime npm dependencies and does not require a build step.

## Permissions

Skratch requests storage, notification, alarm, tab, and HTTP/HTTPS host access. Broad web host access supports direct public website enrichment. Review `docs/PRODUCTION.md` before Chrome Web Store submission.

## Privacy and responsible use

Lead data remains in Chrome local extension storage. The extension does not include a Skratch backend. Website enrichment makes direct requests to the public websites being scanned.

Use Skratch only for lawful purposes and follow applicable site terms, privacy requirements, and anti-spam rules. Do not use the extension to bypass authentication, CAPTCHAs, access controls, or other technical protections.
