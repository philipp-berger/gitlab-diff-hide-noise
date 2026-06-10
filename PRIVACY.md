# Privacy Policy

**GitLab Diff: Hide Renames, Shims & Noise**

This extension does not collect, transmit, store, or sell any personal data.

## What it accesses

- It runs only on `https://gitlab.com/*/-/merge_requests/*` pages.
- It reads the current merge request's diff data from GitLab's own API
  (`/api/v4/...` and `diffs_metadata.json`) using your existing GitLab session,
  **same-origin only**. No credentials are read, stored, or sent anywhere.
- It stores your toggle preferences (which categories to hide) in
  `chrome.storage.sync` and mirrors them to the page's `localStorage` so the
  in-page script can read them. These are simple booleans, never leave your
  browser, and contain no personal information.

## What it does NOT do

- No data is sent to the extension author or any third party.
- No analytics, tracking, or telemetry.
- No remote code is loaded or executed.
- No access to any site other than `gitlab.com` merge request pages.

## Permissions

- `storage` — to remember your toggle preferences.
- `host_permissions: https://gitlab.com/*` — to read the MR diff data and adjust
  the diff page in place.

Questions: open an issue on the project repository.
