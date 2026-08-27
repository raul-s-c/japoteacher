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

function parts(value) {
  return String(value || "").split("|").map(item => item.trim()).filter(Boolean);
}

function addTag(value, tag) {
  return [...new Set([...parts(value), tag])].join("|");
}

function jpText(row) {
  return row.source_language === "ja" ? row.source_text : row.reference_translation;
}

function has(row, patterns) {
  const haystack = `${jpText(row)} ${row.grammar_tags} ${row.particle_tags}`;
  return patterns.some(pattern => pattern.test(haystack));
}

function countKanji(value) {
  return [...String(value || "")].filter(char => char >= "\u3400" && char <= "\u9fff").length;
}

const n5Bridge = [
  /より.+ほうが/, /ほうが/, /てもいい/, /てはいけ/, /ないでください/, /と思/, /と言/,
  /たら/, /なら/, /ば/, /ので/, /のに/, /こと/, /ように/, /てお/, /てみ/, /かどうか/,
];

const n4Strong = [
  /かどうか/, /ところ/, /ばかり/, /ことにな/, /ことにし/, /ように/, /ながら/,
  /てもら/, /てくれ/, /てあげ/, /てお/, /つもり/, /と思/, /と言/, /でしょう/,
];

const n4Moderate = [
  /たことが/, /たら/, /なら/, /[^れ]ば/, /ても/, /なくても/, /やすい/, /にくい/,
  /ために/, /前に/, /後で/, /ことがあり/, /しなくてもいい/, /ないでください/,
];

const matrix = parseCsv(fs.readFileSync(csvPath, "utf8"));
const headers = matrix.shift();
headers[0] = headers[0].replace(/^\uFEFF/, "");
const rows = matrix.filter(row => row.length).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
const changes = [];

for (const row of rows) {
  if (String(row.active).toLowerCase() !== "true") continue;
  const current = Number(row.difficulty);
  if (!Number.isFinite(current)) continue;

  const grammarCount = parts(row.grammar_tags).length;
  const vocabularyCount = parts(row.vocabulary_tags).length;
  const kanjiCount = countKanji(jpText(row));
  let minimum = null;
  const reasons = [];

  if ((row.jlpt_level === "N5" || row.jlpt_level === "N4") && current < 8) {
    minimum = 8;
    reasons.push("suelo pedagogico minimo");
  }

  if (row.jlpt_level === "N5") {
    if (has(row, n5Bridge)) {
      minimum = row.direction === "es_ja" ? 58 : 52;
      reasons.push("N5 puente con gramatica superior");
      row.situation_tags = addTag(row.situation_tags, "n5_to_n4_bridge");
    }
    if (grammarCount >= 3 || vocabularyCount >= 5 || kanjiCount >= 8) {
      minimum = Math.max(minimum ?? 0, row.direction === "es_ja" ? 36 : 30);
      reasons.push("carga alta para N5");
    }
  }

  if (row.jlpt_level === "N4") {
    if (has(row, n4Strong)) {
      minimum = row.direction === "es_ja" ? 58 : 52;
      reasons.push("patron N4 fuerte");
    } else if (has(row, n4Moderate)) {
      minimum = row.direction === "es_ja" ? 44 : 38;
      reasons.push("patron N4 moderado");
    }
    if (grammarCount >= 3 || vocabularyCount >= 6 || kanjiCount >= 11) {
      minimum = Math.max(minimum ?? 0, row.direction === "es_ja" ? 54 : 48);
      reasons.push("carga alta para N4");
    }
  }

  if (minimum != null && current < minimum) {
    row.difficulty = String(Math.min(100, minimum));
    row.dataset_version = "4.1";
    const note = `Recalibracion automatica: ${reasons.join("; ")}.`;
    row.pedagogical_notes = row.pedagogical_notes ? `${row.pedagogical_notes} ${note}` : note;
    changes.push({ id: row.exercise_id, level: row.jlpt_level, direction: row.direction, from: current, to: minimum, reasons: reasons.join("; ") });
  }
}

const byLevel = {};
for (const change of changes) {
  const key = `${change.level}/${change.direction}`;
  byLevel[key] = (byLevel[key] || 0) + 1;
}

console.log(JSON.stringify({ changes: changes.length, byLevel, examples: changes.slice(0, 25) }, null, 2));
if (write) {
  fs.writeFileSync(csvPath, encodeCsv([headers, ...rows.map(row => headers.map(header => row[header] || ""))]), "utf8");
}
