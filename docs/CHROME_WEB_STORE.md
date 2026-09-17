# Chrome Web Store release notes

## Permission justification

### storage
Stores leads and enrichment job state locally in the extension profile.

### tabs
Creates and controls one inactive Google Maps tab during business enrichment and reads the active tab identifier for user-triggered scraping.

### alarms
Provides a recovery watchdog for Manifest V3 service-worker suspension during enrichment.

### notifications
Reports enrichment start and completion when the popup is closed.

### http://*/* and https://*/* host access
The extension scans the public business websites referenced by Google Maps to find publicly visible email addresses. It also injects its content script into user-selected public webpages and Google Maps pages. The extension does not load remote executable code.

## Privacy disclosure

- Leads remain in Chrome local extension storage.
- Skratch has no application backend in this release.
- Enrichment requests go directly from the browser to the public business website.
- Request credentials are omitted.
- Public website responses are capped at 2 MB per scanned page.
- Local, private, reserved, and common non-public network destinations are rejected before requests and before redirect hops.
- Diagnostic logging uses the extension console and is not stored as a separate analytics dataset.

## Store submission checks

1. Host the privacy policy at a public HTTPS URL.
2. Use the same product name, purpose, and permission explanation in the listing and review questionnaire.
3. Do not claim guaranteed extraction. Google Maps DOM and business websites vary.
4. Provide screenshots showing user-triggered scraping, enrichment progress, saved leads, and CSV export.
5. Verify the extension against the latest stable Chrome release before submitting.
6. Re-run the release checklist in `PRODUCTION.md` after any permission or content-script change.
