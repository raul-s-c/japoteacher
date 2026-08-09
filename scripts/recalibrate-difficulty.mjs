import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data", "exercises.full.csv");
const write = process.argv.includes("--write");

function parseCsv(text) {
  const rows = [], row = [];
  let field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push([...row]); row.length = 0; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function encodeCsv(rows) {
  return rows.map(row => row.map(value => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(",")).join("\n") + "\n";
}

function count(value) { return String(value || "").split("|").filter(Boolean).length; }
function japaneseCharacters(row) { return [...`${row.source_text} ${row.reference_translation}`].filter(char => char >= "\u3400" && char <= "\u9fff").length; }
function hash(value) { let valueHash = 2166136261; for (const char of value) { valueHash ^= char.charCodeAt(0); valueHash = Math.imul(valueHash, 16777619); } return (valueHash >>> 0) / 2 ** 32; }
function percentile(values, value) { const below = values.filter(candidate => candidate < value).length, equal = values.filter(candidate => candidate === value).length; return (below + Math.max(0, equal - 1) / 2) / Math.max(1, values.length - 1); }

const matrix = parseCsv(fs.readFileSync(csvPath, "utf8"));
const headers = matrix.shift();
headers[0] = headers[0].replace(/^\uFEFF/, "");
const rows = matrix.filter(row => row.length).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
const groups = new Map();
for (const row of rows) {
  if (String(row.active).toLowerCase() === "false") continue;
  const key = `${row.jlpt_level}:${row.direction}`;
  const items = groups.get(key) || [];
  items.push(row);
  groups.set(key, items);
}

for (const items of groups.values()) {
  const oldValues = items.map(row => Number(row.difficulty) || 0);
  const lengths = items.map(row => String(row.source_text || "").length + String(row.reference_translation || "").length);
  const grammar = items.map(row => count(row.grammar_tags));
  const vocabulary = items.map(row => count(row.vocabulary_tags));
  const particles = items.map(row => count(row.particle_tags));
  const kanji = items.map(japaneseCharacters);
  const oldMin = Math.min(...oldValues), oldMax = Math.max(...oldValues);
  for (const row of items) {
    const old = Number(row.difficulty) || oldMin;
    const oldRelative = oldMax === oldMin ? 0.5 : (old - oldMin) / (oldMax - oldMin);
    row._complexity = 0.4 * oldRelative
      + 0.2 * percentile(lengths, String(row.source_text || "").length + String(row.reference_translation || "").length)
      + 0.17 * percentile(grammar, count(row.grammar_tags))
      + 0.1 * percentile(vocabulary, count(row.vocabulary_tags))
      + 0.07 * percentile(particles, count(row.particle_tags))
      + 0.06 * percentile(kanji, japaneseCharacters(row))
      + hash(row.exercise_id) / 10000;
  }
  items.sort((left, right) => left._complexity - right._complexity || left.exercise_id.localeCompare(right.exercise_id));
  items.forEach((row, index) => { row.difficulty = String(Math.round(index * 100 / Math.max(1, items.length - 1))); row.dataset_version = "4.0"; delete row._complexity; });
}

const summary = [...groups.entries()].map(([group, items]) => ({ group, count: items.length, min: Math.min(...items.map(row => Number(row.difficulty))), max: Math.max(...items.map(row => Number(row.difficulty))), unique: new Set(items.map(row => row.difficulty)).size }));
console.table(summary);
if (!write) {
  console.log("Dry run. Run `node scripts/recalibrate-difficulty.mjs --write` to update the CSV.");
  process.exit(0);
}
fs.writeFileSync(csvPath, encodeCsv([headers, ...rows.map(row => headers.map(header => row[header] || ""))]), "utf8");
console.log(`Updated ${rows.length} exercises with calibrated 0-100 difficulty scores.`);
