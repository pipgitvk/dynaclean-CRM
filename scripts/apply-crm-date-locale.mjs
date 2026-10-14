import fs from "fs";
import path from "path";

const IMPORT_LINE =
  'import { formatCrmDateOnly } from "@/lib/crmDateFormat";';

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(jsx?|tsx?)$/.test(ent.name)) files.push(p);
  }
  return files;
}

function ensureImport(text) {
  if (text.includes('from "@/lib/crmDateFormat"')) return text;
  const useClient =
    text.startsWith('"use client"') || text.startsWith("'use client'");
  if (useClient) {
    const lines = text.split("\n");
    lines.splice(1, 0, "", IMPORT_LINE);
    return lines.join("\n");
  }
  const m = text.match(/^import .+;\r?\n/m);
  if (m) {
    const idx = m.index + m[0].length;
    return text.slice(0, idx) + IMPORT_LINE + "\n" + text.slice(idx);
  }
  return IMPORT_LINE + "\n" + text;
}

const root = path.join(process.cwd(), "src");
let fileCount = 0;
let total = 0;

const newDateRe = /new Date\(([^)]+)\)\.toLocaleDateString\(\)/g;
const enShortRe =
  /([a-zA-Z_$][\w$.?\[\]()]*)\.toLocaleDateString\((?:'en-GB'|"en-GB"|'en-IN'|"en-IN"),\s*\{[^}]*month:\s*(?:'short'|"short")[^}]*\}\)/g;

for (const file of walk(root)) {
  if (file.includes("crmDateFormat.js")) continue;
  let text = fs.readFileSync(file, "utf8");
  let localTotal = 0;

  text = text.replace(newDateRe, (_, inner) => {
    localTotal++;
    return `formatCrmDateOnly(${inner.trim()})`;
  });

  text = text.replace(enShortRe, (_, expr) => {
    localTotal++;
    return `formatCrmDateOnly(${expr.trim()})`;
  });

  if (localTotal > 0) {
    text = ensureImport(text);
    fs.writeFileSync(file, text);
    fileCount++;
    total += localTotal;
  }
}

console.log(`Locale pass: ${fileCount} files, ${total} replacements`);
