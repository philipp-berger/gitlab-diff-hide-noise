/*
 * gitlab-api.js
 * Same-origin GitLab REST access (cookie-authenticated) for the current MR.
 * Exposes window.MRR_api.
 *
 * Why API over DOM scraping: GitLab's Rapid Diffs view is virtualized — only a
 * handful of <diff-file> nodes exist at any time. The REST /diffs endpoint is
 * the only reliable source for the FULL file list, the authoritative
 * `renamed_file` flag, and per-file diff content (needed for shim detection).
 */
(function () {
  'use strict';

  /**
   * Parse `{ projectPath, mrIid }` from a merge_request URL, or null if the
   * current location is not an MR page.
   *   /group/sub/project/-/merge_requests/123/diffs -> project "group/sub/project", iid "123"
   */
  function parseMrContext(pathname) {
    const marker = '/-/merge_requests/';
    const idx = pathname.indexOf(marker);
    if (idx === -1) return null;
    const projectPath = pathname.slice(0, idx).replace(/^\//, '');
    const rest = pathname.slice(idx + marker.length);
    const m = rest.match(/^(\d+)/);
    if (!projectPath || !m) return null;
    return { projectPath, mrIid: m[1] };
  }

  /**
   * Fetch every changed file for the MR, following pagination.
   * Returns [{ old_path, new_path, renamed_file, new_file, deleted_file, diff }].
   * Throws on a non-OK HTTP response so callers can surface the failure.
   */
  async function fetchAllDiffs(ctx, { perPage = 100, maxPages = 50 } = {}) {
    const id = encodeURIComponent(ctx.projectPath);
    const base = `/api/v4/projects/${id}/merge_requests/${ctx.mrIid}/diffs`;
    const all = [];
    for (let page = 1; page <= maxPages; page++) {
      const url = `${base}?per_page=${perPage}&page=${page}`;
      const res = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`GitLab API ${res.status} for MR diffs (page ${page})`);
      }
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < perPage) break;
    }
    return all;
  }

  /** SHA-1 hex of a string. GitLab uses sha1(new_path) as the <diff-file> id. */
  async function sha1Hex(str) {
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  window.MRR_api = Object.freeze({ parseMrContext, fetchAllDiffs, sha1Hex });
})();
