/* popup.js — read/write the shared options in chrome.storage.sync. */
(function () {
  'use strict';
  const DEFAULTS = { enabled: true, hideRenames: true, hideShims: true, hideImports: true, hideComments: true };
  const ids = ['enabled', 'hideRenames', 'hideShims', 'hideImports', 'hideComments'];

  function reflectEnabled(on) {
    document.getElementById('categories').classList.toggle('disabled', !on);
  }

  chrome.storage.sync.get(DEFAULTS, (opts) => {
    if (chrome.runtime.lastError) opts = { ...DEFAULTS };
    for (const id of ids) {
      const el = document.getElementById(id);
      el.checked = !!opts[id];
      el.addEventListener('change', () => {
        chrome.storage.sync.set({ [id]: el.checked });
        if (id === 'enabled') reflectEnabled(el.checked);
      });
    }
    reflectEnabled(!!opts.enabled);
  });

  // Reload: the file tree is built once from the intercepted metadata response,
  // so applying a category change to the tree requires a full page reload.
  document.getElementById('rescan').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) return;
      chrome.tabs.reload(tab.id);
      window.close();
    });
  });
})();
