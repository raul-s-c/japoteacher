# Esquema de evaluación 1.0

Una evaluación válida incluye puntuaciones 0–100 para significado objetivo, comprensibilidad, naturalidad, gramática, vocabulario, ortografía, registro y total; booleanos `is_acceptable` y `meaning_changed`; respuestas corregida y natural; explicación, interpretación, fortalezas, errores y tags detectados.

Cada error guarda `error_id`, categoría normalizada, subtipo, severidad, spans, explicación, tags y efectos sobre significado, comprensión y naturalidad. Si la respuesta no pasa la validación, se conserva el intento y la respuesta bruta con estado `invalid`, sin actualizar el SRS.
