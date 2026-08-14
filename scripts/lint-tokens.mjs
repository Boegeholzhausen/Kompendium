#!/usr/bin/env node
/**
 * Token-Linter — prueft die harte Regel "nur die Tokens aus dem README,
 * keine freihaendigen Hex-Codes".
 *
 * Gesucht wird in allen .ts/.tsx unter app/ und src/ nach:
 *   - Hex-Farben (#rgb, #rrggbb, #rrggbbaa)
 *   - rgb()/rgba()-Literalen
 *   - fontSize-Angaben ausserhalb der Typo-Skala
 *
 * Erlaubt sind diese Werte nur in den Theme-Dateien selbst.
 *
 * Aufruf: npm run lint:tokens
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

/** Dateien, in denen Rohwerte definiert werden duerfen. */
const allowedFiles = new Set([
  'src/theme/colors.ts',
  'src/theme/typography.ts',
  'src/theme/layout.ts',
  'src/theme/motion.ts',
  'src/theme/tile.ts',
  'scripts/lint-tokens.mjs',
]);

const scanDirs = ['app', 'src'];

const hexPattern = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const rgbPattern = /\brgba?\(/g;
const fontSizePattern = /\bfontSize\s*:/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const findings = [];

for (const dir of scanDirs) {
  const abs = join(projectRoot, dir);
  let files;
  try {
    files = walk(abs);
  } catch {
    continue;
  }

  for (const file of files) {
    const rel = relative(projectRoot, file).split('\\').join('/');
    if (allowedFiles.has(rel)) continue;

    const source = readFileSync(file, 'utf8');
    // Kommentare duerfen Werte zur Erlaeuterung nennen — auch mehrzeilige
    // Blockkommentare, in denen die Tokens des Handoff-Dokuments zitiert werden.
    let inBlockComment = false;

    source.split('\n').forEach((line, index) => {
      let code = line;

      if (inBlockComment) {
        const end = code.indexOf('*/');
        if (end === -1) return;
        code = code.slice(end + 2);
        inBlockComment = false;
      }

      code = code.replace(/\/\*.*?\*\//g, '');

      const start = code.indexOf('/*');
      if (start !== -1) {
        inBlockComment = true;
        code = code.slice(0, start);
      }

      code = code.replace(/\/\/.*$/, '');

      const check = (pattern, label) => {
        pattern.lastIndex = 0;
        const match = pattern.exec(code);
        if (match) {
          findings.push({ rel, line: index + 1, label, text: line.trim() });
        }
      };
      check(hexPattern, 'Freihaendiger Hex-Code');
      check(rgbPattern, 'Freihaendiges rgb()/rgba()');
      check(fontSizePattern, 'fontSize ausserhalb der Typo-Skala');
    });
  }
}

if (findings.length === 0) {
  console.log('Token-Lint: keine freihaendigen Farb- oder Schriftwerte gefunden.');
  process.exit(0);
}

console.error(`Token-Lint: ${findings.length} Verstoss/Verstoesse gefunden.\n`);
for (const f of findings) {
  console.error(`  ${f.rel}:${f.line} — ${f.label}\n    ${f.text}`);
}
process.exit(1);
