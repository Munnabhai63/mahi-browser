function formatHunk(oldStart, newStart, entries) {
  let oldCount = 0;
  let newCount = 0;
  const lines = [];

  for (const entry of entries) {
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new Error(`Invalid diff entry: must be non-empty string starting with ' ', '+', or '-'`);
    }
    const op = entry[0];
    const text = entry.slice(1);
    if (op === ' ') {
      oldCount++;
      newCount++;
      lines.push(` ${text}`);
    } else if (op === '-') {
      oldCount++;
      lines.push(`-${text}`);
    } else if (op === '+') {
      newCount++;
      lines.push(`+${text}`);
    } else {
      throw new Error(`Invalid diff operator: '${op}' in '${entry}'`);
    }
  }

  const header = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
  return [header, ...lines].join('\n');
}

function formatFileDiff(oldPath, newPath, hunks, indexLine = '1111111..2222222 100644') {
  return [
    `diff --git a/${oldPath} b/${newPath}`,
    `index ${indexLine}`,
    `--- a/${oldPath}`,
    `+++ b/${newPath}`,
    hunks.join('\n')
  ].join('\n');
}

function formatPatch(commitHash, patchNum, totalPatches, subject, description, fileDiffs) {
  return [
    `From ${commitHash} Mon Sep 17 00:00:00 2001`,
    `From: Mahi Browser Engine Team <dev@mahibrowser.local>`,
    `Date: Fri, 14 Nov 2026 12:00:00 +0000`,
    `Subject: [PATCH ${patchNum}/${totalPatches}] ${subject}`,
    ``,
    description,
    `---`,
    fileDiffs.join('\n'),
    `-- `,
    `2.39.5`,
    ``
  ].join('\n');
}

// Strict unified diff hunk validator
function validatePatch(patchContent) {
  const lines = patchContent.split(/\r?\n/);
  let currentFile = null;
  let inHunk = false;
  let expOld = 0, expNew = 0, actOld = 0, actNew = 0;
  let hunkHeader = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('diff --git')) {
      if (inHunk) {
        if (actOld !== expOld || actNew !== expNew) {
          throw new Error(`Hunk mismatch before next file at line ${i + 1} in ${currentFile} ${hunkHeader}: expOld=${expOld}, actOld=${actOld}, expNew=${expNew}, actNew=${actNew}`);
        }
        inHunk = false;
      }
      currentFile = line;
    } else if (line.startsWith('@@ ')) {
      if (inHunk) {
        if (actOld !== expOld || actNew !== expNew) {
          throw new Error(`Hunk mismatch before next hunk at line ${i + 1} in ${currentFile} ${hunkHeader}: expOld=${expOld}, actOld=${actOld}, expNew=${expNew}, actNew=${actNew}`);
        }
      }
      const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (!m) throw new Error(`Invalid hunk header at line ${i + 1}: ${line}`);
      expOld = m[2] !== undefined ? parseInt(m[2], 10) : 1;
      expNew = m[4] !== undefined ? parseInt(m[4], 10) : 1;
      actOld = 0;
      actNew = 0;
      hunkHeader = line;
      inHunk = true;
    } else if (inHunk) {
      if (line.startsWith('-- ') || line.startsWith('diff --git')) {
        if (actOld !== expOld || actNew !== expNew) {
          throw new Error(`Hunk mismatch at footer in ${currentFile} ${hunkHeader}: expOld=${expOld}, actOld=${actOld}, expNew=${expNew}, actNew=${actNew}`);
        }
        inHunk = false;
      } else if (line.startsWith(' ')) {
        actOld++;
        actNew++;
      } else if (line.startsWith('-')) {
        actOld++;
      } else if (line.startsWith('+')) {
        actNew++;
      } else if (line.startsWith('\\')) {
        // e.g. \ No newline at end of file
      } else {
        if (actOld !== expOld || actNew !== expNew) {
          throw new Error(`Hunk terminated unexpectedly at line ${i + 1} ('${line}') in ${currentFile} ${hunkHeader}: expOld=${expOld}, actOld=${actOld}, expNew=${expNew}, actNew=${actNew}`);
        }
        inHunk = false;
      }
    }
  }
  if (inHunk) {
    if (actOld !== expOld || actNew !== expNew) {
      throw new Error(`Hunk mismatch at end of patch in ${currentFile} ${hunkHeader}: expOld=${expOld}, actOld=${actOld}, expNew=${expNew}, actNew=${actNew}`);
    }
  }
  return true;
}

module.exports = {
  formatHunk,
  formatFileDiff,
  formatPatch,
  validatePatch
};
