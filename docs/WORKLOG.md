# Registro de trabajo

## MVP inicial

- App shell responsive, cuatro pantallas y referencia visual en `design-concept.png`.
- IndexedDB y backup sin secretos.
- CSV inicial de 20 ejercicios independientes e importador con informe.
- Plan diario persistente con dos colas.
- MockEvaluator, intentos inmutables, SRS y progreso por tags.
- Exportación de intentos y workflow de GitHub Pages.

## Integración OpenAI

- `OpenAiEvaluator` con timeout, reintento y validación.
- Worker seguro para Responses API con clave y token como secretos.
- `gpt-5.4-mini`, razonamiento bajo y JSON Schema estricto.
- Ajustes locales para URL del Worker y token del proxy, excluidos de backups.

## 2026-09-05 — Preparación diaria y arranque

- Añadida «Lección explicativa» antes de las tarjetas de práctica: usa el vocabulario del plan real en ambos sentidos, incluidas frases nuevas y de refuerzo. Generación bajo demanda, traducción por párrafo, furigana, diccionario/explicación contextual, audio y preguntas al tutor. Lecturas divididas en bloques de hasta 20 términos para cubrir planes extensos sin truncarlos.
- Nuevo endpoint autenticado `/daily-lesson`; valida la presencia de cada término (incluida su forma flexionada literal) y cobertura de kanji antes de devolver la lectura. Guarda bloques terminados por cuenta, sesión y contenido del plan en el dispositivo; permite reintentar sin repetir los ya generados. Leer no modifica intentos, SRS ni ejercicios completados.
- Arranque: scripts diferidos, una sola instantánea de ejercicios para Hoy, estadísticas del banco solo al abrir Ajustes, informes después del primer render y eliminación de la espera artificial de navegación. La PWA abre el shell instalado y reutiliza los assets precacheados aunque lleven parámetro de versión; las actualizaciones siguen llegando por el service worker. Se conserva la sincronización previa al plan diario.
- QA: 101 pruebas Node iniciales y 2 pruebas adicionales de caché correctas. Playwright local, banco completo, IA y autenticación simuladas: 1280×900 y 390×844, sin errores de consola ni desbordamiento horizontal; verificados diccionario, preguntas, furigana, lectura guardada, error recuperable y ausencia de cambios en progreso. Comparación de tres aperturas: antes 971/930/947 ms; después 423/408/423 ms. Mediana 947 → 423 ms (55 % menos); no mide la latencia real de sincronización ni de generación IA.
- Publicación autorizada por el usuario: Worker desplegado con versión 5348eaab-0d9b-4096-bbd8-fed39b1a10d7; frontend enviado a main para GitHub Pages. No se ha realizado generación con la cuenta real.

## 2026-09-05 — Corrección de sincronización lenta y lectura incompleta

- La apertura comprueba la revisión devuelta por la reserva de sesión y reutiliza el progreso local solo cuando coincide con una restauración/subida confirmada. Conserva un marcador persistente de cambios pendientes y no espera a subir el historial fusionado para mostrar Hoy. Las peticiones Supabase tienen un presupuesto de red inicial de 12 s, incluido el cuerpo de la respuesta; los heartbeats no se solapan. Las revisiones nuevas siguen descargándose antes del plan.
- La validación de lecciones separa términos pendientes y lecturas de kanji pendientes. Aprovecha las lecturas ya presentes en el diccionario, repara automáticamente lo que falta y conserva una lectura utilizable si la reparación falla. La UI señala exactamente los elementos pendientes y permite completar el bloque guardado sin regenerarlo entero ni afirmar una cobertura completa inexistente.
- QA: suite de 111 pruebas más dos escenarios adicionales de timeout/cambios durante una subida. Playwright con IA simulada verificó lectura parcial → Completar lección → bloque completo, sin duplicados ni cambios en SRS, además de diccionario, preguntas, caché y diseño móvil/escritorio. No se ha medido la conexión real del dispositivo del usuario.


## 2026-09-07 — Ajustes, porcentajes de referencia y selección por bloque

- La barra de nuevas actualiza su porcentaje durante `input`; el guardado local y la reselección no esperan la subida remota. Los cambios consecutivos no restauran porcentajes anteriores.
- «Recalcular el día» está en Hoy y Ajustes. Renueva las pendientes con los criterios actuales y conserva intentos, respuestas, borradores y extras voluntarias.
- Selector preparado para bloques revisados: cuota por dirección (70% de 15 = 11), combinada con nuevas/repasos, niveles, dificultad y enfriamiento. Si faltan frases aptas del bloque se usa banco general y se indica el déficit. La procedencia se muestra en práctica. Las frases del bloque usan los mismos intentos, SRS y EXP.
- Sakamoto figura como pendiente, deshabilitado. NO se han importado ni revisado sus frases: los 11 `.lrpack` siguen siendo archivos de OneDrive no legibles; tres lecturas terminaron con timeout incluso tras marcar la carpeta para disponibilidad local. No hay contenido inventado ni descargas de vídeo. Falta leer los archivos, revisar las traducciones/contexto, deduplicar, clasificar y publicar el JSON del bloque.
- Feedback consulta primero la referencia actual, evitando que un porcentaje incrustado en una frase antigua la sustituya. Resuelve alias por concepto conservando la forma escrita; incluye vocabulario en kana etiquetado y reconocido sin ambigüedad. Etiqueta explícita de frecuencia global y franja derivada, distinta del nivel global de la frase.
- Auditoría: los 10.000 registros de referencia son coherentes con sus franjas y los componentes del CSV de 5.060 ejercicios también. En los 126 ejercicios JA→ES iniciales N5/N4 con dificultad <25, 172/283 entradas de vocabulario están por debajo del top 5%; no el 100%. De los 116 N4, 67 deben su componente más difícil a kanji, 46 a vocabulario y 3 a gramática. No se ha reproducido una palabra concreta del usuario etiquetada N4/top1,3%; ese porcentaje sería N5 según esta referencia. Se mantiene pendiente recibir un ejemplo del dispositivo si persiste.
- Validación: pruebas de cuotas, escasez, conservación de respuestas en ambos sentidos y referencia completa. Prueba de la app en navegador a 360/420/1280 px, recálculo, borradores guardados y sin guardar, extras, recarga y barra con subida remota suspendida. Sin conexión a la cuenta real ni evaluación IA real en estas pruebas.

## 2026-09-07 — Sakamoto importado desde el ZIP y presupuesto cerrado

- El ZIP facilitado posteriormente sí permitió leer los 11 episodios: 3.375 segmentos. Tras filtrado, revisión de autonomía, traducción/anotación, segunda comprobación editorial y cotejo final, se publican 304 frases únicas (608 ejercicios en ambos sentidos). Reparto: N5 34, N4 53, N3 127, N2 75, N1 15. Se excluyen duplicados, fragmentos, referencias insuficientes y transcripciones dudosas; no se ha procesado vídeo.
- Bloque Sakamoto habilitado en Ajustes, con cuota configurable y recálculo de pendientes. Usa el mismo progreso, EXP, diccionario, furigana y vocabulario de la lección diaria. Importarlo no aumenta los requisitos que desbloquean tramos de dificultad; sus respuestas sí aportan evidencia. El nivel sigue el clasificador de frecuencia de la app, no una certificación JLPT oficial.
- La clasificación utiliza el inventario léxico revisado, evitando coincidencias espurias entre palabras (por ejemplo, 時に dentro de 七時に). La carga valida parejas completas, impide duplicados y conserva sus identificadores en recargas. El banco editorial queda fuera del contenido personal sincronizado.
- Límite autorizado: 2.000.000 tokens API de OpenAI. Uso confirmado: 1.441.694; reserva previa: 200.000; ocho peticiones sin respuesta: hasta 272.965. Total conservador: 1.914.659. Registro cerrado, sin más llamadas. La comprobación externa adicional de correcciones finales falló por cortes de conexión; esas correcciones se cotejaron directamente con el japonés en Codex, como documenta `sakamoto-final-validation.json`.
- QA: 125 pruebas Node y 4 de presupuesto correctas. Navegador con datos reales del bloque y cuenta/evaluador simulados: 11 de 15 frases por dirección, vocabulario incluido en la lección, furigana, diccionario, intento puntuado y SRS guardados, recarga sin duplicación, 390/1280 px sin desbordamientos ni errores JS. Apertura local medida: 1.188 ms; no representa la latencia de la cuenta real.

## 2026-09-07 — Consejos mnemotécnicos a petición

- La corrección ofrece «¿Quieres un consejo mnemotécnico?» antes de Siguiente ejercicio cuando hay fallos reales. «Dame un consejo» pide uno o dos trucos centrados en esos errores, con asociación inventada y regla lingüística diferenciadas. No genera imágenes.
- Nueva ruta autenticada `/mnemonic`: contexto acotado a frase, respuesta y hasta seis errores; modelo gpt-5.4-mini sin razonamiento y máximo 850 tokens de salida, con instrucción de no superar 100 palabras. Valida la respuesta, limita tiempos de espera y no reintenta automáticamente.
- Guarda el consejo con el intento y lo muestra en el historial tras recargar. La fusión de sincronización conserva el consejo independientemente de posteriores cambios de nota o dificultad. No modifica SRS, EXP ni notas. Evita peticiones duplicadas en curso y escapa el texto generado al mostrarlo.
- QA: 128 pruebas generales más la prueba de integración del nuevo endpoint correctas (129 en total). Prueba de navegador con API simulada en 390/1280 px: ambos sentidos, ausencia de generación automática, doble clic, persistencia tras recarga, historial, error recuperable, cambio de vista durante petición y ausencia del botón en respuestas sin fallos. Sin errores JS ni desbordamientos. Cero llamadas reales a OpenAI durante desarrollo/pruebas; presupuesto cerrado de Sakamoto intacto.

## 2026-09-07 — Consejo también tras acertar

- La opción mnemotécnica aparece en todas las correcciones válidas, incluidas las respuestas sin errores. En ese caso propone recordar vocabulario o estructura sin inventar fallos. El endpoint acepta errores vacíos; conserva generación a petición, caché e historial.
- Validados los cuatro tests del módulo y el flujo de navegador en móvil/escritorio, incluyendo generar y guardar un consejo tras una respuesta correcta. Sin llamadas reales a OpenAI.

## 2026-09-08 — Planes por contenido y dirección

- Hoy se organiza en planes N5–N1 y Sakamoto independientes por dirección, con pendientes de hoy, por aprender, estudiadas, dominadas y biblioteca filtrable. Cada plan configura máximo total y nuevas; opciones avanzadas de tandas, semana, repasos, dificultad y pausa. Migración idempotente de límites anteriores sin borrar historial.
- Retirados porcentajes globales y niveles del formulario general. Las prácticas y sustituciones permanecen dentro del plan elegido; Cambiar frase abre directamente fácil/repetida/difícil. Recalcular conserva respuestas, borradores y cupos consumidos, incluso al cambiar niveles.
- Mnemotecnias con asociaciones concretas de sonido, significado y componentes conocidos, diferenciadas de etimología. Alternativa guardada mediante Probar otra asociación, solo a petición.
- QA: 136 pruebas Node correctas y flujos de planes y mnemotecnias en navegador a 390/1280 px, con persistencia, migración, límites, sustitución y respuestas correctas. Sin errores JS ni desbordamiento. API simulada: cero llamadas reales a OpenAI, presupuesto de importación intacto.
- Worker publicado: 5dd0796c-0987-47da-9439-5ce596e35bc9. Frontend preparado para GitHub Pages, caché v156. Detalles en STUDY_PLANS.md.

## 2026-09-08 — Marcar una respuesta como dominada

- Botón Dominada en la corrección y en la valoración final. Aplaza 62 días la frase en esa dirección, sin cambiar nota ni EXP ni adelantar un repaso ya más lejano. Cancela Repetir mañana y permite continuar directamente.
- La marca se guarda en intento y progreso, sobrevive a reconstrucciones por ajustes de nota y se fusiona independientemente durante sincronización.
- QA: 139 pruebas Node; prueba de navegador móvil/escritorio de marcado, reconstrucción y recarga con API simulada. Sin llamadas reales a OpenAI. Caché PWA v157.

## 2026-09-08 — Previsión de repasos por plan

- Tabla visible de +1 a +9 días por plan y dirección, con fecha y número de repasos, incluidos ceros. Usa la fecha efectiva SRS y el enfriamiento del plan; excluye nuevas, suspendidas y atrasados de hoy. Explica que las fechas cambian al estudiar y que el máximo diario limita la selección; indica los planes pausados.
- Validación: 140 pruebas Node correctas, incluyendo fechas límite, cambio de año, dirección, enfriamiento y dominio aplazado. Flujo de navegador a 390/1280 px correcto, inspección visual móvil. Sin llamadas API de generación. Caché v158.


## 2026-09-09 — Ampliación editorial con presupuesto separado

- Continuada la tanda interrumpida del día 8 con máximo nuevo de 2.000.000 tokens. Consumo confirmado hoy: 1.911.411; sin reservas pendientes. El ledger anterior conserva sus 184.683 tokens reservados sin confirmar.
- Publicación de 504 frases / 1.008 ejercicios de ambos días, tras revisión, equivalencia, cotejo directo, deduplicación y control de furigana. Banco general: 6.068 ejercicios. Clasificación contextual: N5 43, N4 161, N3 213, N2 79, N1 8 frases.
- Verificación frente a 70a14ae: 5.060 filas y 2.517 lecturas antiguas idénticas. 140 pruebas Node y 2 pruebas de reservas correctas; navegador a 390/1280 px con migración, límites, sustitución, dominio y persistencia. Browser plugin no disponible: Playwright local; API simulada en QA. Caché PWA v159.
- Informes y descartes: data/editorial/summary-2026-09-09-expansion.{json,md}.


## 2026-09-10 — Nueva tanda editorial de hasta 2 millones de tokens

- Presupuesto separado: 1.914.980 tokens confirmados de 2.000.000, sin reservas pendientes. Tanda cerrada por falta de margen para reservar otra petición.
- 344 candidatas aprobadas por IA, 66 descartes finales; incorporadas 278 frases / 556 ejercicios con equivalencia y furigana. Banco general: 6.624 filas, 3.062 frases activas. Distribución nueva: N5 8, N4 79, N3 121, N2 65, N1 5.
- Publicador parametrizado por fecha, baseline y descartes de cada tanda; mantiene el comportamiento histórico del 9 de septiembre. Instrucciones editoriales reforzadas para evitar nombres propios usados como vocabulario, causas inconexas y traducciones con matices añadidos.
- Verificación frente a 2fb81e8: 6.068 filas y 3.021 lecturas antiguas idénticas, sin duplicados nuevos. 140 pruebas Node y 2 de presupuesto pasan. Flujo de planes a 390/1280 px: carga, selección, sustitución, dominio y persistencia correctos; inspección visual móvil. Browser plugin not available: Playwright local y API simulada en QA. Caché v160.


## 2026-09-12 — Widget y lupa continua

- APK 1.3.0 (10): widget nativo, ajustes compartidos de captura rápida/OCR/visión, resultado interactivo junto a burbuja y cierre confirmado desde menú/ notificación. Siguiente recorte toma una imagen nueva; se ocultan las ventanas propias antes de capturar.
- Web: resultado compacto con chat plegable, minimizar y acceso a ajustes; controles de widget y preferencias en Lupa y Ajustes para la APK compatible. Caché v161.
- Compilaciones debug/release correctas y firma de actualización verificada. 140 pruebas Node y QA web 280/330/390 px correctas, API simulada. Browser plugin not available: Playwright local. Pruebas nativas en emulador Android 16: widget, permisos, recorte repetido, panel, preferencias y cierre/cancelación. Detalles en ANDROID_APK.md.


## 2026-09-12 — Tanda editorial de hasta 1,8 millones de tokens

- Presupuesto separado cerrado: 1.621.294 tokens confirmados y 93.158 reservados por una petición incierta; total conservador 1.714.452. No se reutiliza la reserva; margen insuficiente para otra petición completa.
- 236 candidatas, 34 descartes finales: 202 frases / 404 ejercicios incorporados. N5 7, N4 54, N3 78, N2 55, N1 8 según clasificación contextual. Banco general: 7.028 filas.
- Publicador admite --ledger para tandas con presupuesto distinto de 2 millones. Verificación contra 24b4a9e: 6.624 filas y 3.299 lecturas previas idénticas; pares y furigana completos, sin duplicados nuevos.
- 140 pruebas Node, 2 de presupuesto y QA de planes a 390/1280 px correctos. Inspección visual móvil correcta. Browser plugin no disponible: Playwright local con API simulada. Caché v163.
- Contabilidad, revisión y descartes en data/editorial/summary-2026-09-12-expansion.{json,md} y ledger fechado.


## 2026-09-12 — Mapa de conocimientos y normalización

- Mapa local desde Hoy y cada plan: 3.986 conceptos, filtros de plan/dirección/nivel/tipo/estado, búsqueda, conexiones de kanji, bases gramaticales explícitas, zoom, desplazamiento y fichas con ejemplos/furigana/audio/diccionario. Lista equivalente accesible por teclado; 48 nodos por página para móvil.
- Janome 0.5.0 verifica lemas y límites; 4.078 asociaciones de frecuencia retiradas. Separación de frecuencia y nivel pedagógico: 5.992 filas recuperan el JLPT original. IDs, textos, respuestas y lecturas anteriores conservados; progreso personal sin escrituras nuevas.
- Recomendaciones basadas en evidencia de frases, pendientes y conceptos trabajados, separadas por perfil/dirección. Consolidación requiere dos frases y tres fechas con aciertos >=85; un fallo reciente evita consolidación. No se atribuye un fallo global a una palabra individual. Practicar hoy revalida la asignación actual y respeta cupos; el resto es vista previa.
- 146 pruebas Node y 15 Python correctas; QA de mapa y planes a 390/1280 px, API simulada, consola sin errores. Browser plugin not available: Playwright local. Inspección visual y corrección de anchura mínima móvil.
- Prueba concurrente detectó colisión de time_ns en Windows para reservas editoriales: UUID evita sobrescribir reservas; regresión con reloj constante. Sin consumo de API durante este trabajo.
- Caché v164 y versiones de banco/colección actualizadas. El mapa cubre el banco presente y 14 patrones gramaticales; no representa todo el currículo JLPT. Reproducción en docs/KNOWLEDGE_MAP.md.


## 2026-09-12 — Diagnóstico de fallo de corrección móvil

- Verificados health, preflight y POST sin autenticación del servicio público; este último rechaza antes de OpenAI. Tail confirma llegada de la petición de diagnóstico. No se ha observado un reintento del móvil durante la ventana de comprobación: causa específica aún sin confirmar.
- La prueba de ajustes usaba el endpoint fijo mientras la corrección usaba el guardado: ahora comparten endpoint. Health requiere JSON ok=true. Referencia UUID en query de cada petición para correlación sin añadir cabeceras CORS ni registrar credenciales.
- Error de validación local ya no se confunde con red. Se elimina la atribución injustificada a internet del móvil. Error persistente bajo formulario, respuesta/borrador conservados y reintento disponible.
- 150 pruebas Node correctas. QA móvil con fallo simulado confirma mensaje visible, texto conservado y botón disponible; consola sin errores. Browser plugin not available: Playwright local. Sin consumo OpenAI en estas pruebas. Caché v165.


## 2026-09-13 — Ampliación editorial 1,5 M

Consumo cerrado: 1.409.820 tokens / 510 llamadas / sin reservas pendientes. 240 candidatas, 203 frases publicadas (406 ejercicios); niveles revisados 73 N5, 45 N4, 23 N3, 48 N2, 14 N1. Banco 7.434 filas; se conservan las 7.028 anteriores y sus lecturas. Mapa actualizado a 4.112 conceptos / 7.542 ejercicios. Publicador admite revisiones pedagógicas fechadas; constructor del mapa permite versión e informe de auditoría separados. Caché v166. Pasan 150 pruebas Node y 15 Python, además del verificador de preservación y furigana.
Comprobación de navegador correcta a 390 y 1280 px: migración, límites por plan, cambio de frase, filtros/fichas/zoom del mapa e inicio de práctica; captura móvil revisada.


## 2026-09-13 — Entrada alternativa de IA

Tras confirmar certificado ajeno core1.netops.test solo por datos móviles, se añadió ai-gateway en el proyecto Supabase existente. Autorización explícita para el flujo y autenticación interna; despliegue versión 1 activo. El transporte de corrección y herramientas IA usa esta entrada primero y conserva ruta directa ante errores de red. No desactiva TLS ni cambia permisos del Worker. Pasan 156 pruebas Node y QA de navegador a 390/1280 px. Checks reales health 200, OPTIONS 204, sin sesión/token inválido 401 y editorial 404. Caché v167. Prueba con la conexión Digi del usuario pendiente.


## 2026-09-13 — Mnemotecnia por palabra

Campo de objetivo japonés/español disponible tras cualquier corrección y en historial. Cache asociada al objetivo dentro de mnemonic_json; editar permite generar para otra palabra sin reutilizar el consejo anterior. Prompt reescrito para un solo truco concreto, separación sonido/significado, ejemplos y rechazo de asociaciones vacías o componentes inventados. Mantiene techo de 850 tokens. 157 pruebas Node correctas y QA móvil/escritorio, cambio de objetivo y persistencia, con IA simulada. No se ha medido aún la calidad de respuestas reales del nuevo prompt. Worker 49002b4f-245a-4c6e-b755-fa81739b002d, cache v168.


## 2026-09-14 — Ampliación editorial 2,2 M

Nueva autorización independiente de 2.200.000 tokens. Consumo cerrado: 2.106.506 tokens en 753 llamadas, sin reservas pendientes. 348 candidatas revisadas; 247 frases publicadas (494 ejercicios) y 101 descartadas. Niveles editoriales: 60 N5, 70 N4, 34 N3, 63 N2, 20 N1. Banco 7.928 filas, preservadas las 7.434 anteriores y 3.704 lecturas. Mapa 4.274 conceptos / 8.036 ejercicios activos; asociaciones anteriores intactas. Pasan 157 pruebas Node y 15 Python. Caché v169, versión banco/mapa 20260914-editorial-247.
QA de navegador correcta a 390/1280 px: migración, cupos de planes, práctica y mapa (filtros, fichas, zoom y acceso a ejercicios). Captura móvil revisada. IA simulada durante QA; sin gasto adicional de generación.


## 2026-09-15 — Ampliación editorial y cierre de conexión

Presupuesto independiente de 2.200.000 tokens. 769.961 confirmados en 272 llamadas; 14 llamadas sin respuesta conservan reservas de 1.378.441 (máximo conservador 2.148.402). Tras interrupciones repetidas y diagnóstico final UND_ERR_SOCKET, cierre por saldo insuficiente para reservar otra llamada. No se afirma que las reservas sean consumo real. Transporte ahora registra código técnico sin credenciales.
124 candidatas revisadas; 84 pares publicados (30 N5, 16 N4, 14 N3, 20 N2, 4 N1), 40 descartados. Banco 8.096 filas, mapa 4.324 nodos/8.204 ejercicios. Filas, lecturas y asociaciones anteriores intactas. Cobertura conservadora: 39 conceptos menos sin ejemplos, 18 más con dos contextos; 8.163 pendientes de dos. Pasan 157 pruebas Node y 15 Python. Caché v170.
QA de navegador correcta a 390/1280 px: planes, cupos, persistencia, práctica, filtros, fichas y zoom del mapa; IA simulada.


## 2026-09-16 — Repasos por última nota y dominio sostenido

La selección de cada plan pasa a ordenar los repasos por última nota válida ascendente antes de fechas o asignaciones previas, incluso al recalcular. Las fechas SRS quedan orientativas. Tres últimas notas válidas >=95 excluyen el repaso automático; un fallo posterior lo reactiva. Perfil, dirección y frases duplicadas se consideran al consultar historial. Se preservan aplazamientos manuales, suspensión, respuestas/borradores, cuotas diarias y semanales. Se retiran los controles contradictorios de priorizar repasos y descanso entre repasos. La tabla de fechas explica ahora su carácter orientativo. Caché v171; 161 pruebas Node superadas, incluidos casos de 100/100/95, última nota frente a fecha, sesión ya asignada y una nueva máxima.
QA Playwright (Browser plugin not available) con perfil aislado: 390/1280 px, planes, cuotas, guardado y reapertura correctos; escenario N5 con notas 20/45/90, dominio 100/100/95 y máximo una nueva verificado en selección y apertura de ejercicio. Sin errores de página y sin llamadas reales de IA.
La explicación de práctica muestra repaso por última nota para los planes actuales y filtra historial por perfil. Caché final v172.


## 2026-09-18 — Rondas hasta 50 y prioridad por media reciente

PracticeRounds guarda la ronda por perfil, sesión y plan en settings; al acabar baraja solo las últimas notas de la sesión <50. Se releen los intentos después del ajuste manual. El día no se marca terminado mientras queden fallos. Se conserva el registro de frases respondidas para que los refuerzos no reinicien los cupos. Borradores de respuestas ya corregidas se limpian antes de repetir. La selección diaria usa la media sin redondear de las últimas 1–3 notas válidas disponibles por frase y dirección. Textos actualizados, caché v173.
Validación: 167 pruebas Node; navegador Playwright (Browser plugin not available), 390/1280 px, tres rondas, 49 frente a 50, reapertura a mitad de ronda, ajuste manual a 50 y 6 intentos para 3 frases distintas. Evaluación simulada, sin gasto de IA.

## 2026-09-19 — Revisión del CSV aportado

338 candidatas contrastadas con banco y Sakamoto, con revisión directa de traducción, contexto, lecturas y aportación léxica. Publicadas 123 frases / 246 ejercicios: N5 7, N4 28, N3 33, N2 50, N1 5; 215 descartadas. Snapshot independiente y resultados por frase en data/editorial/csv-review-2026-09-19-*. No llamadas OpenAI; colas de generación pendientes sin modificar por este trabajo.
Conservadas las 8.096 filas y 4.035 lecturas anteriores; asociaciones anteriores del mapa idénticas. Banco 8.342 filas, mapa 4.426 nodos / 8.450 ejercicios. Cobertura conservadora: 81 conceptos antes sin ejemplos reciben contexto; 68 adicionales llegan a dos contextos. Caché v174 y banco 20260919-reviewed-123.
Validación: 167 pruebas Node, 15 Python (Janome local), verificador de preservación/pares/furigana y repetición del importador con cero nuevas inserciones. QA de mapa y planes a 390/1280 px, captura móvil inspeccionada y sin errores de página. Browser plugin not available: Playwright con perfil aislado e IA simulada.
