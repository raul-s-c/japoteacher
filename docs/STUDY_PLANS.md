# Planes de estudio

Hoy muestra planes independientes por contenido y dirección: N5, N4, N3, N2, N1 y colecciones como Sakamoto. Los planes de nivel usan el banco general; Sakamoto tiene su propio plan, sin duplicar su contenido en los planes generales.

Cada tarjeta muestra repasos y nuevas asignadas hoy, completadas, pendientes de aprender, estudiadas y dominadas. «Ver frases» permite explorar y filtrar el contenido con traducción y furigana; consultarlo no modifica el progreso.

## Ritmo de cada plan

- **Máximo total al día**: incluye nuevas y repasos, también lo ya respondido hoy.
- **Máximo de nuevas al día**: limita las frases todavía no estudiadas. Es un máximo, no una cantidad garantizada.
- **Repasos primero**: regla fija; las nuevas entran solo en el espacio restante y respetan los máximos diario y semanal.
- **Pausar**: deja de asignar pendientes; conserva historial y borradores.
- **Opciones avanzadas**: solo repasar, tamaño de tanda, límite semanal de nuevas (0 significa sin límite; semana de lunes a domingo), dificultad gradual. Las colecciones permiten escoger niveles.

Los repasos se seleccionan siempre de menor a mayor media de las tres últimas notas válidas disponibles, aunque su fecha SRS sea futura. Las fechas son orientativas y no dan prioridad a una frase vencida. Las tres últimas notas válidas de 95 o más retiran esa frase del repaso automático; un resultado posterior inferior a 95 la devuelve a la cola. El criterio es independiente por perfil y dirección. No se repite automáticamente una frase ya respondida hoy, ni una suspendida, ni una marcada manualmente como dominada mientras dure su aplazamiento. La dificultad gradual puede dejar frases nuevas todavía bloqueadas; la tarjeta lo explica. Una tanda menor que el máximo diario permite dividir el estudio en varias sesiones. Llegar al máximo no implica haber dominado el contenido.

## Migración y cambios

La primera apertura transforma los niveles y cuotas anteriores en planes por dirección, repartiendo sus límites diarios. Conviene revisar los límites de cada tarjeta. La migración es idempotente y conserva intentos, notas, EXP y SRS; los ajustes por plan se sincronizan en el almacén de ajustes existente.

«Recalcular pendientes» reselecciona según los criterios actuales. No borra respuestas ni borradores, ni recupera el cupo de nuevas ya consumido. El trabajo conservado fuera de un plan activo sigue siendo accesible. Los porcentajes globales de nuevas y colecciones dejan de estar visibles; Ajustes conserva preferencias generales, cuenta y apartados avanzados de IA y datos.

«Cambiar frase» abre inmediatamente un diálogo con fácil, repetida o difícil. La sustitución se limita al mismo plan y tipo de selección. Si no hay alternativa apta, lo indica dentro del diálogo.

## Mnemotecnias

La opción aparece después de cualquier corrección válida. La instrucción de generación favorece asociaciones concretas entre significado, sonido y componentes reales conocidos del kanji; distingue una ayuda imaginada de una regla lingüística o etimología. «Probar otra asociación» solicita una alternativa expresamente. No se generan imágenes ni consejos automáticamente.

## Validación

`tests/study-plans.test.mjs` comprueba límites, migración, repasos, conservación, cambios de nivel y sustituciones. `tests/study-plans-mobile.cjs` prueba la interfaz completa a 390 y 1280 px con el banco real y evaluación simulada. `tests/mnemonic-mobile.cjs` comprueba generación a petición, alternativa y persistencia con API simulada. No se realizan llamadas reales a OpenAI en estas pruebas.


## Rondas de refuerzo (18/09/2026)

Cada tanda termina cuando todas sus frases alcanzan al menos 50. Al terminar una ronda, las frases cuya última respuesta de esta sesión sigue por debajo de 50 se barajan y forman la siguiente ronda, sin límite de rondas. Se consulta la nota guardada después de los ajustes manuales. 50 exacto permite terminar; una corrección inválida no avanza. La ronda y su orden se guardan para retomarlos al reabrir. Los refuerzos añaden intentos al historial, pero no consumen más frases distintas ni cupo de nuevas.

La prioridad de otro día usa la media aritmética de las tres últimas notas válidas disponibles, incluyendo los intentos de refuerzo y los ajustes manuales: una nota se divide entre 1, dos entre 2 y tres entre 3. No se redondea para ordenar. La exclusión por tres notas recientes >=95 y los aplazamientos manuales siguen vigentes.
