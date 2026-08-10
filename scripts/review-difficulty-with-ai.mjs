import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data", "exercises.full.csv");
const checkpointPath = path.join(root, "data", "editorial", "difficulty-review-checkpoint.jsonl");
const usagePath = path.join(root, "data", "editorial", "usage.jsonl");
const endpoint = process.env.EDITORIAL_ENDPOINT || "https://japoteacher-ai.raul-nihongo.workers.dev/editorial/generate";
const editorialKey = process.env.EDITORIAL_API_KEY;
const batchSize = Math.max(1, Math.min(20, Number(process.env.DIFFICULTY_REVIEW_BATCH_SIZE || 16)));
const shouldApply = process.argv.includes("--apply");
const limitFlag = process.argv.indexOf("--limit");
const limit = limitFlag >= 0 ? Number(process.argv[limitFlag + 1]) : Infinity;
const levelsFlag = process.argv.indexOf("--levels");
const levels = new Set((levelsFlag >= 0 ? process.argv[levelsFlag + 1] : "N5,N4").split(",").map(value => value.trim()).filter(Boolean));
const baselineFlag = process.argv.indexOf("--usage-baseline");
const tokenBudgetFlag = process.argv.indexOf("--token-budget");
const usageBaseline = baselineFlag >= 0 ? Number(process.argv[baselineFlag + 1]) : null;
const tokenBudget = tokenBudgetFlag >= 0 ? Number(process.argv[tokenBudgetFlag + 1]) : null;

if (!editorialKey) throw new Error("Set EDITORIAL_API_KEY in this terminal before running the review.");

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

function encodeCsv(rows) { return rows.map(row => row.map(value => { const text = String(value ?? ""); return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }).join(",")).join("\n") + "\n"; }
function tags(value) { return String(value || "").split("|").filter(Boolean); }
function active(row) { return !["false", "0", "no"].includes(String(row.active).toLowerCase()); }
function sleep(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }
function recordedUsage() { if (!fs.existsSync(usagePath)) return 0; return fs.readFileSync(usagePath, "utf8").split(/\r?\n/).filter(Boolean).reduce((total, line) => { const usage = JSON.parse(line).usage || {}; return total + (usage.total_tokens || usage.input_tokens || 0) + (usage.total_tokens ? 0 : usage.output_tokens || 0); }, 0); }
function budgetReached() { return usageBaseline != null && tokenBudget != null && recordedUsage() - usageBaseline >= tokenBudget; }

const matrix = parseCsv(fs.readFileSync(csvPath, "utf8"));
const headers = matrix.shift();
headers[0] = headers[0].replace(/^\uFEFF/, "");
const rows = matrix.filter(row => row.length).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
const reviewed = new Map();
if (fs.existsSync(checkpointPath)) for (const line of fs.readFileSync(checkpointPath, "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const item = JSON.parse(line);
  if (item?.exercise_id && Number.isInteger(item.difficulty)) reviewed.set(item.exercise_id, item);
}

const queues = new Map();
for (const row of rows.filter(row => active(row) && levels.has(row.jlpt_level))) {
  if (reviewed.has(row.exercise_id)) continue;
  const key = `${row.jlpt_level}:${row.direction}`;
  const items = queues.get(key) || [];
  items.push(row);
  queues.set(key, items);
}

let completed = 0, stoppedForBudget = false;
for (const [group, queue] of queues) {
  for (let offset = 0; offset < queue.length && completed < limit; offset += batchSize) {
    if (budgetReached()) { stoppedForBudget = true; break; }
    const batch = queue.slice(offset, Math.min(offset + batchSize, offset + (limit - completed)));
    const exercises = batch.map(row => ({
      exercise_id: row.exercise_id,
      jlpt_level: row.jlpt_level,
      direction: row.direction,
      japanese: row.direction === "ja_es" ? row.source_text : row.reference_translation,
      spanish: row.direction === "ja_es" ? row.reference_translation : row.source_text,
      grammar_tags: tags(row.grammar_tags),
      vocabulary_tags: tags(row.vocabulary_tags),
      particle_tags: tags(row.particle_tags),
      sentence_type: row.sentence_type,
      baseline: Number(row.difficulty),
    }));
    let response, body, items;
    const requested = new Set(batch.map(row => row.exercise_id));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Editorial-Key": editorialKey }, body: JSON.stringify({ operation: "difficulty_review", group, exercises }) });
      if (response.ok) {
        body = await response.json();
        items = body?.result?.items || [];
        if (items.length === batch.length && items.every(item => requested.has(item.exercise_id))) break;
      }
      if (attempt === 2) throw new Error(`Editorial review returned an incomplete batch for ${group}.`);
      await sleep(1500 * (attempt + 1));
    }
    fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
    fs.appendFileSync(checkpointPath, items.map(item => JSON.stringify({ ...item, group, reviewed_at: new Date().toISOString(), response_id: body.response_id })).join("\n") + "\n", "utf8");
    fs.appendFileSync(usagePath, JSON.stringify({ recorded_at: new Date().toISOString(), operation: "difficulty_review", level: group.split(":")[0], model: body.model, response_id: body.response_id, usage: body.usage || {} }) + "\n", "utf8");
    items.forEach(item => reviewed.set(item.exercise_id, item));
    completed += batch.length;
    console.log(`${group}: ${reviewed.size}/${rows.filter(active).length} reviewed (${body.usage?.total_tokens || "?"} tokens in this batch)`);
  }
  if (stoppedForBudget) break;
}

const activeRows = rows.filter(row => active(row) && levels.has(row.jlpt_level));
if (!shouldApply) {
  console.log(`Checkpoint now contains ${activeRows.filter(row => reviewed.has(row.exercise_id)).length}/${activeRows.length} scoped exercises.${stoppedForBudget ? " Token budget reached." : ""} Run again to resume, then use --apply when complete.`);
  process.exit(0);
}
if (activeRows.some(row => !reviewed.has(row.exercise_id))) throw new Error(`Refusing to apply a partial review (${activeRows.filter(row => reviewed.has(row.exercise_id)).length}/${activeRows.length}).`);
for (const row of activeRows) row.difficulty = String(reviewed.get(row.exercise_id).difficulty);
fs.writeFileSync(csvPath, encodeCsv([headers, ...rows.map(row => headers.map(header => row[header] || ""))]), "utf8");
console.log(`Applied AI-reviewed difficulty scores to ${activeRows.length} active exercises.`);
