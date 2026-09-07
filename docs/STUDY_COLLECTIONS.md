# Bloques de estudio

En Ajustes, selecciona **Sakamoto** en «Bloque de estudio», elige su porcentaje y pulsa **Recalcular el día**. Un 70 % de 15 frases solicita 11 del bloque por dirección. La selección respeta niveles, dificultad desbloqueada y proporción de nuevas/repasos. Si faltan candidatas aptas, completa con el banco general e indica el déficit. Los intentos y borradores existentes se conservan.

Sakamoto contiene 304 frases revisadas de los 11 episodios suministrados: 608 ejercicios japonés→español y español→japonés. Comparten los mecanismos habituales de progreso, EXP, furigana, diccionario, preguntas con IA y preparación de la lección diaria.

## Procedencia y revisión

`data/collections/sakamoto-audit.json` documenta el archivo original mediante hash, episodios, descartes y clasificación. Los niveles se derivan de las referencias de frecuencia de la aplicación; no constituyen una clasificación oficial JLPT. Se descartó contenido con transcripción o contexto insuficiente y vocabulario sin referencia fiable para nivelarlo.

`sakamoto-final-review.json` registra las exclusiones y correcciones finales. `sakamoto-final-validation.json` identifica el cotejo directo realizado en Codex: la comprobación externa adicional no terminó, por lo que no se atribuye su aprobación al servicio. Las dos revisiones principales sí terminaron.

## Herramientas de mantenimiento

- `scripts/import-study-collection.py`: lectura del ZIP, filtrado y revisión editorial reanudable. Requiere un directorio privado de checkpoints y `JAPOTEACHER_EDITORIAL_KEY` para las llamadas autorizadas. Nunca procesa vídeos.
- `scripts/publish-study-collection.py`: genera el bloque a partir de los checkpoints revisados y del ZIP de referencia de frecuencia, sin llamadas API.
- `scripts/verify-study-collection-final.py`: comprobación externa opcional de correcciones, con el mismo registro de presupuesto. No debe ejecutarse sobre esta importación, cuyo presupuesto está cerrado.

El registro privado reserva un máximo antes de enviar cada petición, conserva las reservas de peticiones sin respuesta y bloquea nuevas llamadas al alcanzar el límite o cerrar el registro. `sakamoto-token-audit.json` resume esta importación: 1.441.694 tokens confirmados y 1.914.659 contando todas las reservas, frente al máximo de 2.000.000. No reabrir este presupuesto ni eliminar sus reservas para reintentar.
