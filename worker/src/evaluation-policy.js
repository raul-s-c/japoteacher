const DIMENSION_WEIGHTS = Object.freeze({
  objective_score: 0.3,
  comprehensibility_score: 0.15,
  naturalness_score: 0.15,
  grammar_score: 0.15,
  vocabulary_score: 0.1,
  orthography_score: 0.1,
  register_score: 0.05,
});

const REGISTER_ERROR_CATEGORIES = new Set(["register", "politeness"]);
const MEANING_BREAKING_CATEGORIES = new Set(["meaning_change", "omission", "addition", "source_misunderstanding"]);

export function spanishSourceMarksRegister(sourceText = "") {
  const normalized = String(sourceText).normalize("NFKC").toLocaleLowerCase("es");
  return /(?<!\p{L})(usted|ustedes|tú|vos|vosotros|vosotras|señor|señora|señorita|don|doña)(?!\p{L})/u.test(normalized);
}

export function weightedOverall(evaluation) {
  return Math.round(Object.entries(DIMENSION_WEIGHTS).reduce(
    (total, [field, weight]) => total + Number(evaluation[field]) * weight,
    0,
  ));
}

export function normalizeEvaluation(evaluation, payload) {
  const normalized = {
    ...evaluation,
    errors: [...(evaluation.errors || [])],
    detected_error_tags: [...(evaluation.detected_error_tags || [])],
  };
  const spanishRegisterIsUnmarked = payload?.exercise?.direction === "es_ja" &&
    !spanishSourceMarksRegister(payload?.exercise?.source_text);

  if (spanishRegisterIsUnmarked) {
    normalized.register_score = 100;
    normalized.errors = normalized.errors.filter(
      (error) => !REGISTER_ERROR_CATEGORIES.has(error?.category),
    );
    normalized.detected_error_tags = normalized.detected_error_tags.filter(
      (tag) => !REGISTER_ERROR_CATEGORIES.has(tag),
    );
    normalized.overall_score = weightedOverall(normalized);
  }

  // Do not let a localized grammar correction erase demonstrated meaning.
  const answer = String(payload?.attempt?.user_answer || "").trim();
  const collapsedDimensions = Object.keys(DIMENSION_WEIGHTS)
    .filter((field) => Number(normalized[field]) === 0).length;
  const localizedErrors = normalized.errors.length > 0 && normalized.errors.every(
    (error) => !MEANING_BREAKING_CATEGORIES.has(error?.category),
  );
  if (answer && normalized.strengths?.length && collapsedDimensions >= 5 && localizedErrors) {
    normalized.objective_score = Math.max(75, Number(normalized.objective_score) || 0);
    normalized.comprehensibility_score = Math.max(85, Number(normalized.comprehensibility_score) || 0);
    normalized.naturalness_score = Math.max(40, Number(normalized.naturalness_score) || 0);
    normalized.grammar_score = Math.max(20, Number(normalized.grammar_score) || 0);
    normalized.vocabulary_score = Math.max(80, Number(normalized.vocabulary_score) || 0);
    normalized.orthography_score = Math.max(80, Number(normalized.orthography_score) || 0);
    normalized.overall_score = weightedOverall(normalized);
    normalized.is_acceptable = false;
    normalized.meaning_changed = false;
  }

  if (normalized.overall_score === 100) {
    for (const field of Object.keys(DIMENSION_WEIGHTS)) normalized[field] = 100;
    normalized.errors = [];
    normalized.detected_error_tags = [];
    normalized.is_acceptable = true;
    normalized.meaning_changed = false;
  }
  return normalized;
}
