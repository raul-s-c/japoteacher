-- Ejecuta esta consulta en Supabase SQL Editor y exporta el resultado como CSV.
-- Conserva tanto el ejercicio respondido como su pareja en la dirección inversa.
with selected_state as (
  select state.payload
  from public.user_state as state
  join auth.users as account on account.id = state.user_id
  where lower(account.email) = lower('raulsolanocalabuig@gmail.com')
), exercises as (
  select exercise
  from selected_state,
       lateral jsonb_array_elements(coalesce(payload->'stores'->'exercises', '[]'::jsonb)) as exercise
), attempts as (
  select attempt
  from selected_state,
       lateral jsonb_array_elements(coalesce(payload->'stores'->'attempts', '[]'::jsonb)) as attempt
), attempted_summary as (
  select
    attempt->>'exercise_id' as exercise_id,
    regexp_replace(attempt->>'exercise_id', '^(JAES|ESJA)-', '') as pair_key,
    count(*) as attempt_count,
    max((attempt->>'attempted_at')::timestamptz) as last_attempted_at,
    round(avg(nullif(attempt->>'overall_score', '')::numeric), 1) as average_score,
    bool_or(coalesce((attempt->>'is_acceptable')::boolean, false)) as ever_acceptable
  from attempts
  where nullif(attempt->>'exercise_id', '') is not null
  group by 1, 2
)
select
  summary.pair_key,
  summary.exercise_id,
  exercise->>'direction' as direction,
  exercise->>'jlpt_level' as jlpt_level,
  exercise->>'source_text' as source_text,
  exercise->>'reference_translation' as reference_translation,
  exercise->>'topic_tags' as topic_tags,
  summary.attempt_count,
  summary.last_attempted_at,
  summary.average_score,
  summary.ever_acceptable
from attempted_summary as summary
left join exercises on exercise->>'exercise_id' = summary.exercise_id
order by summary.last_attempted_at, summary.exercise_id;
