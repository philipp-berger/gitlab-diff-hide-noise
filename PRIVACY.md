# Privacy Policy

**GitLab Diff: Hide Renames, Shims & Noise** · effective 2026-06-10

**In short:** this extension collects no personal data, sends nothing to the
author or any third party, and processes everything locally in your browser.

Hosted version: https://philipp-berger.github.io/gitlab-diff-hide-noise/privacy.html

## Data controller

Provided by **Philipp Berger** ("the author"). Because no personal data is
processed by the author, no representative or data protection officer is
appointed. Privacy questions: the
[issue tracker](https://github.com/philipp-berger/gitlab-diff-hide-noise/issues).

## What the extension does with data

- Runs only on `https://gitlab.com/*/-/merge_requests/*` pages.
- Reads the current merge request's diff data from GitLab's own API
  (`/api/v4/…` and `diffs_metadata.json`) using your existing GitLab session,
  **same-origin only**, to decide which files to hide. This happens entirely in
  your browser; no credentials are read, and the data is never stored or
  transmitted by the extension.
- Stores your toggle preferences (which categories to hide) — simple on/off
  booleans with no personal information — in `chrome.storage.sync` (which Chrome
  may synchronise to your own Google Account across your signed-in devices) and
  mirrors them to the page's `localStorage`. They are never sent to the author
  or any third party.

## What it does NOT do

- No personal data collected, transmitted, sold, or shared.
- No analytics, tracking, telemetry, cookies, or fingerprinting.
- No remote code loaded or executed.
- No access to any site other than `gitlab.com` merge request pages.

## Permissions

- `storage` — remember your toggle preferences.
- `host_permissions: https://gitlab.com/*` — read the MR's own diff data and
  adjust the diff page in place.

## Your rights under the GDPR

The author collects and holds no personal data, so there is in practice no
personal data to access, rectify, erase, restrict, port, or object to. To raise
any concern under Articles 15–21 GDPR, contact the author via the
[issue tracker](https://github.com/philipp-berger/gitlab-diff-hide-noise/issues).
You also have the right to lodge a complaint with a data protection supervisory
authority in your country of residence.

## Third-party services

The extension sends no data to third parties. Two independent services, governed
by their own privacy policies, are involved only indirectly:

- **Google Chrome** — distributes the extension and, if you are signed in, may
  synchronise the non-personal preference booleans via Chrome Sync.
- **GitHub Pages** — hosts the website and may log standard request data (e.g.
  IP address) when you visit it. Visiting the site is not required to use the
  extension.

## Children

A developer tool, not directed at children, processing no personal data.

## Changes

Changes are published on the hosted page with an updated effective date.
