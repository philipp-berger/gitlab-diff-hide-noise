/*
 * detect.js
 * Classify a changed file as a pure rename and/or a re-export "shim".
 * Exposes window.MRR_detect.
 */
(function () {
  'use strict';

  /**
   * A pure rename: GitLab's authoritative flag, with a guard that there is no
   * substantive content change. The /diffs payload sets `renamed_file: true`
   * for moves; a rename can still carry edits, so we additionally require the
   * diff to be empty or trivially small to count it as "pure".
   */
  function isPureRename(file) {
    if (!file.renamed_file) return false;
    const diff = file.diff || '';
    if (diff.trim() === '') return true;
    // Count changed content lines. The `---`/`+++` file-path markers only appear
    // in the preamble before the first `@@` hunk header; after that, any `+`/`-`
    // line is real content (a YAML/TOML/markdown line like `+++title` is a true
    // addition and must be counted), so only skip the markers pre-hunk.
    let changed = 0;
    let inHunk = false;
    for (const line of diff.split('\n')) {
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      if (!inHunk && (line.startsWith('+++') || line.startsWith('---'))) continue;
      if (line.startsWith('+') || line.startsWith('-')) changed++;
    }
    return changed === 0;
  }

  // Statement-level matchers (tested after joining + splitting on `;`).
  const REEXPORT_RE = /^export\s+(\*(\s+as\s+\w+)?|\{[^}]*\}|type\s+\{[^}]*\})\s+from\s+['"][^'"]+['"]$/;
  const IMPORT_RE = /^import\s+.*\s+from\s+['"][^'"]+['"]$/;
  const EXPORT_DEFAULT_FROM_RE = /^export\s+\{\s*default[^}]*\}\s+from\s+['"][^'"]+['"]$/;

  /**
   * A compatibility shim: a (usually new) file whose added content is nothing
   * but re-exports — the migration stubs left behind so old import paths keep
   * resolving. Heuristic: at least one re-export, every statement is a re-export
   * or a supporting import, and the body stays small.
   *
   * Added lines are joined and split on `;` so multi-line export blocks
   * (`export {\n a,\n b\n} from '...';`) are matched as one statement.
   */
  function isReexportShim(file) {
    if (file.deleted_file) return false;
    const diff = file.diff || '';
    if (diff.trim() === '') return false;

    const codeLines = [];
    for (const raw of diff.split('\n')) {
      if (raw.startsWith('+++')) continue;
      if (!raw.startsWith('+')) continue;
      const line = raw.slice(1).trim();
      if (line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
      codeLines.push(line);
    }
    if (codeLines.length === 0) return false;

    const statements = codeLines
      .join(' ')
      .split(';')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (statements.length === 0 || statements.length > 20) return false;

    let reexports = 0;
    for (const stmt of statements) {
      if (REEXPORT_RE.test(stmt) || EXPORT_DEFAULT_FROM_RE.test(stmt)) {
        reexports++;
      } else if (IMPORT_RE.test(stmt)) {
        // supporting import — allowed, not counted as the re-export itself
      } else {
        return false; // real logic present -> not a shim
      }
    }
    return reexports >= 1;
  }

  // A single changed line that belongs to an import statement. Imports often
  // span multiple lines, and a unified diff only shows the *changed* lines (the
  // `import {` head and many member names may be unchanged context, outside the
  // diff window), so we match fragments, not whole statements:
  //   import …                       (head / single-line import)
  //   } from '…';   /   from '…';     (multi-line import tail)
  //   memberName,   memberName as x,  (member line, optionally closing `} from`)
  function isImportLine(l) {
    if (/^import\b/.test(l)) return true;
    if (/^\}?\s*from\s+['"][^'"]+['"]\s*;?$/.test(l)) return true;
    if (/^[{]?\s*[\w$]+(\s+as\s+[\w$]+)?\s*,?\s*[}]?\s*(from\s+['"][^'"]+['"]\s*;?)?$/.test(l)) return true;
    return false;
  }

  /**
   * An import-only change: an existing file whose every changed line is part of
   * an import statement, with at least one changed line touching a `from '…'`
   * clause (so a pure member-name reshuffle that happens to look import-ish is
   * still anchored to a real import change). These are the import-path churn
   * files left behind when code moves — noise during a refactor review.
   */
  function isImportOnly(file) {
    if (file.new_file || file.deleted_file) return false;
    const diff = file.diff || '';
    if (diff.trim() === '') return false;
    const lines = changedLines(diff).filter(
      (l) => !(l.startsWith('//') || l.startsWith('/*') || l.startsWith('*'))
    );
    if (lines.length === 0) return false;
    let hasFrom = false;
    for (const l of lines) {
      if (/\bfrom\s+['"][^'"]+['"]/.test(l)) hasFrom = true;
      if (!isImportLine(l)) return false;
    }
    // Anchor: at least one changed line touches a `from '…'` clause, or every
    // changed line is an `import …` head. Prevents a bare member-name reshuffle
    // (which looks import-ish) from being classified as import-only.
    return hasFrom || lines.every((l) => /^import\b/.test(l));
  }

  // Every non-blank changed line (added + removed, within hunks).
  function changedLines(diff) {
    const out = [];
    let inHunk = false;
    for (const raw of diff.split('\n')) {
      if (raw.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      if (!inHunk) continue;
      const isAdd = raw.startsWith('+') && !raw.startsWith('+++');
      const isDel = raw.startsWith('-') && !raw.startsWith('---');
      if (!isAdd && !isDel) continue;
      const line = raw.slice(1).trim();
      if (line !== '') out.push(line);
    }
    return out;
  }

  function isCommentLine(l) {
    return l.startsWith('//') || l.startsWith('/*') || l.startsWith('*') || l === '*/';
  }

  /**
   * A comment-only change: an existing file whose every changed line is a
   * comment (line `//`, block `/* … *​/`, or a `*` continuation) — doc/comment
   * tweaks that carry no logic change.
   */
  function isCommentOnly(file) {
    if (file.new_file || file.deleted_file) return false;
    const diff = file.diff || '';
    if (diff.trim() === '') return false;
    const lines = changedLines(diff);
    if (lines.length === 0) return false;
    return lines.every(isCommentLine);
  }

  /**
   * Classify against the active options.
   * @returns {{ hidden: boolean, reasons: string[] }}
   */
  function classify(file, opts) {
    const reasons = [];
    if (opts.hideRenames && isPureRename(file)) reasons.push('rename');
    if (opts.hideShims && isReexportShim(file)) reasons.push('shim');
    if (opts.hideImports && isImportOnly(file)) reasons.push('import');
    if (opts.hideComments && isCommentOnly(file)) reasons.push('comment');
    return { hidden: reasons.length > 0, reasons };
  }

  window.MRR_detect = Object.freeze({
    isPureRename,
    isReexportShim,
    isImportOnly,
    isCommentOnly,
    classify,
  });
})();
