# Privacy Policy

**GitLab Diff: Hide Renames, Shims & Noise** · effective 2026-06-10

**In short:** this extension collects no personal data, sends nothing to the
author or any third party, and processes everything locally in your browser.

Hosted version: https://philipp-berger.github.io/gitlab-diff-hide-noise/privacy.html

## Data controller

Provided by **Philipp Berger** ("the author"). Because no personal data is
processed by the author, no representative or data protection officer is
appointed. Privacy questions: email <p.stylus+gitlab-diff-hide-noise@gmail.com> or the
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

## Legal basis (Art. 6 GDPR)

The author does not process personal data, so no Article 6 legal basis arises
for the author. Your preferences are stored solely to make the extension work as
you configured it — local browser configuration under your control, not
processing of personal data by the author.

## Storage and retention

The author stores and retains no personal data and keeps no logs. Your
preference settings (non-personal booleans) remain in your browser — and, if
Chrome Sync is enabled, in your own Google Account — until you change them, clear
your browser storage, or uninstall the extension.

## International data transfers

The extension transfers no personal data and performs no international transfer.
If you separately use Chrome Sync or visit the website, Google or GitHub may
process technical data on servers outside the EU/EEA under their own safeguards
(e.g. EU Standard Contractual Clauses), per their respective privacy policies.

## Automated decision-making

No automated decision-making or profiling within the meaning of Article 22 GDPR
takes place.

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
