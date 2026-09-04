import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/session-planner.js', import.meta.url), 'utf8');
const config = { profileId: 'profile', levels: ['N5', 'N4'], dailyJaEs: 20, dailyEsJa: 10, newRatio: 90, cooldownDays: 14 };
const date = new Date().toLocaleDateString('en-CA');
const ago = days => new Date(Date.now() - days * 86400000).toISOString();
const exercise = (id, extra = {}) => ({ exercise_id: id, direction: 'ja_es', jlpt_level: 'N5', active: true, difficulty: 10, topic_tags: [id], vocabulary_tags: [], grammar_tags: [], ...extra });
const attempt = (id, days = 30, extra = {}) => ({ attempt_id: id, exercise_id: id, profile_id: 'profile', direction: 'ja_es', attempted_at: ago(days), overall_score: 70, evaluation_status: 'valid', ...extra });
function fixture(exercises, attempts = [], progress = [], initial = null) {
  let session = structuredClone(initial);
  const writes = [];
  const JapoDB = {
    all: async store => structuredClone(({ exercises, attempts, exercise_progress: progress })[store] || []),
    get: async () => structuredClone(session),
    put: async (store, row) => { writes.push(store); session = structuredClone(row); },
  };
  const TopicProgression = { analyze: () => [], bonus: () => 0, familyFor: x => x };
  const context = { window: { TopicProgression, RankedProgress: { snapshot: () => ({}), accessForDirection: () => ({ allowedLevels: ['N5'] }) } }, TopicProgression, JapoDB, Date };
  vm.runInNewContext(fs.readFileSync(new URL('../src/difficulty.js', import.meta.url), 'utf8'), context);
  context.Difficulty = context.window.Difficulty;
  vm.runInNewContext(source, context);
  return { planner: context.window.SessionPlanner, writes, session: () => session };
}
const ids = (row, d = 'ja_es') => JSON.parse(row[`exercise_ids_${d}_json`]);

test('a shortage never bypasses the 14-day minimum, even after a bad answer', () => {
  const exercises = Array.from({ length: 25 }, (_, i) => exercise(`old-${i}`));
  const attempts = exercises.map(e => attempt(e.exercise_id, 1, { overall_score: 5 }));
  const progress = exercises.map(e => ({ exercise_id: e.exercise_id, times_seen: 1, last_seen_at: ago(1), cooldown_until: ago(1), next_review_at: ago(1) }));
  const { planner } = fixture(exercises);
  const diagnostics = {};
  assert.equal(planner.choose(exercises, progress, attempts, 20, config, 'ja_es', date, [], { diagnostics }).length, 0);
  assert.equal(diagnostics.shortfall, 20);
});

test('an unseen shortage cannot be replaced with extra reviews', () => {
  const fresh = [exercise('fresh')], old = Array.from({ length: 25 }, (_, i) => exercise(`old-${i}`));
  const { planner } = fixture([...fresh, ...old]);
  const picked = planner.choose([...fresh, ...old], [], old.map(e => attempt(e.exercise_id)), 20, config, 'ja_es', date);
  assert.equal(picked.length, 3);
  assert.ok(picked.includes('fresh'));
  assert.equal(picked.filter(id => id.startsWith('old')).length, 2);
});

test('recent progress remains authoritative when an attempt is missing from history', () => {
  const exercises = [exercise('old')], { planner } = fixture(exercises);
  const progress = [{ exercise_id: 'old', times_seen: 4, last_seen_at: ago(1) }];
  assert.equal(planner.choose(exercises, progress, [attempt('old', 30)], 1, { ...config, newRatio: 0 }, 'ja_es', date).length, 0);
});

test('very easy work stays deferred even when all unseen material is already planned', () => {
  const exercises = [exercise('old'), exercise('new')], { planner } = fixture(exercises);
  const attempts = [attempt('old', 30, { overall_score: 99, user_difficulty_feedback: 'too_easy' })];
  assert.equal(planner.choose(exercises, [], attempts, 1, { ...config, newRatio: 0 }, 'ja_es', date, [], { excludeIds: ['new'] }).length, 0);
});

test('manual level selection is respected without bypassing independent difficulty bands', () => {
  const exercises = [exercise('n5-old'), ...Array.from({ length: 25 }, (_, i) => exercise(`n4-${i}`, { jlpt_level: 'N4' })), exercise('n4-hard', { jlpt_level: 'N4', difficulty: 95 })];
  const { planner } = fixture(exercises);
  const picked = planner.choose(exercises, [], [attempt('n5-old', 1)], 20, config, 'ja_es', date);
  assert.equal(picked.length, 20);
  assert.ok(picked.every(id => id.startsWith('n4-') && id !== 'n4-hard'));
});

test('duplicate Japanese under another ID is not a new exercise', () => {
  const exercises = [exercise('old', { source_text: 'これは本です。' }), exercise('duplicate', { source_text: 'これは 本です' }), exercise('fresh')];
  const { planner } = fixture(exercises);
  const picked = planner.choose(exercises, [], [attempt('old', 1)], 20, config, 'ja_es', date);
  assert.deepEqual(Array.from(picked), ['fresh']);
});

test('a book template cluster is spread out when other lexical contexts exist', () => {
  const books = Array.from({ length: 6 }, (_, i) => exercise(`book-${i}`, { source_text: `本${i}`, vocabulary_tags: ['本'], grammar_tags: ['です'] }));
  const others = ['電車', '料理', '仕事', '友達', '銀行', '旅行', '天気'].map(word => exercise(word, { source_text: word, vocabulary_tags: [word], grammar_tags: ['です'] }));
  const { planner } = fixture([...books, ...others]);
  const picked = planner.choose([...books, ...others], [], [], 6, config, 'ja_es', date);
  assert.ok(picked.filter(id => id.startsWith('book-')).length <= 1);
});

test('other profiles do not make an exercise seen for this learner', () => {
  const exercises = [exercise('new')];
  const { planner } = fixture(exercises);
  assert.deepEqual(Array.from(planner.choose(exercises, [], [attempt('new', 1, { profile_id: 'other' })], 1, config, 'ja_es', date)), ['new']);
});

test('regeneration preserves completed work, drafts and voluntary repeats outside quotas', async () => {
  const exercises = ['ja_es', 'es_ja'].flatMap(direction => Array.from({ length: 90 }, (_, i) => exercise(`${direction}-${i}`, { direction })));
  const repeatJa = ['ja_es-80', 'ja_es-81'], repeatEs = ['es_ja-80'];
  const initial = { session_id: `profile::${date}`, profile_id: 'profile', local_date: date,
    exercise_ids_ja_es_json: JSON.stringify([...Array.from({ length: 20 }, (_, i) => `ja_es-${i}`), ...repeatJa]),
    exercise_ids_es_ja_json: JSON.stringify([...Array.from({ length: 10 }, (_, i) => `es_ja-${i}`), ...repeatEs]),
    completed_exercise_ids_json: '["ja_es-0"]', drafts_json: '{"ja_es-1":"draft"}',
    voluntary_repeat_ids_ja_es_json: JSON.stringify(repeatJa), voluntary_repeat_ids_es_ja_json: JSON.stringify(repeatEs) };
  // A repeat answered today and requested again tomorrow must remain in today's extras.
  const attempts = [attempt('ja_es-0', 30), attempt('ja_es-0', 0), attempt('ja_es-80', 0, { repeat_tomorrow: true, repeat_requested_for: '2099-01-01', repeat_request_updated_at: ago(0) })];
  const before = JSON.stringify(attempts), { planner, writes } = fixture(exercises, attempts, [], initial);
  for (const row of [await planner.regenerate('profile', config, date), await planner.regenerate('profile', config, date)]) {
    assert.equal(ids(row).length, 22);
    assert.equal(ids(row, 'es_ja').length, 11);
    assert.ok(ids(row).includes('ja_es-0'));
    assert.ok(ids(row).includes('ja_es-1'));
    assert.equal(JSON.parse(row.drafts_json)['ja_es-1'], 'draft');
    assert.deepEqual(JSON.parse(row.voluntary_repeat_ids_ja_es_json), repeatJa);
    assert.deepEqual(JSON.parse(row.voluntary_repeat_ids_es_ja_json), repeatEs);
    assert.ok(JSON.parse(row.completed_exercise_ids_json).includes('ja_es-80'));
  }
  assert.equal(JSON.stringify(attempts), before);
  assert.ok(writes.every(store => store === 'daily_sessions'));
});

test('concurrent plan reads serialize instead of overwriting each other', async () => {
  const exercises = Array.from({ length: 40 }, (_, i) => exercise(`fresh-${i}`));
  const { planner, writes } = fixture(exercises);
  const [a, b] = await Promise.all([planner.getOrCreate('profile', config, date), planner.getOrCreate('profile', config, date)]);
  assert.equal(a.exercise_ids_ja_es_json, b.exercise_ids_ja_es_json);
  assert.equal(writes.length, 1);
});

test('an additional study exercise survives reload and regeneration without changing the daily target', async () => {
  const exercises = ['ja_es', 'es_ja'].flatMap(direction => Array.from({ length: 60 }, (_, i) => exercise(`${direction}-${i}`, { direction })));
  const { planner } = fixture(exercises);
  await planner.getOrCreate('profile', config, date);
  const extra = await planner.createExtra('profile', config);
  assert.equal(ids(extra).length, 21);
  const restored = await planner.getOrCreate('profile', config, date);
  assert.equal(ids(restored).length, 21);
  const rebuilt = await planner.regenerate('profile', config, date);
  assert.equal(ids(rebuilt).length, 21);
  assert.equal(rebuilt.planned_ja_es, 20);
});

const cloud = fs.readFileSync(new URL('../src/cloud-sync.js', import.meta.url), 'utf8');
const start = cloud.indexOf('  function mergeSession('), end = cloud.indexOf('\n  function ', start + 4);
const mergeSession = vm.runInNewContext(`${cloud.slice(start, end)}; mergeSession`);
test('cloud sync cannot resurrect discarded pending IDs in either merge order', () => {
  const old = { exercise_ids_ja_es_json: '["done","draft","discarded","repeat"]', exercise_ids_es_ja_json: '[]', completed_exercise_ids_json: '["done"]', drafts_json: '{"draft":"answer"}', voluntary_repeat_ids_ja_es_json: '["repeat"]' };
  const newer = { plan_updated_at: ago(0), exercise_ids_ja_es_json: '["fresh"]', exercise_ids_es_ja_json: '[]', completed_exercise_ids_json: '[]', planned_ja_es: 20 };
  for (const merged of [mergeSession(old, newer), mergeSession(newer, old)]) {
    assert.deepEqual(new Set(ids(merged)), new Set(['fresh', 'done', 'draft', 'repeat']));
    assert.equal(merged.planned_ja_es, 20);
    assert.equal(merged.plan_updated_at, newer.plan_updated_at);
    assert.equal(JSON.parse(merged.drafts_json).draft, 'answer');
    assert.deepEqual(JSON.parse(merged.voluntary_repeat_ids_ja_es_json), ['repeat']);
  }
});

test('cloud sync preserves the newest extension metadata and ignores unrelated completions', () => {
  const old = { plan_updated_at: ago(1), exercise_ids_ja_es_json: '["done"]', completed_exercise_ids_json: '["done","unrelated"]', extra_study_history_json: '[{"added_ja_es":1}]' };
  const newer = { plan_updated_at: ago(0), exercise_ids_ja_es_json: '["done","pending"]', extra_study_history_json: '[{"added_ja_es":2}]' };
  for (const row of [mergeSession(old, newer), mergeSession(newer, old)]) {
    assert.equal(row.extra_study_history_json, newer.extra_study_history_json);
    assert.equal(row.status, 'in_progress');
    assert.equal(row.completed_at, null);
  }
});
