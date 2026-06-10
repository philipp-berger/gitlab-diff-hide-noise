# GitLab Diff: Hide Renames, Shims &amp; Noise

A Chrome (MV3) extension that declutters GitLab merge-request **diff** pages by
hiding four kinds of low-signal files:

- **Pure renames** — files GitLab shows as `+0 −0` (moved, no content change).
- **Re-export shims** — (usually new) files whose whole body is `export … from …`
  re-exports, the stubs left so old import paths keep resolving after a move.
- **Import-only changes** — existing files whose only changed lines are
  `import … from …` (import-path churn from a refactor).
- **Comment-only changes** — existing files whose only changed lines are
  comments.

Each category is independently toggleable from the toolbar popup.

> **Classic diffs only.** GitLab's beta "Rapid Diffs" view is **not supported**;
> the on-page panel says so when it's active. Switch to classic diffs.

## How it works

GitLab's file tree is a *virtualized* list of absolutely-positioned rows, so
hiding rows in the DOM after render leaves ugly gaps. Instead the extension
removes the unwanted files from GitLab's data **before** it builds the tree:

1. **Interceptor (`src/intercept.js`, page MAIN world, `document_start`).**
   GitLab loads the tree from `diffs_metadata.json` via axios (XMLHttpRequest).
   Chrome's native `XMLHttpRequest#responseText` is unforgeable — an accessor
   override is silently bypassed — so the interceptor replaces
   `window.XMLHttpRequest` with a thin wrapper that delegates to a real XHR but
   exposes a *forgeable* `responseText`/`response`. Only `diffs_metadata.json`
   responses are touched; every other request passes through untouched. Matching
   files are dropped from `diff_files` and the file count is adjusted, so the
   tree renders without them — no gaps, native rendering.
   - Pure renames are detected from the metadata's own `added_lines`/
     `removed_lines` fields (exactly what the tree shows).
   - Shims / import-only need diff content, so they're classified from the
     same-origin v4 `/diffs` API (cookie-authenticated) and matched by path.

2. **Diff-stream hider (`src/content.js`, isolated world).** The classic diff
   blocks (`.diff-file.file-holder`, normal flow) are matched by
   `sha1(new_path)` (the element id) and hidden with `display:none`, which
   reflows cleanly. A floating panel shows the hidden count and a master toggle.

## Install (unpacked)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open a classic MR diffs page, e.g.
   `https://gitlab.com/<group>/<project>/-/merge_requests/<id>/diffs`.

After editing the code, click **Reload** (↻) on the extension card, then reload
the MR page.

## Scope &amp; limits

- `https://gitlab.com` only (add other origins to `host_permissions` +
  `content_scripts.matches` in `manifest.json` for self-hosted).
- Changing a category re-filters the tree on the **next page reload** (the diff
  stream updates live; the tree is built once from the intercepted response).
- The XHR wrapper aims to be transparent for all other requests; if a future
  GitLab change breaks the diffs page, disable the extension and file an issue.

## Files

| File | Role |
|------|------|
| `manifest.json` | MV3; MAIN-world interceptor + isolated content script |
| `src/gitlab-api.js` | URL parsing, paginated `/diffs` fetch, `sha1` |
| `src/detect.js` | rename / shim / import-only / comment-only classification |
| `src/intercept.js` | `XMLHttpRequest` wrapper filtering `diffs_metadata.json` |
| `src/content.js` | diff-stream hiding, panel, Rapid-Diffs notice, opts mirror, tree-refilter |
| `src/styles.css` | hide rule + panel styling |
| `popup.html` / `popup.js` | per-category options + reload |

## Packaging

`./build.sh` produces `mrViewReducer-<version>.zip` ready to upload to the
Chrome Web Store (manifest, scripts, popup, icons).

## Privacy &amp; license

No data is collected or sent anywhere; everything runs locally against your own
GitLab session. See [PRIVACY.md](PRIVACY.md). Licensed under [MIT](LICENSE).
