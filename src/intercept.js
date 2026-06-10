/*
 * intercept.js  (runs in the page's MAIN world, at document_start)
 *
 * GitLab builds the MR file tree from `diffs_metadata.json`, loaded via axios
 * (XMLHttpRequest). Its tree is a virtualized list of absolutely positioned
 * rows, so hiding rows in the DOM afterwards leaves gaps. Instead we drop the
 * rename/shim/import-only files from `diff_files` *before* GitLab parses the
 * response, so the tree is built without them — no gaps, correct count.
 *
 * Chrome's native `XMLHttpRequest#responseText` is unforgeable (an instance- or
 * prototype-level accessor override is silently bypassed), so we cannot rewrite
 * a real XHR's response. The only working approach is to replace
 * `window.XMLHttpRequest` with a wrapper that delegates to a real XHR but
 * exposes a forgeable `responseText`/`response`. We touch only diffs_metadata
 * responses; every other request passes through untouched.
 *
 * Classic diffs only. Rapid Diffs streams its tree differently and is
 * unsupported (the content script shows a notice).
 *
 * Runs in the MAIN world (no chrome.* APIs); options come from a localStorage
 * mirror written by the isolated content script.
 */
(function () {
  'use strict';

  const api = window.MRR_api;
  const detect = window.MRR_detect;
  if (!api || !detect) return;
  if (!api.parseMrContext(location.pathname)) return; // only MR pages

  const META_RE = /\/diffs_metadata\.json/;
  const DEFAULT_OPTS = { enabled: true, hideRenames: true, hideShims: true, hideImports: true, hideComments: true };

  function readOpts() {
    try {
      const raw = localStorage.getItem('mrr-opts');
      if (raw) return { ...DEFAULT_OPTS, ...JSON.parse(raw) };
    } catch (_e) {
      /* ignore */
    }
    return { ...DEFAULT_OPTS };
  }

  /* ---------- classification ---------- */

  // Shim / import-only need diff content, which the tree metadata lacks, so we
  // classify those from the v4 /diffs endpoint (content-based). Pure renames are
  // read straight off the metadata fields, which exactly match the "+0 −0" the
  // tree shows (and avoid any v4-vs-UI diff-version divergence).
  let hidePaths = new Set();
  let hidePathsReady = false;
  let hidePathsPromise = null;
  let hidePathsMrKey = null; // which MR the current hide-set belongs to
  let opts = readOpts();

  function currentMrKey() {
    const c = api.parseMrContext(location.pathname);
    return c ? `${c.projectPath}/${c.mrIid}` : null;
  }

  function buildHidePaths() {
    // Invalidate the cached hide-set when the SPA navigates to a different MR,
    // so the new MR's metadata is never filtered with the previous MR's paths.
    const key = currentMrKey();
    if (key !== hidePathsMrKey) {
      hidePaths = new Set();
      hidePathsReady = false;
      hidePathsPromise = null;
      hidePathsMrKey = key;
    }
    if (hidePathsPromise) return hidePathsPromise;
    opts = readOpts();
    const ctx = api.parseMrContext(location.pathname);
    if (!ctx) {
      hidePathsReady = true;
      return (hidePathsPromise = Promise.resolve(hidePaths));
    }
    const contentOpts = { ...opts, hideRenames: false };
    hidePathsPromise = api
      .fetchAllDiffs(ctx)
      .then((files) => {
        if (opts.enabled) {
          for (const f of files) {
            if (detect.classify(f, contentOpts).hidden) hidePaths.add(f.new_path);
          }
        }
        hidePathsReady = true;
        return hidePaths;
      })
      .catch(() => {
        hidePathsReady = true; // fail open
        return hidePaths;
      });
    return hidePathsPromise;
  }
  buildHidePaths();

  function metaIsPureRename(f) {
    return f.old_path !== f.new_path && f.added_lines === 0 && f.removed_lines === 0;
  }

  function shouldHide(f) {
    if (!opts.enabled) return false;
    if (opts.hideRenames && metaIsPureRename(f)) return true;
    return hidePaths.has(f.new_path);
  }

  function filterMeta(data) {
    if (!data || !Array.isArray(data.diff_files)) return data;
    opts = readOpts();
    const kept = data.diff_files.filter((f) => !shouldHide(f));
    const removed = data.diff_files.length - kept.length;
    if (removed === 0) return data;
    const out = { ...data, diff_files: kept };
    if (typeof out.size === 'number') out.size = Math.max(0, out.size - removed);
    if (typeof out.real_size === 'string') {
      const n = parseInt(out.real_size, 10);
      if (!Number.isNaN(n)) out.real_size = String(Math.max(0, n - removed));
    }
    return out;
  }

  function filterRaw(raw) {
    try {
      return JSON.stringify(filterMeta(JSON.parse(raw)));
    } catch (_e) {
      return raw;
    }
  }

  /* ---------- XMLHttpRequest wrapper ---------- */

  const RealXHR = window.XMLHttpRequest;

  const DELEGATE_METHODS = [
    'setRequestHeader',
    'getResponseHeader',
    'getAllResponseHeaders',
    'overrideMimeType',
    'addEventListener',
    'removeEventListener',
    'dispatchEvent',
  ];
  const DELEGATE_PROPS = [
    'readyState',
    'status',
    'statusText',
    'responseURL',
    'responseXML',
    'upload',
  ];
  const RW_PROPS = ['responseType', 'withCredentials', 'timeout'];
  const EVENT_PROPS = [
    'onreadystatechange',
    'onload',
    'onloadstart',
    'onloadend',
    'onerror',
    'onabort',
    'ontimeout',
    'onprogress',
  ];

  function MRRXHR() {
    const real = new RealXHR();
    const self = this;
    this._real = real;
    this._meta = false;
    this._cache = null;

    for (const m of DELEGATE_METHODS) {
      this[m] = function () {
        return real[m].apply(real, arguments);
      };
    }
    this.open = function (method, url) {
      try {
        self._meta = typeof url === 'string' && META_RE.test(url);
      } catch (_e) {
        self._meta = false;
      }
      return real.open.apply(real, arguments);
    };
    this.send = function () {
      return real.send.apply(real, arguments);
    };
    this.abort = function () {
      return real.abort();
    };

    for (const p of DELEGATE_PROPS) {
      Object.defineProperty(this, p, { configurable: true, enumerable: true, get: () => real[p] });
    }
    for (const p of RW_PROPS) {
      Object.defineProperty(this, p, {
        configurable: true,
        enumerable: true,
        get: () => real[p],
        set: (v) => {
          real[p] = v;
        },
      });
    }
    for (const ev of EVENT_PROPS) {
      Object.defineProperty(this, ev, {
        configurable: true,
        enumerable: true,
        get: () => real[ev],
        set: (fn) => {
          // GitLab's axios reads the metadata response in `onloadend`. For
          // metadata requests we defer that callback until the hide-set is
          // built, so renames AND content-classified files (shim/import-only)
          // are all filtered on the first render — no reload needed. Handlers
          // are bound to the wrapper so `this.responseText` is the filtered one.
          if (self._meta && ev === 'onloadend' && typeof fn === 'function') {
            real[ev] = function (e) {
              buildHidePaths().then(() => {
                try {
                  fn.call(self, e);
                } catch (_err) {
                  /* swallow to avoid breaking the page */
                }
              });
            };
          } else {
            real[ev] = typeof fn === 'function' ? fn.bind(self) : fn;
          }
        },
      });
    }

    const filt = (raw) => {
      if (!self._meta || typeof raw !== 'string') return raw;
      if (self._cache == null) self._cache = filterRaw(raw);
      return self._cache;
    };
    Object.defineProperty(this, 'responseText', {
      configurable: true,
      enumerable: true,
      get() {
        let raw;
        try {
          raw = real.responseText;
        } catch (_e) {
          return ''; // responseType is non-text (e.g. 'json'); read via `response`
        }
        return filt(raw);
      },
    });
    Object.defineProperty(this, 'response', {
      configurable: true,
      enumerable: true,
      get() {
        const r = real.response;
        if (typeof r === 'string') return filt(r);
        if (self._meta && r && typeof r === 'object' && Array.isArray(r.diff_files)) {
          return filterMeta(r); // responseType: 'json'
        }
        return r;
      },
    });
  }
  MRRXHR.UNSENT = 0;
  MRRXHR.OPENED = 1;
  MRRXHR.HEADERS_RECEIVED = 2;
  MRRXHR.LOADING = 3;
  MRRXHR.DONE = 4;
  MRRXHR.prototype = RealXHR.prototype; // satisfy `instanceof XMLHttpRequest`

  window.XMLHttpRequest = MRRXHR;

  /* ---------- fetch interception ---------- */

  // On initial page load GitLab fetches the file list via fetch() (often served
  // from a Service Worker cache, so it never appears as a network request) — the
  // XHR wrapper above only catches the axios path used on later SPA navigation.
  // fetch() responses are fully controllable, so we filter both the tree
  // metadata and the diff batch here. We await the hide-set first so renames AND
  // content-classified files are filtered on the first render.
  const FETCH_RE = /\/diffs_metadata\.json|\/diffs_batch\.json/;
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = async function (input, init) {
      const res = await origFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!FETCH_RE.test(url)) return res;
        await buildHidePaths();
        const data = await res.clone().json();
        const filtered = filterMeta(data);
        if (filtered === data) return res;
        return new Response(JSON.stringify(filtered), {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      } catch (_e) {
        return res;
      }
    };
  }
})();
