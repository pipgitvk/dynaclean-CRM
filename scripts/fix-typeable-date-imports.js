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

let count = 0;
for (const f of walk(ROOT)) {
  if (f.includes("TypeableDateFilterInput.jsx")) continue;
  let content = fs.readFileSync(f, "utf8");
  if (!content.includes("<TypeableDateFilterInput")) continue;
  if (content.includes("import TypeableDateFilterInput")) continue;
  const next = addImport(content);
  fs.writeFileSync(f, next);
  count++;
  console.log("import added:", path.relative(ROOT, f));
}
console.log(`Done. ${count} files fixed.`);
