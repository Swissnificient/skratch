# Skratch production notes

## Architecture

Skratch uses four boundaries:

1. The popup handles presentation, user actions, and storage-driven rendering.
2. Content scripts read the current webpage and Google Maps DOM. They do not access extension storage.
3. The background service worker owns writes, enrichment orchestration, inactive-tab lifecycle, network requests, notifications, and recovery.
4. `utils/` contains storage, lead merge, CSV, network-validation, and logging primitives shared by trusted extension contexts.

## Reliability model

Google Maps enrichment is event-driven. Each Maps navigation returns control to Chrome. `tabs.onUpdated` resumes work when the page completes. A 30-second alarm acts as a recovery watchdog if an update event is missed or the Manifest V3 worker is suspended.

Job state is persisted in `chrome.storage.local`, including the current index and counts. A stable lead ID prevents redirect or canonical URL changes from creating duplicate records.

Business-detail reads use bounded retries while the Maps page settles. Website requests retry transient HTTP failures and timeouts twice. Permanent client errors are not retried.

## Security controls

- Content scripts are limited to HTTP and HTTPS pages.
- Extension storage is restricted to trusted extension contexts where Chrome supports `setAccessLevel`.
- Popup rendering uses DOM nodes instead of HTML string injection.
- CSV output neutralizes spreadsheet-formula injection.
- Website enrichment accepts only public HTTP and HTTPS destinations.
- Redirects use manual handling and each target is validated before it is followed.
- Common private, loopback, link-local, reserved, multicast, and IPv6 local destinations are rejected.
- Website fetches omit credentials, disable cache reuse, use a 5-second request timeout, and cap scanned responses at 2 MB.
- No remote executable code is loaded.
- Structured diagnostics remain in the extension console and do not create a persistent telemetry store.

## Remaining production risks

Google Maps does not expose a stable public DOM contract for this workflow. Selectors can change without notice. Selector fallbacks are isolated in `content/maps-extractor.js`, but real-browser regression testing remains required.

The public-host check validates URL destinations, including redirects. It does not perform independent DNS resolution before requests, so DNS rebinding remains outside the protection provided by this extension-level filter.

Broad HTTP and HTTPS host access remains necessary for the current website-enrichment architecture. The Chrome Web Store submission must explain this permission clearly and publish a privacy policy that matches runtime behavior.

## Automated validation

Run:

```bash
npm test
npm run check
```

The current suite covers lead merging, stable IDs, CSV escaping, spreadsheet-formula protection, public URL validation, private destination rejection, and redirect validation.

## Browser smoke test

Load the unpacked extension in a clean Chromium or Chrome profile. Confirm there are no extension manifest or service-worker initialization errors. System-level Linux DBus warnings in headless environments are unrelated to the extension.

## Manual release checklist

- Test a normal webpage with visible and `mailto:` email addresses.
- Test a page with no email addresses.
- Test a Google Maps search with at least 20 results.
- Test more than one Google domain or locale where available.
- Close the popup during enrichment and confirm processing continues.
- Reload or terminate the service worker during enrichment and confirm the watchdog resumes the job.
- Cancel an active job and confirm the inactive Maps tab closes.
- Close the inactive Maps tab manually and confirm the job recreates or recovers on the next watchdog cycle.
- Re-scrape previously enriched leads and confirm website and email fields remain.
- Test websites returning 301 or 302 redirects.
- Test 429 and 5xx responses and confirm bounded retries.
- Test a redirect to localhost or a private IP and confirm it is rejected.
- Export CSV and inspect it in spreadsheet software.
- Clear data and confirm leads and enrichment state are removed.
- Review `CHROME_WEB_STORE.md` before publishing.
