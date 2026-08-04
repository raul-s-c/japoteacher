# Esquema de evaluación 1.1

Una evaluación válida incluye puntuaciones 0–100 para significado objetivo, comprensibilidad, naturalidad, gramática, vocabulario, ortografía, registro y total; booleanos `is_acceptable` y `meaning_changed`; respuestas corregida y natural; explicación, interpretación, fortalezas, errores y etiquetas detectadas.

También incluye `correct_japanese_sentence`, la frase japonesa completa que el estudiante debe tomar como referencia, y `kanji_readings`, una lista de todos los bloques léxicos de esa frase que contienen kanji. Cada elemento contiene:

- `characters`: palabra o bloque tal como aparece en la frase.
- `reading_hiragana`: pronunciación contextual completa en hiragana, incluidos los okurigana.
- `meaning_es`: significado en español dentro de esa frase.
- `explanation_es`: por qué se emplea esa lectura en ese contexto (lectura on/kun, compuesto, conjugación, nombre propio o excepción relevante).

La interfaz usa esos datos para renderizar furigana sobre la frase y una explicación individual de cada kanji o compuesto.

Cada error guarda `error_id`, categoría normalizada, subtipo, severidad, fragmentos, explicación, etiquetas y efectos sobre significado, comprensión y naturalidad. Si la respuesta no pasa la validación, se conserva el intento y la respuesta bruta con estado `invalid`, sin actualizar el SRS.
