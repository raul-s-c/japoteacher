import fs from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const path = (relative) => new URL(relative, root);

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path(file), "utf8"));
  } catch {
    return fallback;
  }
}

function readHeadJson(file) {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }));
  } catch {
    return null;
  }
}

function usageTotal() {
  try {
    return fs.readFileSync(path("data/editorial/usage.jsonl"), "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .reduce((total, line) => {
        const usage = JSON.parse(line).usage || {};
        return total + (usage.total_tokens ?? ((usage.input_tokens || 0) + (usage.output_tokens || 0)));
      }, 0);
  } catch {
    return 0;
  }
}

function countJsonl(file) {
  try {
    return fs.readFileSync(path(file), "utf8").split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

function delta(current, previous, key) {
  if (!current || !previous) return null;
  return (current[key] || 0) - (previous[key] || 0);
}

function formatDelta(value) {
  if (value === null || value === undefined) return "";
  if (value > 0) return ` (+${value})`;
  if (value < 0) return ` (${value})`;
  return " (+0)";
}

function statusLines() {
  try {
    return execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

const baseline = Number(process.env.USAGE_BASELINE || process.argv[2] || 0);
const currentUsage = usageTotal();
const spent = Math.max(0, currentUsage - baseline);
const audit = readJson("data/jlpt-bank-audit.json", {});
const previousAudit = readHeadJson("data/jlpt-bank-audit.json");
const byLevel = audit.by_level_direction || {};
const previousByLevel = previousAudit?.by_level_direction || {};
const changed = statusLines();

const lines = [
  "# Resumen editorial diario",
  "",
  `- Tokens consumidos: ${spent.toLocaleString("es-ES")} / baseline ${baseline.toLocaleString("es-ES")}.`,
  `- Ejercicios activos: ${(audit.active_rows || 0).toLocaleString("es-ES")}${formatDelta(delta(audit, previousAudit, "active_rows"))}.`,
  `- Pares semánticos: ${(audit.semantic_pairs || 0).toLocaleString("es-ES")}${formatDelta(delta(audit, previousAudit, "semantic_pairs"))}.`,
  `- Fuente aprobada: N5 ${countJsonl("data/editorial/n5-approved.jsonl").toLocaleString("es-ES")} pares; N4 ${countJsonl("data/editorial/n4-approved.jsonl").toLocaleString("es-ES")} pares.`,
  "",
  "## Cobertura activa",
  "",
  "| Nivel/dirección | Ejercicios | Cambio |",
  "| --- | ---: | ---: |",
  ...Object.keys(byLevel).sort().map((key) => {
    const before = previousByLevel[key] || 0;
    const now = byLevel[key] || 0;
    const diff = now - before;
    return `| ${key} | ${now.toLocaleString("es-ES")} | ${diff >= 0 ? "+" : ""}${diff.toLocaleString("es-ES")} |`;
  }),
  "",
  "## Estado Git",
  "",
  ...(changed.length ? changed.map((line) => `- ${line}`) : ["- Sin cambios pendientes."]),
  "",
  "## Siguiente foco",
  "",
  "- Cerrar N5 hacia 1.400 ejercicios activos.",
  "- Profundizar N4 hacia 2.400 ejercicios activos.",
  "- Preparar N3 bajo solo cuando el soporte editorial de N4 esté suficientemente calibrado.",
  "",
].join("\n");

const output = process.env.SUMMARY_PATH || process.argv[3];
if (output) {
  fs.writeFileSync(output, lines, "utf8");
} else {
  console.log(lines);
}
