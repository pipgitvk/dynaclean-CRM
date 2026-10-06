/**
 * Replaces filter-style <input type="date" /> with TypeableDateFilterInput.
 * Does not span across multiple <input> tags.
 * Run: node scripts/migrate-typeable-date-filters.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const IMPORT_LINE =
  'import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";';

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(jsx|tsx)$/.test(ent.name)) files.push(p);
  }
  return files;
}

function addImport(content) {
  if (content.includes("import TypeableDateFilterInput")) return content;
  if (content.includes('"use client"') || content.includes("'use client'")) {
    return content.replace(/(['"])use client\1;?\s*\n/, (m) => m + IMPORT_LINE + "\n");
  }
  return IMPORT_LINE + "\n" + content;
}

const BLOCK_RE =
  /<input\b(?:(?!<input)[\s\S])*?type\s*=\s*["']date["'](?:(?!<input)[\s\S])*?\/>/gi;

function resolveOnChange(onChangeBody, inner) {
  const trimmed = onChangeBody.trim();

  const simpleSetter = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*([^(][\s\S]*?)\(\s*\1\.target\.value\s*\)$/,
  );
  if (simpleSetter) return simpleSetter[2].trim();

  const setFiltersSpread = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*setFilters\(\{\s*\.\.\.filters,\s*(\w+):\s*\1\.target\.value\s*\}\)$/,
  );
  if (setFiltersSpread) {
    return `(v) => setFilters({ ...filters, ${setFiltersSpread[2]}: v })`;
  }

  const handleFilterUpdate = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*handleFilterUpdate\(\s*["']([^"']+)["']\s*,\s*\1\.target\.value\s*\)$/,
  );
  if (handleFilterUpdate) {
    return `(v) => handleFilterUpdate("${handleFilterUpdate[2]}", v)`;
  }

  const handleDateChange = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*handleDateChange\(\s*["']([^"']+)["']\s*,\s*\1\.target\.value\s*\)$/,
  );
  if (handleDateChange) {
    return `(v) => handleDateChange("${handleDateChange[2]}", v)`;
  }

  const updateFn = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*update\(\s*["']([^"']+)["']\s*,\s*\1\.target\.value\s*\)$/,
  );
  if (updateFn) {
    return `(v) => update("${updateFn[2]}", v)`;
  }

  const stmtBlock = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*\{\s*(\w+)\(\s*\1\.target\.value\s*\)\s*;\s*(\w+)\(([^)]*)\)\s*;\s*\}$/,
  );
  if (stmtBlock) {
    return `(v) => { ${stmtBlock[2]}(v); ${stmtBlock[3]}(${stmtBlock[4]}); }`;
  }

  const setterPopup = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*(\w+)\(\(p\)\s*=>\s*\(p\s*\?\s*\{\s*\.\.\.p,\s*(\w+):\s*\1\.target\.value\s*\}\s*:\s*p\)\)$/,
  );
  if (setterPopup) {
    return `(v) => ${setterPopup[2]}((p) => (p ? { ...p, ${setterPopup[3]}: v } : p))`;
  }

  const handleStatusField = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*handleStatusFieldChange\(\s*["']([^"']+)["']\s*,\s*\1\.target\.value\s*\)$/,
  );
  if (handleStatusField) {
    return `(v) => handleStatusFieldChange("${handleStatusField[2]}", v)`;
  }

  const inlinePlanned = trimmed.match(
    /^\(\s*(\w+)\s*\)\s*=>\s*handleInlinePlannedDateChange\(\s*record,\s*\1\.target\.value\s*\)$/,
  );
  if (inlinePlanned) {
    return `(v) => handleInlinePlannedDateChange(record, v)`;
  }

  if (/^\w+$/.test(trimmed)) {
    const handler = trimmed;
    const nameMatch = inner.match(/\bname\s*=\s*["']([^"']+)["']/);
    if (nameMatch) {
      const field = nameMatch[1];
      return `(v) => ${handler}({ target: { name: "${field}", value: v } })`;
    }
  }

  return null;
}

function extractBraceProp(inner, propName) {
  const marker = `${propName}={`;
  const start = inner.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length;
  let depth = 1;
  const bodyStart = i;
  while (i < inner.length && depth > 0) {
    const ch = inner[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  return inner.slice(bodyStart, i - 1);
}

function stripBraceProp(inner, propName) {
  const marker = `${propName}={`;
  const start = inner.indexOf(marker);
  if (start === -1) return inner;
  let i = start + marker.length;
  let depth = 1;
  while (i < inner.length && depth > 0) {
    const ch = inner[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return (inner.slice(0, start) + inner.slice(i)).trim();
}

function transformBlock(fullMatch) {
  const inner = fullMatch.replace(/^<input\b/i, "").replace(/\/>$/, "");
  if (/\{\.\.\.register/.test(inner)) return fullMatch;

  const valueExpr = extractBraceProp(inner, "value");
  if (!valueExpr) return fullMatch;

  const onChangeBody = extractBraceProp(inner, "onChange");
  if (!onChangeBody) return fullMatch;

  const onChangeProp = resolveOnChange(onChangeBody, inner);
  if (!onChangeProp) return fullMatch;

  let attrs = stripBraceProp(stripBraceProp(inner, "value"), "onChange");
  attrs = attrs
    .replace(/\s*type\s*=\s*["']date["']\s*/gi, " ")
    .replace(/\s*\bname\s*=\s*["'][^"']+["']\s*/g, " ")
    .trim();

  const attrPart = attrs ? ` ${attrs}` : "";
  return `<TypeableDateFilterInput value={${valueExpr}} onChange={${onChangeProp}}${attrPart}/>`;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (!/type\s*=\s*["']date["']/i.test(content)) return false;

  const next = content.replace(BLOCK_RE, transformBlock);
  if (next === content) return false;

  fs.writeFileSync(filePath, addImport(next));
  return true;
}

const files = walk(ROOT);
let count = 0;
for (const f of files) {
  if (f.includes("TypeableDateFilterInput.jsx")) continue;
  if (processFile(f)) {
    count++;
    console.log("updated:", path.relative(ROOT, f));
  }
}
console.log(`Done. ${count} files updated.`);
