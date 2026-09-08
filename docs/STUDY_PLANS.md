# Planes de estudio

Hoy muestra planes independientes por contenido y dirección: N5, N4, N3, N2, N1 y colecciones como Sakamoto. Los planes de nivel usan el banco general; Sakamoto tiene su propio plan, sin duplicar su contenido en los planes generales.

Cada tarjeta muestra repasos y nuevas asignadas hoy, completadas, pendientes de aprender, estudiadas y dominadas. «Ver frases» permite explorar y filtrar el contenido con traducción y furigana; consultarlo no modifica el progreso.

## Ritmo de cada plan

- **Máximo total al día**: incluye nuevas y repasos, también lo ya respondido hoy.
- **Máximo de nuevas al día**: limita las frases todavía no estudiadas. Es un máximo, no una cantidad garantizada.
- **Repasos primero**: las nuevas entran cuando caben los repasos disponibles.
- **Pausar**: deja de asignar pendientes; conserva historial y borradores.
- **Opciones avanzadas**: solo repasar, tamaño de tanda, límite semanal de nuevas (0 significa sin límite; semana de lunes a domingo), separación mínima entre repasos y dificultad gradual. Las colecciones permiten escoger niveles.

Los repasos respetan su fecha SRS y la separación del plan. La dificultad gradual puede dejar frases nuevas todavía bloqueadas; la tarjeta lo explica. Una tanda menor que el máximo diario permite dividir el estudio en varias sesiones. Llegar al máximo no implica haber dominado el contenido.

## Migración y cambios

La primera apertura transforma los niveles y cuotas anteriores en planes por dirección, repartiendo sus límites diarios. Conviene revisar los límites de cada tarjeta. La migración es idempotente y conserva intentos, notas, EXP y SRS; los ajustes por plan se sincronizan en el almacén de ajustes existente.

«Recalcular pendientes» reselecciona según los criterios actuales. No borra respuestas ni borradores, ni recupera el cupo de nuevas ya consumido. El trabajo conservado fuera de un plan activo sigue siendo accesible. Los porcentajes globales de nuevas y colecciones dejan de estar visibles; Ajustes conserva preferencias generales, cuenta y apartados avanzados de IA y datos.

«Cambiar frase» abre inmediatamente un diálogo con fácil, repetida o difícil. La sustitución se limita al mismo plan y tipo de selección. Si no hay alternativa apta, lo indica dentro del diálogo.

## Mnemotecnias

La opción aparece después de cualquier corrección válida. La instrucción de generación favorece asociaciones concretas entre significado, sonido y componentes reales conocidos del kanji; distingue una ayuda imaginada de una regla lingüística o etimología. «Probar otra asociación» solicita una alternativa expresamente. No se generan imágenes ni consejos automáticamente.

## Validación

`tests/study-plans.test.mjs` comprueba límites, migración, repasos, conservación, cambios de nivel y sustituciones. `tests/study-plans-mobile.cjs` prueba la interfaz completa a 390 y 1280 px con el banco real y evaluación simulada. `tests/mnemonic-mobile.cjs` comprueba generación a petición, alternativa y persistencia con API simulada. No se realizan llamadas reales a OpenAI en estas pruebas.
