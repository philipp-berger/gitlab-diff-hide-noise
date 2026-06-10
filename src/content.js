/*
 * content.js  (isolated world, document_idle)
 *
 * Two responsibilities on a classic GitLab MR diff page:
 *   1. Hide rename/shim/import-only files in the *diff stream* (classic
 *      `.diff-file.file-holder` blocks are normal-flow, so display:none reflows
 *      cleanly). The file *tree* is handled upstream by intercept.js, which
 *      drops those files from diffs_metadata.json before GitLab builds the tree.
 *   2. Mirror the user's options into localStorage so the MAIN-world interceptor
 *      (which has no chrome.* access) can read them.
 *
 * Rapid Diffs is not supported; if detected the panel says so.
 */
(function () {
  'use strict';

  const { parseMrContext, fetchAllDiffs, sha1Hex } = window.MRR_api;
  const { classify } = window.MRR_detect;

  const DEFAULT_OPTS = { enabled: true, hideRenames: true, hideShims: true, hideImports: true, hideComments: true };
  const HIDE_CLASS = 'mrr-hidden';
  // Classic diff blocks only; <diff-file> (Rapid Diffs) is intentionally excluded.
  const DIFF_FILE_SELECTOR = '.diff-file.file-holder[id]';

  let state = {
    opts: { ...DEFAULT_OPTS },
    hideHashes: new Set(), // sha1(new_path) for files to hide in the diff stream
    counts: { renames: 0, shims: 0, imports: 0, comments: 0, total: 0 },
    observer: null,
    applyScheduled: false,
  };

  // Monotonic token: any async work whose token is stale must not commit.
  let runToken = 0;

  /* ---------- options ---------- */

  // Mirror options to localStorage so intercept.js (MAIN world) can read them.
  function mirrorOpts(opts) {
    try {
      localStorage.setItem('mrr-opts', JSON.stringify(opts));
    } catch (_e) {
      /* ignore */
    }
  }

  function loadOpts() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(DEFAULT_OPTS, (v) => {
          if (chrome.runtime.lastError) {
            resolve({ ...DEFAULT_OPTS });
            return;
          }
          resolve({ ...DEFAULT_OPTS, ...v });
        });
      } catch (_e) {
        resolve({ ...DEFAULT_OPTS });
      }
    });
  }

  /* ---------- analysis ---------- */

  async function analyze(token) {
    const ctx = parseMrContext(location.pathname);
    if (!ctx) return false;
    state.opts = await loadOpts();
    mirrorOpts(state.opts);
    if (token !== runToken) return false;

    let files;
    try {
      files = await fetchAllDiffs(ctx);
    } catch (e) {
      console.warn('[MRR] failed to load MR diffs:', e.message);
      return false;
    }
    if (token !== runToken) return false;

    const hideHashes = new Set();
    const counts = { renames: 0, shims: 0, imports: 0, comments: 0, total: 0 };

    await Promise.all(
      files.map(async (file) => {
        const { hidden, reasons } = classify(file, state.opts);
        if (!hidden) return;
        if (reasons.includes('rename')) counts.renames++;
        if (reasons.includes('shim')) counts.shims++;
        if (reasons.includes('import')) counts.imports++;
        if (reasons.includes('comment')) counts.comments++;
        counts.total++;
        hideHashes.add(await sha1Hex(file.new_path));
      })
    );
    if (token !== runToken) return false;

    state.hideHashes = hideHashes;
    state.counts = counts;
    return true;
  }

  /* ---------- DOM application ---------- */

  function isRapidDiffs() {
    return !!document.querySelector('diff-file');
  }

  // Hide classic diff blocks by their sha1(new_path) id (the element id).
  function applyDiffFiles(active) {
    const nodes = document.querySelectorAll(DIFF_FILE_SELECTOR);
    for (const node of nodes) {
      node.classList.toggle(HIDE_CLASS, active && state.hideHashes.has(node.id));
    }
  }

  // The MAIN-world interceptor installs its XHR wrapper at document_start, but
  // GitLab's *initial* diffs_metadata.json request can fire before that (an MV3
  // world:MAIN timing limitation), so the first tree is built unfiltered and
  // cached. We force one metadata re-fetch — which now goes through the wrapper
  // and rebuilds the tree without the hidden files — by toggling GitLab's
  // "Show whitespace changes" control (changes the `w` param), then restoring
  // it. Runs once per page load.
  let treeRefilterDone = false;
  function forceTreeRefilter() {
    if (treeRefilterDone || state.counts.total === 0) return;
    const ws = document.querySelector('input[data-testid="show-whitespace"]');
    if (!ws) return;
    treeRefilterDone = true;
    const original = ws.checked;
    ws.click(); // re-fetch metadata through the wrapper → filtered tree
    setTimeout(() => {
      if (ws.checked !== original) ws.click(); // restore the user's setting
    }, 1500);
  }

  function scheduleApply() {
    if (state.applyScheduled) return;
    state.applyScheduled = true;
    requestAnimationFrame(() => {
      state.applyScheduled = false;
      const active = state.opts.enabled && state.counts.total > 0;
      applyDiffFiles(active);
      updatePanel();
    });
  }

  /* ---------- toggle panel ---------- */

  function ensurePanel() {
    let panel = document.getElementById('mrr-panel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'mrr-panel';
    const label = document.createElement('label');
    label.className = 'mrr-row';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = 'mrr-toggle';
    const span = document.createElement('span');
    span.id = 'mrr-label';
    label.append(toggle, span);
    panel.appendChild(label);
    document.body.appendChild(panel);
    panel.querySelector('#mrr-toggle').addEventListener('change', (e) => {
      state.opts.enabled = e.target.checked;
      mirrorOpts(state.opts);
      try {
        chrome.storage.sync.set({ enabled: state.opts.enabled });
      } catch (_e) {
        /* storage may be unavailable */
      }
      scheduleApply();
    });
    return panel;
  }

  function updatePanel() {
    if (isRapidDiffs()) {
      const panel = ensurePanel();
      panel.querySelector('#mrr-toggle').style.display = 'none';
      panel.querySelector('#mrr-label').textContent = 'Rapid Diffs not supported — switch to classic diffs';
      return;
    }
    if (state.counts.total === 0) {
      const existing = document.getElementById('mrr-panel');
      if (existing) existing.remove();
      return;
    }
    const panel = ensurePanel();
    const toggle = panel.querySelector('#mrr-toggle');
    toggle.style.display = '';
    toggle.checked = state.opts.enabled;
    const parts = [];
    if (state.counts.renames) parts.push(`${state.counts.renames} rename${state.counts.renames === 1 ? '' : 's'}`);
    if (state.counts.shims) parts.push(`${state.counts.shims} shim${state.counts.shims === 1 ? '' : 's'}`);
    if (state.counts.imports) parts.push(`${state.counts.imports} import-only`);
    if (state.counts.comments) parts.push(`${state.counts.comments} comment-only`);
    const what = parts.join(' + ');
    panel.querySelector('#mrr-label').textContent = state.opts.enabled ? `Hiding ${what}` : `Show — ${what} hidden`;
  }

  /* ---------- observers & lifecycle ---------- */

  function startObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(() => scheduleApply());
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    if (!parseMrContext(location.pathname)) return;
    const token = ++runToken;
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    state.hideHashes = new Set();
    state.counts = { renames: 0, shims: 0, imports: 0, comments: 0, total: 0 };
    state.applyScheduled = false;
    const ok = await analyze(token);
    if (!ok || token !== runToken) return;
    startObserver();
    scheduleApply();
    forceTreeRefilter();
  }

  // React to option changes from the popup.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      let reanalyze = false;
      if ('enabled' in changes) state.opts.enabled = changes.enabled.newValue;
      for (const key of ['hideRenames', 'hideShims', 'hideImports', 'hideComments']) {
        if (key in changes) {
          state.opts[key] = changes[key].newValue;
          reanalyze = true;
        }
      }
      mirrorOpts(state.opts);
      if (reanalyze) init();
      else scheduleApply();
    });
  } catch (_e) {
    /* no storage events available */
  }

  // Manual re-scan from the popup's "Re-scan diffs" button.
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'mrr-rescan') {
        init();
        sendResponse({ ok: true });
      }
    });
  } catch (_e) {
    /* no runtime messaging available */
  }

  /* ---------- SPA navigation handling ---------- */

  let lastPath = location.pathname;
  function onNav() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    // Note: treeRefilterDone is intentionally NOT reset — only the initial
    // full-page load races the interceptor; SPA-navigated MRs are fetched
    // through the already-installed wrapper and filtered without a re-toggle.
    const old = document.getElementById('mrr-panel');
    if (old) old.remove();
    init();
  }
  if (!history.__mrrPatched) {
    history.__mrrPatched = true;
    ['pushState', 'replaceState'].forEach((m) => {
      const orig = history[m];
      history[m] = function () {
        const r = orig.apply(this, arguments);
        setTimeout(onNav, 0);
        return r;
      };
    });
  }
  window.addEventListener('popstate', () => setTimeout(onNav, 0));

  init();
})();
