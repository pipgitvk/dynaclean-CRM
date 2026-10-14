import fs from "fs";
import path from "path";

const replacements = [
  ["DD MMM, YYYY hh:mm A", "DD-MM-YYYY hh:mm A"],
  ["DD MMM, YYYY HH:mm", "DD-MM-YYYY HH:mm"],
  ["DD MMM YYYY, hh:mm A", "DD-MM-YYYY hh:mm A"],
  ["DD MMM YYYY hh:mm A", "DD-MM-YYYY hh:mm A"],
  ["DD MMM YYYY HH:mm", "DD-MM-YYYY HH:mm"],
  ["DD MMM, YYYY", "DD-MM-YYYY"],
  ["DD MMM YYYY", "DD-MM-YYYY"],
  ["DD-MMM-YYYY HH:mm", "DD-MM-YYYY HH:mm"],
  ["DD-MMM-YYYY", "DD-MM-YYYY"],
  ["DD/MM/YYYY HH:mm", "DD-MM-YYYY HH:mm"],
  ["DD/MM/YYYY", "DD-MM-YYYY"],
  ["MMM d, yyyy", "dd-MM-yyyy"],
  ["DD MMM, hh:mm A", "DD-MM-YYYY hh:mm A"],
  ["DD MMM YY", "DD-MM-YYYY"],
  ["DD-MMM-YY", "DD-MM-YYYY"],
  ['.format("DD MMM")', '.format("DD-MM-YYYY")'],
  [".format('DD MMM')", ".format('DD-MM-YYYY')"],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(jsx?|tsx?)$/.test(ent.name)) files.push(p);
  }
  return files;
}

const root = path.join(process.cwd(), "src");
let fileCount = 0;
let total = 0;
for (const file of walk(root)) {
  let text = fs.readFileSync(file, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = text.match(re);
    if (matches?.length) {
      text = text.replace(re, to);
      total += matches.length;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, text);
    fileCount++;
  }
}
console.log(`Updated ${fileCount} files, ${total} replacements`);
