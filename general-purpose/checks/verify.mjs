import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENTRY_SHELL = 'src/index.mjs';
const CORE_PREFIX = 'src/core/';
const REQUIRED_ENGINE = '>=22.13';
const FILE_LINE_CEILING = 300;
const FUNCTION_LINE_CEILING = 60;
const ALLOWED_DEPENDENCIES = Object.freeze({});
const VERIFIER_PATH = 'checks/verify.mjs';
const LOCKFILE_PATH = 'package-lock.json';
const GIT_DIR = '.git';
const BINARY_SCAN_BYTE_CEILING = 1024 * 1024;
const BINARY_SNIFF_BYTES = 8192;

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][^'"]{12,}['"]/i,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
];

const ENVIRONMENT_PATTERNS = [
  [/\bprocess\b/, 'the name process'],
  [/\bglobalThis\b/, 'the name globalThis'],
  [/['"]node:process['"]/, 'the node:process module'],
];
const DYNAMIC_CODE_PATTERNS = [
  [/\beval\b/, 'the name eval is refused in any position'],
  [/\bFunction\b/, 'the name Function is refused in any position'],
  [/\.\s*constructor\b/, 'constructor member access is refused'],
  [/\[\s*['"`]constructor['"`]\s*\]/, 'computed constructor access is refused'],
  [/['"]node:vm['"]/, 'the node:vm module is refused'],
  [/\bimport\s*\(\s*(?!['"])/, 'computed dynamic import is refused'],
];
const DYNAMIC_IMPORT = /\bimport\s*\(/;
const FUNCTION_OPENER = /^\s*(?:export\s+)?(?:async\s+)?function\b|^\s*(?:export\s+)?const\s+\w+\s*=\s*(?:async\s*)?\(/;
const METHOD_OPENER = /^\s*(?:async\s+)?[\w$]+\s*\([^)]*\)\s*\{\s*$/;
const KEYWORD_HEAD = /^\s*(?:async\s+)?(?:if|for|while|switch|catch|return|else|do|try)\s*\(/;

const findings = [];

function refuse(rule, site, detail) {
  findings.push(`${rule}  ${site}: ${detail}`);
}

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function gitignoreEntries() {
  return read('.gitignore')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

function isScanExcluded(path, ignoreEntries) {
  if (path === VERIFIER_PATH || path === LOCKFILE_PATH) {
    return true;
  }
  if (path === GIT_DIR || path.startsWith(`${GIT_DIR}/`)) {
    return true;
  }
  for (const entry of ignoreEntries) {
    if (entry.endsWith('/')) {
      if (path === entry.slice(0, -1) || path.startsWith(entry)) {
        return true;
      }
    } else if (path === entry) {
      return true;
    }
  }
  return false;
}

function walk(directory, ignoreEntries) {
  const paths = [];
  for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
    const path = directory === '' ? entry.name : `${directory}/${entry.name}`;
    if (ignoreEntries !== undefined && isScanExcluded(path, ignoreEntries)) {
      continue;
    }
    if (entry.isDirectory()) {
      paths.push(...walk(path, ignoreEntries));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

function sanitizeForBraceCount(line) {
  let out = '';
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote !== null) {
      if (character === '\\') {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === '/' && line[index + 1] === '/') {
      break;
    }
    out += character;
  }
  return out;
}

const sourcePaths = walk('src').filter((path) => path.endsWith('.mjs'));

for (const path of sourcePaths) {
  const text = read(path);
  const lines = text.split('\n');

  if (/(^|[^.\w])require\s*\(/.test(text) || /module\.exports/.test(text)) {
    refuse('module-system', path, 'commonjs constructs are refused; use esm import/export');
  }

  for (const [pattern, detail] of DYNAMIC_CODE_PATTERNS) {
    if (pattern.test(text)) {
      refuse('dynamic-code', path, detail);
    }
  }
  for (const line of lines) {
    if (/from\s+['"]node:child_process['"]/.test(line) && /\bexec(?:Sync)?\b/.test(line)) {
      refuse('dynamic-code', path, 'shell-string exec is refused; spawn with an argument array');
    }
  }

  if (path !== ENTRY_SHELL) {
    for (const [pattern, described] of ENVIRONMENT_PATTERNS) {
      if (pattern.test(text)) {
        refuse('environment-site', path, `${described} is confined to ${ENTRY_SHELL}`);
      }
    }
  }

  if (path.startsWith(CORE_PREFIX) && !path.endsWith('.test.mjs')) {
    const specifiers = [...text.matchAll(/^\s*import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/gm)];
    for (const [, specifier] of specifiers) {
      if (!specifier.startsWith('./')) {
        refuse('layering', path, `core imports only within core; found '${specifier}'`);
      }
    }
    if (DYNAMIC_IMPORT.test(text)) {
      refuse('layering', path, 'dynamic import is refused in core production files');
    }
  }

  if (lines.length > FILE_LINE_CEILING) {
    refuse('size-ceilings', path, `${lines.length} lines exceeds the ${FILE_LINE_CEILING}-line file ceiling`);
  }
  let openedAt = -1;
  let depth = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (
      openedAt === -1 &&
      (FUNCTION_OPENER.test(line) || (METHOD_OPENER.test(line) && !KEYWORD_HEAD.test(line)))
    ) {
      openedAt = index;
      depth = 0;
    }
    if (openedAt !== -1) {
      const counted = sanitizeForBraceCount(line);
      depth += (counted.match(/{/g) ?? []).length - (counted.match(/}/g) ?? []).length;
      if (depth <= 0 && index > openedAt) {
        const span = index - openedAt + 1;
        if (span > FUNCTION_LINE_CEILING) {
          refuse('size-ceilings', `${path}:${openedAt + 1}`, `${span}-line function exceeds the ${FUNCTION_LINE_CEILING}-line ceiling`);
        }
        openedAt = -1;
      }
    }
  }
}

const manifest = JSON.parse(read('package.json'));
for (const [section, value] of Object.entries(manifest)) {
  if (!/dependencies$/i.test(section)) {
    continue;
  }
  const names = Array.isArray(value) ? value : Object.keys(value ?? {});
  for (const name of names) {
    if (!(name in ALLOWED_DEPENDENCIES)) {
      refuse('dependency-emptiness', `package.json#${section}`, `${name} is not in the admitted-dependency allowlist`);
    }
  }
}
if (Object.keys(ALLOWED_DEPENDENCIES).length === 0 && existsSync(join(ROOT, LOCKFILE_PATH))) {
  const lock = JSON.parse(read(LOCKFILE_PATH));
  for (const resolved of Object.keys(lock.packages ?? {})) {
    if (resolved !== '') {
      refuse('dependency-emptiness', `package-lock.json#packages`, `'${resolved}' is resolved while the allowlist is empty`);
    }
  }
}

const npmrcLines = existsSync(join(ROOT, '.npmrc'))
  ? read('.npmrc').split(/\r?\n/).map((line) => line.trim())
  : [];
if (!npmrcLines.includes('ignore-scripts=true')) {
  refuse('install-script-refusal', '.npmrc', 'must contain the line ignore-scripts=true');
}

if (manifest.engines?.node !== REQUIRED_ENGINE) {
  refuse('engine-pin', 'package.json#engines', `engines.node must be exactly '${REQUIRED_ENGINE}'`);
}

for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
  if (command.includes('--inspect')) {
    refuse('inspector-refusal', `package.json#scripts.${name}`, 'inspector flags are refused in manifest scripts');
  }
}

const ignoreEntries = gitignoreEntries();
for (const path of walk('', ignoreEntries)) {
  const bytes = readFileSync(join(ROOT, path));
  if (bytes.length > BINARY_SCAN_BYTE_CEILING || bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) {
    continue;
  }
  const text = bytes.toString('utf8');
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      refuse('secret-scan', path, 'a key-like value is present; secrets never live in the tree');
    }
  }
}

if (!existsSync(join(ROOT, LOCKFILE_PATH))) {
  refuse('lockfile-presence', LOCKFILE_PATH, 'the lockfile must be committed');
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(finding);
  }
  process.exit(1);
}
console.log(`conventions: all 11 rules green over ${sourcePaths.length} source files`);
