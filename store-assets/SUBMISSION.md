# Chrome Web Store submission — checklist & copy

Upload package: `mrViewReducer-<version>.zip` (run `./build.sh`).

## Assets (in this folder)

| Asset | Size | Store field |
|-------|------|-------------|
| `../icons/icon-128.png` | 128×128 | Store icon |
| `screenshot-1-before-after.png` | 1280×800 | Screenshot 1 |
| `screenshot-2-categories.png` | 1280×800 | Screenshot 2 |
| `promo-440x280.png` | 440×280 | Small promo tile (optional) |

(Screenshots are illustrative mockups with generic file names.)

## Listing copy

**Name:** GitLab Diff: Hide Renames, Shims & Noise

**Summary (132 char max):**
Hide rename, re-export-shim, import-only and comment-only files on GitLab merge request diff pages (classic diffs).

**Category:** Developer Tools

**Description:**
Big refactor merge requests bury the real changes under hundreds of low-signal
files — pure renames, re-export "shim" stubs, import-path churn, and comment
tweaks. This extension removes those from the GitLab MR file tree itself (not
just greyed out), so the diff stays readable.

Hide, with an independent toggle each:
• Pure renames — moved files with no content change
• Re-export shims — files whose body is only `export … from …`
• Import-only changes — files whose only changed lines are `import … from …`
• Comment-only changes — files whose only changed lines are comments

Everything runs locally against your existing GitLab session. No data is
collected, transmitted, or shared.

Notes:
• Works on classic GitLab diff pages. The beta "Rapid Diffs" view is not
  supported (the panel says so when it's active).
• Currently scoped to gitlab.com.

## Privacy

- Single purpose: declutter GitLab MR diff pages.
- Permission `storage`: remember the user's toggle preferences.
- Permission `host_permissions https://gitlab.com/*`: read the MR's own diff
  data (same-origin) and adjust the diff page in place.
- Data usage: does NOT collect or transmit user data. Privacy policy: PRIVACY.md.

## Manual steps before submitting

1. Load unpacked once (`chrome://extensions` → Developer mode → Load unpacked)
   and confirm it works on a real classic MR diff page.
2. Fill the listing with the copy above, upload the two screenshots + icon.
3. Complete the privacy practices tab (justify the two permissions, declare no
   data collection, link the privacy policy).
4. Submit for review.
