# Japoteacher

PWA estática para aprender traduciendo frases en dos direcciones independientes:

- japonés → español (`ja_es`);
- español → japonés (`es_ja`).

La aplicación combina sesiones adaptativas, SRS, evaluación mediante OpenAI, furigana, historial detallado y sincronización robusta entre dispositivos mediante Supabase. No utiliza un framework ni necesita compilación.

## Estado de relevo — 29 de agosto de 2026

La versión publicada y estable está en `main`. Informes, termómetro, progreso por dirección, Tutor IA, Noticia del día, incidencias, EXP ranked y SRS equilibrado están implementados como base funcional. La deuda abierta se concentra en ampliar banco editorial y en validar manualmente sincronización real entre PC y móvil tras cada cambio de esquema.

### Actualización de implementación — 9 de agosto de 2026

- El termómetro se muestra en selector, práctica, historial y detalle temático. El planificador lo usa como ajuste gradual dentro del nivel JLPT, sin sustituir el nivel curricular.
- El progreso, historial, informes y drill-down temático respetan el filtro de dirección. La comparativa muestra dos rutas temáticas independientes y los desbloqueos se calculan por dirección.
- La navegación comparte un único ciclo de actualización entre pestañas. En Progreso, los tags se agrupan por categoría y solo se muestran las tres prioridades con más evidencia y margen de mejora.
- Los informes se pueden generar bajo demanda desde Progreso y se presentan como resumen, métricas por dirección, fortalezas, prioridades y plan de acción. El Worker programa un cierre semanal y mensual idempotente.
- La pestaña `Tutor IA` es un espacio independiente del SRS: permite enviar texto en español o japonés, obtener una explicación docente extensa de la traducción natural, kanji, lecturas, vocabulario y estructura gramatical, y continuar con preguntas contextuales sobre esa misma traducción.
- La pestaña `Lupa IA` es una herramienta separada para analizar japonés externo a la app. Permite elegir entre modo `Solo texto`, que ahorra tokens y no envía imágenes, y modo `Visión + OCR`, que envía una captura reducida al Worker para extraer y explicar el texto. En la APK nativa, la traducción y un resumen aparecen directamente sobre la aplicación que se estaba leyendo; gramática, vocabulario y notas quedan en secciones plegables y se puede repreguntar sin abandonar la lectura. Guarda historial sincronizado del análisis, contexto, OCR, traducción, vocabulario y conversación, pero no guarda la imagen completa en el estado de progreso.
- Cada análisis de la lupa conserva también sus `reusable_phrase_candidates_json`, `candidate_count`, `candidate_source` y `candidate_status`. Los candidatos nacen como `pending_editorial_review`: son material potencial para futuras generaciones, no ejercicios publicados ni evidencia de cobertura hasta superar el filtro editorial y la calibración habituales.
- Ajustes incluye un canal de actualización APK basado en `android-version.json`. Cuando exista una APK nativa publicada, la app mostrará versión disponible, notas y enlace de descarga sin que el usuario tenga que buscar releases manualmente.
- La pestaña `Noticia del día` usa Brave Search desde el Worker para localizar una noticia reciente y OpenAI para reescribirla como lectura japonesa graduada por JLPT y tramo alto/medio/bajo, con furigana, vocabulario y explicación gramatical. Las preguntas de comprensión pueden alternarse entre japonés y español, se responden una a una y el Worker corrige cada respuesta con IA.
- Las noticias se almacenan como cantera editorial local/sincronizada, incluyendo fuente, lectura, vocabulario, gramática, preguntas y frases candidatas para revisar antes de futuras tandas de generación.
- Las respuestas de comprensión de noticias se guardan como evidencia de estudio con score, nivel, dificultad, tags y delta de EXP ranked reducido frente a una frase completa.
- Los fallos léxicos detectados en noticias o correcciones diarias alimentan un micro-SRS de palabras/kanji fallados en la pestaña Hoy.
- Las migraciones `003` a `006` y `009` crean el almacenamiento, permisos, historial, borrado y métricas de EXP de informes. Aplícalas después de `002_atomic_sync.sql` antes de activar el backend de informes.
- Cada intento conserva un ledger de EXP ranked: delta, posición antes/después, JLPT, dificultad, familias y repetición. Esto permite recalibrar la fórmula en el futuro sin perder evidencia histórica.
- Se añadieron pruebas unitarias para la independencia direccional de la ruta temática y para los periodos semanal/mensual.

### Banco editorial actual

- Fuentes editoriales aprobadas: 667 pares N5 y 864 pares N4, verificadas sin incidencias por `scripts/audit-editorial-pairs.py`.
- Total publicado en `data/exercises.full.csv`: 4.052 ejercicios; 3.552 están activos (777 N5 y 999 N4 por dirección) y 500 se conservan archivados.
- La ampliación del 30 de agosto usó 1.008.622 tokens y `japanese_usage_progress_v2_csv.zip` para priorizar deuda de vocabulario/kanji de uso real. Añadió 18 pares N5 y 66 pares N4, con revisión adversarial, deduplicación, calibración y furigana.
- El termómetro se recalibra en lotes pequeños y deja checkpoint y consumo en `data/editorial/`; si se agota un presupuesto, solo se aplican las puntuaciones realmente revisadas y el resto queda pendiente de la siguiente tanda.
- Ficheros fuente: `data/editorial/n5-approved.jsonl` y `data/editorial/n4-approved.jsonl`.
- La app solo contiene traducción JP→ES y ES→JP. No se deben añadir otros tipos de ejercicio.

### Plan de cobertura editorial

Los objetivos se expresan en ejercicios publicados, contando JP→ES y ES→JP por separado. Se trabajará hacia el límite alto del rango razonable para que el SRS tenga suficiente variedad durante años de práctica.

A partir de `japanese_usage_progress_v2_csv.zip`, la generación nueva se rige por cobertura de uso real, no solo por volumen bruto. Cada nivel JLPT simulado tiene una lista de vocabulario, kanji y gramática de referencia; el bloque de un nivel no se considera completo hasta que cada palabra y cada kanji objetivo aparezcan al menos 2 veces, preferiblemente 3, en frases naturales y con el sentido indicado por la referencia. Las expresiones gramaticales pueden aparecer con mayor frecuencia, pero deben mantenerse equilibradas según su peso de uso.

Antes de cada tanda editorial de tokens, el generador debe calcular la deuda de cobertura del nivel: términos con 0 usos, después términos con 1 uso, y por último elementos sobrerrepresentados que conviene evitar. Las frases JP→ES se crean para entrenar comprensión real de esos elementos; las frases ES→JP se diseñan a la inversa, como estímulos en español que obligan a producir el vocabulario, kanji y patrón japonés objetivo. Cada frase futura debería declarar los `Word_ID`, `Kanji_ID` y `Grammar_ID` que cubre para que el SRS y los informes puedan explicar por qué aparece.

Una frase no debe rechazarse solo porque, al cubrir vocabulario/kanji objetivo N5, use una construcción que se acerque a N4. Si la frase es natural, correcta, no duplicada y cubre los objetivos, se publica como elemento puente con tag `n5_to_n4_bridge` y dificultad alta dentro de N5. Se rechazan únicamente frases duplicadas, absurdas, incorrectas, sin equivalencia clara, sin furigana/lecturas completas o que no incluyan el objetivo de cobertura.

Al publicar frases editoriales, la dificultad se recalcula en escala 0-100 a partir de longitud, carga de vocabulario/kanji y marcadores gramaticales puente. Los valores mecánicos antiguos 1-7 no se preservan como porcentajes para evitar ejercicios complejos mostrados como N5/N4 casi 0%.

Para corregir calibraciones claramente incoherentes sin reordenar todo el banco, usa `node scripts/fix-flagrant-calibrations.mjs --write`. Sube mínimos conservadores en patrones puente N5 y estructuras N4 fuertes/moderadas, aplica un suelo pedagógico 8/100 para N5/N4 activos y mantiene el nivel JLPT original.

El SRS debe usar esa misma referencia: no basta con espaciar repeticiones por acierto/error. La selección diaria debe evitar bloques monocordes por tema y priorizar familias, temas, registros, vocabulario, kanji y gramática con poca evidencia. Si una sesión empieza a concentrarse en contextos recurrentes como hospitales o colegios, el planificador debe desplazar prioridad hacia otros contextos con deuda equivalente.

Tras corregir cada intento, el usuario puede marcar la sensación del ejercicio como `muy fácil`, `normal` o `muy difícil`. Esa señal no cambia la evaluación lingüística, pero sí ajusta el SRS: `muy fácil` alarga el intervalo y sube el factor de facilidad; `muy difícil` acorta el próximo repaso, baja la facilidad y evita marcar el ejercicio como dominado.

Antes de pasar al siguiente ejercicio, los fallos léxicos son propuestas, no altas automáticas definitivas. El alumno puede aceptar o rechazar cada término, corregir el japonés o su significado y añadir varios elementos propios pegándolos por líneas, comas o punto y coma. Los kanji y lecturas detectados aparecen también como botones para añadirlos sin teclearlos. Solo los elementos confirmados alimentan el micro-SRS y quedan vinculados al intento.

| Nivel | Objetivo publicado | Estado actual |
| --- | ---: | ---: |
| N5 | 1.400 ejercicios | 1.470 activos |
| N4 | 2.400 ejercicios | 1.820 activos |
| N3 | 4.000 ejercicios | 0 activos |
| N2 | 7.000 ejercicios | 0 activos |
| N1 | 12.000 ejercicios | 0 activos |

Prioridad: cerrar N5 hasta 1.400, profundizar N4 hasta 2.400 y empezar N3 bajo solo cuando aporte transiciones naturales desde N4 alto. N2 y N1 se generarán después de que N3 tenga una base suficiente y calibrada.

## Arranque rápido en el nuevo PC

```powershell
git clone <URL-DEL-REPOSITORIO>
cd japoteacher
python -m http.server 8080
```

Abre `http://localhost:8080`. Si PowerShell bloquea `npm.ps1` o `npx.ps1`, usa `npm.cmd` y `npx.cmd`, o ejecuta los comandos desde `cmd.exe`.

No abras la carpeta `worker` como raíz del servidor: `index.html` está en la raíz de `japoteacher`.

Para verificar el estado antes de tocar nada:

```powershell
git status --short
git log -5 --oneline
node --check app.js
node --check src/reports.js
node --check src/difficulty.js
node --test tests/directional-progress.test.mjs tests/reports-period.test.mjs
```

## Arquitectura actual

```text
GitHub Pages (PWA estática)
  ├─ IndexedDB: ejercicios, intentos, progreso, sesiones y ajustes
  ├─ Supabase Auth: correo y contraseña
  ├─ Supabase user_state: copia JSONB versionada del estado local
  └─ Cloudflare Worker
       ├─ valida JWT de Supabase
       ├─ protege OPENAI_API_KEY
       └─ llama a OpenAI con JSON Schema estricto
```

### Persistencia y sincronización

- `src/db.js`: IndexedDB local. La versión en curso es la 8.
- `src/cloud-sync.js`: sincronización automática y consolidación con Supabase.
- `supabase/schema.sql`: instalación inicial.
- `supabase/migrations/002_atomic_sync.sql`: revisión optimista y sesión activa única.
- `user_state.payload` contiene las colecciones locales. Cada escritura importante se confirma remotamente antes de continuar cuando existe sesión autenticada.
- En el primer acceso de una instalación nueva, un estado remoto existente es autoritativo: no se mezcla con ajustes de fábrica locales. Si la fila de ajustes remota fue reiniciada, se reconstruye desde la última instantánea válida de las sesiones diarias sin alterar intentos, EXP ni SRS.
- No debe existir un botón manual de sincronización: la pantalla debe representar el estado consolidado.
- El sistema de sesión activa permite “traer” la sesión al dispositivo actual y suspende el anterior.

### Evaluación de IA

- Modelo previsto: `gpt-5.4-mini`.
- Razonamiento: bajo.
- Salida: JSON Schema estricto.
- Temperatura baja cuando el endpoint/modelo la admita.
- La clave de OpenAI solo vive como secreto `OPENAI_API_KEY` del Worker.
- El navegador envía el JWT temporal de Supabase; el usuario nunca introduce URL de Worker, clave ni token proxy.
- La política corrige dos fallos ya tratados: un 100 % global debe tener criterios coherentes, y no se penaliza un registro formal/informal que no estuviera marcado en la frase origen.

## Configuración de servicios

### Supabase

El proyecto y la publishable key ya están configurados en `src/supabase-config.js` y `worker/wrangler.toml`. La publishable key es pública por diseño; nunca añadas una service-role key al frontend.

En un proyecto Supabase nuevo, ejecuta en SQL Editor, por orden:

1. `supabase/schema.sql`;
2. `supabase/migrations/002_atomic_sync.sql`;
3. `supabase/migrations/003_learning_reports.sql`;
4. `supabase/migrations/004_learning_reports_service_role.sql`;
5. `supabase/migrations/005_authenticated_learning_reports.sql`;
6. `supabase/migrations/006_learning_report_history.sql`;
7. `supabase/migrations/007_issue_reports.sql`.
8. `supabase/migrations/008_issue_reports_service_role.sql`.
9. `supabase/migrations/009_learning_report_experience.sql`.

En Auth configura la URL pública correcta y las redirect URLs. El error de correo hacia `localhost:3000` se evita configurando el Site URL de producción, actualmente `https://raul-s-c.github.io/japoteacher/`.

### Cloudflare Worker y OpenAI

```powershell
cd worker
npm.cmd install
npx.cmd wrangler login
npx.cmd wrangler secret put OPENAI_API_KEY
npx.cmd wrangler secret put BRAVE_SEARCH_API_KEY
npx.cmd wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx.cmd wrangler deploy
```

### Buzon de incidencias

El boton `!` de la barra superior abre un formulario para describir una incidencia y adjuntar hasta cinco pantallazos de la galeria. El navegador los reduce antes de enviarlos y conserva una cola local cuando no hay red. Al recuperarla, registra una fila privada en `public.user_issue_reports` y guarda los adjuntos en el bucket privado `issue-reports`, segregado por usuario. Este buzon es la fuente de trabajo para revisar y resolver incidencias posteriores; no se exporta en las copias de aprendizaje para no mezclar capturas con el progreso.

Para recuperar la cola desde el entorno editorial, usa `node scripts/fetch-issue-reports.mjs` con `JAPOTEACHER_EDITORIAL_KEY` o `PROXY_TOKEN` en el entorno. El endpoint no es publico y usa el secreto del Worker para leer la tabla; las imagenes siguen siendo privadas en Storage.

No guardes `OPENAI_API_KEY`, service-role keys ni secretos editoriales en Git, JavaScript o documentación. La configuración detallada está en `worker/README.md`.

### Publicación

GitHub Pages publica la raíz mediante `.github/workflows/deploy-pages.yml`. Tras hacer push a `main`, espera el workflow y recarga la PWA. Si el móvil conserva una versión vieja, cierra y abre la app instalada; el service worker usa un nombre de caché versionado.

### APK Android

La APK nativa se trata como contenedor híbrido para capacidades Android que la PWA no puede ofrecer bien: overlay flotante, captura de pantalla de otras apps, OCR local, compartir imágenes desde Android y posibles notificaciones nativas. No debe duplicar la lógica de progreso ni almacenar claves; sigue usando la web publicada y el Worker.

La versión `1.2.3` abre la aplicación en Hoy y añade síntesis japonesa nativa de Android para Escuchar frase. Mantiene la sesión nativa de captura persistente durante el uso de la Lupa. Al activarla, Android pide una vez permiso para compartir la pantalla completa y arranca un servicio visible de tipo `mediaProjection`. Después se puede abrir cualquier app y tocar la burbuja: ésta se oculta, la pantalla se congela y aparece directamente un recorte ajustable, sin volver a JapoTeacher ni repetir el permiso en cada captura. El OCR japonés se hace localmente. La captura vive sólo en la caché privada y se elimina al cerrar el recorte; nunca aparece en la galería. Tras el OCR, el usuario elige entre enviar sólo el texto o texto + recorte para análisis con visión. La respuesta se muestra en una hoja superpuesta sobre la aplicación de lectura con traducción y resumen inmediatos, explicaciones plegables y repreguntas. Todos los pasos respetan las barras del sistema, el recorte de pantalla y el teclado; los botones finales quedan fijos en una zona segura y el contenido central se desplaza.

Cada release nativa se publica como archivo en `releases/android/` dentro de este mismo repo, y después se actualiza `android-version.json`:

```json
{
  "versionCode": 9,
  "versionName": "1.2.3",
  "version": "1.2.3",
  "apkUrl": "https://raw.githubusercontent.com/raul-s-c/japoteacher/main/releases/android/JapoTeacher-1.2.3-arm64.apk",
  "apk_url": "https://raw.githubusercontent.com/raul-s-c/japoteacher/main/releases/android/JapoTeacher-1.2.3-arm64.apk",
  "sha256": "5d08f93bf4011da3aa8da101f7b6d5cfb4e93953467ad11f7c8c98dfb9c8d3a8",
  "published_at": "2026-08-30T00:00:00Z",
  "notes": ["Arranque en Hoy", "Voz japonesa nativa", "Explicación sobre la app de lectura", "Resumen inmediato", "Bloques didácticos plegables", "Repreguntas", "Candidatos editoriales sincronizados"]
}
```

La app consulta ese manifiesto desde Ajustes. Si la versión remota es superior a la versión nativa embebida, muestra el botón `Descargar APK`. Los cambios web normales no requieren APK nueva.

## Funcionalidad estable ya implementada

- cuenta por email/contraseña y continuidad PC/móvil;
- una sesión activa por usuario con transferencia entre dispositivos;
- guardado remoto antes de avanzar al siguiente ejercicio;
- práctica diaria y “estudiar más” con bloques recalculados según aciertos/fallos;
- elección directa de frase desde práctica y desde la ruta temática;
- progreso por tema y JLPT;
- historial completo filtrable, con detalle de respuesta y feedback;
- propuesta correcta, comparación por elementos, japonés correcto, lecturas de kanji y furigana;
- furigana activable durante JP→ES;
- evaluación OpenAI protegida por Worker;
- Lupa IA para texto pegado o capturas con OCR/visión, con historial didáctico aislado del progreso;
- SRS y tags;
- exportación CSV y copia completa.

## Trabajo en curso: informes, dificultad y direcciones

### Requisitos funcionales que no deben perderse

Este bloque recoge literalmente la intención del producto. Se considera la fuente de verdad para continuar estas tres funciones.

#### Informes pedagógicos automáticos

- La app generará mediante la API un informe semanal cada domingo, usando todos los ejercicios realizados durante la semana cerrada.
- El día 1 de cada mes generará otro informe correspondiente al mes natural que acaba de cerrarse. No será una suma superficial de semanas.
- Ambos analizarán errores reales del usuario, estructuras gramaticales, vocabulario, kanji, patrones recurrentes, fortalezas y evolución.
- El resultado no puede ser un mensaje genérico ni un bloque de texto sin diseño. Debe seguir una plantilla visual cuidada, integrada en la app, con tarjetas, gráficos, comparaciones, conclusiones dinámicas y recomendaciones accionables concretas.
- Las recomendaciones deben indicar qué estudiar, por qué, con qué prioridad y qué objetivo medible perseguir durante el siguiente periodo.
- Todo informe distinguirá JP→ES de ES→JP. También incluirá una comparación conjunta, pero nunca mezclará ambas competencias para calcular dominio.
- Cada informe tendrá un apartado de progreso acumulado. Para construirlo, la API recibirá resúmenes estructurados de informes anteriores y comparará tendencias, problemas resueltos, problemas persistentes y nuevos problemas.
- Los informes y sus datos estructurados se almacenarán en la cuenta del usuario y estarán disponibles dentro de la app como historial navegable.
- La ejecución debe ser automática, idempotente y recuperable: un reintento no puede crear ni cobrar dos informes para el mismo usuario y periodo.
- Si no hay suficiente práctica, la app debe indicarlo claramente y evitar conclusiones inventadas. Se definirá un umbral mínimo de evidencia antes de llamar a la API.
- “Enviar el informe” significa, como requisito mínimo, generarlo y dejarlo disponible en la app el domingo o el día 1. Una notificación push o email podrá añadirse posteriormente, pero no debe confundirse con la generación y almacenamiento del informe.

#### Termómetro continuo de dificultad

- Todos los ejercicios del dataset, sin excepciones, tendrán una dificultad continua además de su nivel JLPT.
- El JLPT seguirá siendo la categoría curricular (`N5`, `N4`, `N3`, `N2`, `N1`), pero no será tratado como un único bloque homogéneo.
- El termómetro permitirá distinguir, por ejemplo, un N4 accesible, un N4 medio y un N4 que sirve de puente hacia N3.
- La dificultad no puede calcularse solo por longitud. Debe considerar gramática, vocabulario, kanji, ambigüedad, número de proposiciones, naturalidad exigida, carga de producción y evidencia empírica de los usuarios.
- Existirá una puntuación editorial inicial y, cuando haya evidencia suficiente, una calibración estadística. La calibración nunca sobrescribirá silenciosamente el nivel JLPT curricular.
- El termómetro se mostrará en el selector de frases, durante la práctica, en el historial, en los detalles temáticos y en los informes.
- El planificador adaptativo utilizará esa dificultad para subir o bajar gradualmente dentro de un nivel y para probar el siguiente nivel sin saltos bruscos.
- Antes de darlo por terminado se auditará la distribución completa del banco y se revisarán los valores anómalos.

#### Dominio y SRS independientes por dirección

- JP→ES y ES→JP son dos habilidades distintas. Acertar una frase en JP→ES no puede aumentar el dominio, intervalo SRS, racha, desbloqueo ni estadísticas de su pareja ES→JP.
- Cada dirección mantendrá por separado intentos, score, dificultad observada, estado SRS, próxima revisión, tags, dominio temático y desbloqueos JLPT.
- La selección adaptativa de la siguiente frase se calculará usando únicamente la evidencia de la dirección que se está practicando.
- En Progreso se podrá filtrar toda la información por JP→ES, ES→JP o comparación de ambas.
- La vista comparativa mostrará dos series o barras claramente separadas; no utilizará una media conjunta que oculte diferencias.
- Historial, gráficos, tags, ruta temática, informes semanales/mensuales y progreso acumulado respetarán el mismo filtro.
- Deben existir pruebas automáticas que demuestren que completar o dominar una dirección no modifica la otra.

#### EXP ranked por ruta JLPT

- Cada dirección tiene una ruta continua, mostrada como tramos JLPT: N5 `0-100`, N4 `100-300`, N3 `300-700`, N2 `700-1500` y N1 `1500-3100`. Por tanto, N5 `100/100` es exactamente N4 `0/200`; no son dos contadores aislados ni una EXP que se pierda al cruzar el borde.
- Cada frase ocupa una coordenada dentro de esa ruta, calculada con su JLPT y termómetro. Una respuesta correcta siempre desplaza a la derecha: una frase que queda a la derecha del estudiante tiene mayor multiplicador, y una frase ya a su izquierda sigue sumando, pero menos.
- La política `guided_usability_v2` integra en un mismo ledger traducciones, comprensión de noticias y micro-SRS. La traducción completa tiene peso `1`, una respuesta de noticia `0,65` y una recuperación léxica `0,28`; en los tres casos mandan la nota, JLPT, termómetro, distancia respecto al alumno, novedad y espaciado.
- Repetir una frase el mismo día aporta aproximadamente un 6% de su valor normal. Una frase ya resuelta con 80 o más queda fuera del plan al menos 21 días, y con 90 o más durante 30 días. Los fallos pueden reaparecer antes, pero no en el mismo día y preferentemente mediante transferencia a otra frase del mismo concepto.
- El 50% es el mínimo pedagógico: suma EXP testimonial, mientras que cualquier resultado inferior mueve a la izquierda de forma proporcional. Un fallo en una frase muy a la derecha (exploración del nivel superior) recibe una penalización reducida.
- El desbloqueo no depende de cuatro respuestas. Además de la EXP, exige evidencia distinta en las cinco familias: N5 `12`, N4 `18`, N3 `24`, N2 `32` y N1 `40` frases por familia, con medias mínimas crecientes de `70–78%` y tasas aceptables de `60–70%`. Desde el 80% de EXP, si se cumplen esos requisitos, pueden aparecer frases puente del nivel siguiente.
- Las familias muestran evidencia de aprendizaje (resultado y muestras), no una conversión engañosa de EXP. JP→ES y ES→JP nunca comparten EXP ni desbloqueos.
- La política de EXP está versionada. Los intentos que ya tienen `ranked_xp_version: 1` conservan exactamente el delta registrado; no se reescribe el progreso histórico. Las nuevas acciones usan la versión 2, salvo que el usuario ajuste manualmente una nota, caso en el que solo se recalcula ese intento.
- Leer, abrir una explicación o consultar la lupa cuenta en el resumen de actividad cuando exista un evento guardado, pero no demuestra por sí solo dominio JLPT. El rango solo cambia con una respuesta evaluada, evitando EXP artificial por consumo pasivo.

#### SRS equilibrado

- El SRS reserva al menos el 60% del plan a material no visto cuando el banco lo permite. El resto combina revisiones vencidas, transferencia de debilidades y material puente, puntuando además el desequilibrio por familia, tema, registro, vocabulario, kanji y gramática.
- Las familias o registros con pocas muestras, peor media o escasa práctica reciben prioridad. Dentro de la misma sesión, cada selección reduce temporalmente la prioridad de su propia familia y registro para evitar bloques monocordes.
- El equilibrio se calcula por dirección y solo entre material permitido por la ruta JLPT, por lo que JP→ES y ES→JP siguen siendo rutas independientes.
- Progreso muestra un resumen móvil de los últimos siete días: acciones por modalidad, nota media, EXP neta, ejercicios y términos distintos, días activos y la familia que el planificador priorizará en la siguiente sesión.

### Criterio global de finalización

Esta línea de trabajo se considera funcional en la PWA y el Worker. Queda como validación recurrente comprobar en cuenta real que cada cambio de IndexedDB sincroniza entre PC y móvil, sobrevive a reinstalar/cerrar sesión y muestra el mismo estado consolidado en ambos dispositivos.

### 1. Informes semanales y mensuales

Ya existe una base local:

- store IndexedDB `learning_reports`;
- inclusión en la sincronización cloud;
- `src/reports.js`, que crea borradores locales los domingos y el día 1;
- panel “Informes de aprendizaje” en Progreso.

El resultado final debe ser una tarjeta visual, no texto crudo. Cada informe debe incluir:

- resumen ejecutivo;
- gráficos separados JP→ES y ES→JP;
- evolución frente al periodo anterior;
- errores recurrentes con evidencia;
- estructuras gramaticales y vocabulario prioritarios;
- fortalezas consolidadas;
- acciones concretas para los siguientes 7/30 días;
- bloque acumulado construido a partir de resúmenes de informes anteriores;
- EXP neta, ganada y perdida por dirección y modalidad (traducción, noticias y micro-SRS), con el historial diario de respuestas que la produjo;
- enlaces a los intentos que justifican cada conclusión.

Arquitectura objetivo:

```text
Cron diario del Worker
  ├─ domingo: cierra semana local del usuario
  ├─ día 1: cierra mes anterior
  ├─ operación idempotente por usuario/tipo/periodo
  ├─ agrega intentos + informes previos
  ├─ OpenAI devuelve JSON Schema estricto
  └─ guarda learning_reports en Supabase
       └─ la PWA lo muestra y sincroniza localmente
```

Implementado: el Worker usa el payload consolidado como fuente inicial, tiene cron diario (cierra la semana el lunes y el mes el día 1), estados `pending/generating/ready/failed`, JSON Schema estricto y guardado idempotente. Antes de desplegar solo debes aplicar la migración y configurar `SUPABASE_SERVICE_ROLE_KEY` como secreto del Worker; nunca en el frontend.

### 2. Termómetro continuo de dificultad

La dificultad se calibra en una escala 0–100 independiente para cada combinación de JLPT y dirección. Por tanto, un N5 con 100 sigue siendo más accesible que un N4 con 20; las escalas no se comparan entre niveles.

El termómetro se muestra en selector, ejercicio, historial y detalle temático, y el planificador lo usa como preferencia gradual por dirección. Mantenimiento:

- revisar todos los datos para que `difficulty` sea editorialmente coherente, no solo derivado mecánicamente;
- revisar los valores anómalos que señale `python scripts/audit-difficulty.py`; la auditoría ya informa distribución por JLPT, longitud, gramática, kanji y número de tags;
- documentar que es una estimación pedagógica, no una nota oficial JLPT.

### 3. Progreso independiente por dirección

El almacenamiento ya es independiente:

- los ejercicios JP→ES y ES→JP tienen IDs diferentes;
- `exercise_progress` se identifica por ejercicio;
- `tag_progress` incluye la dirección en su clave;
- los intentos guardan `direction`.

La agregación visual ya respeta el filtro:

- Progreso incorpora el selector “Comparar ambas / JP→ES / ES→JP”;
- `renderProgress()` filtra intentos, progreso, tags, ruta, historial e informes;
- la comparativa muestra dos rutas temáticas separadas y el drill-down conserva la dirección elegida;
- el planificador crea objetivos y desbloqueos por dirección.

Validación recurrente:

- ejecutar la prueba manual de sincronización real en dos dispositivos;
- ampliar la cobertura automatizada al intervalo SRS por dirección, además de la ruta temática ya cubierta.

## Antes de desplegar

1. Ejecutar las pruebas y comprobaciones de sintaxis indicadas abajo.
2. Probar navegación, práctica, Noticia, Tutor, Progreso y Ajustes en viewport móvil.
3. Si hay cambios de stores IndexedDB, probar sincronización entre dos dispositivos con una misma cuenta.
4. Desplegar Worker cuando cambien endpoints o prompts del backend.
5. Hacer push a `main` y esperar GitHub Pages.

## Continuación de la generación editorial

No generar frases mecánicamente. Cada par debe ser natural, útil, coherente por sí mismo, correcto en ambos idiomas, adecuado al JLPT y validado antes de publicarse.

Flujo recomendado:

```powershell
python scripts/editorial-generate.py N4 --token-budget 950000 --usage-baseline <TOTAL_PREVIO>
python scripts/audit-editorial-pairs.py N4
python scripts/publish-editorial-bank.py
python scripts/audit-jlpt-bank.py
python scripts/audit-difficulty.py
```

Para una ampliación adaptada a la evidencia real del alumno, usa `scripts/run-adaptive-editorial-expansion.ps1`. Prioriza Dinero y proyectos, producción ES→JP de base y una rampa N4 de Trabajo/Familia; conserva aproximadamente un 13 % del presupuesto para recalibrar el termómetro y regenerar furigana de lo publicado.

Mientras haya créditos disponibles, el usuario autoriza una tanda editorial diaria de hasta 1.500.000 tokens para generación, revisión, equivalencia bilingüe, recalibración de dificultad, furigana, publicación, auditoría, tests y despliegue. El proceso debe cortar por presupuesto, registrar el consumo y continuar desde los checkpoints, sin regenerar slots ya aprobados.

Consulta antes:

- `docs/content-roadmap-jlpt.md`;
- `data/jlpt-content-policy.json`;
- `docs/BATTERY_PROMPT_TEMPLATE.md`;
- `docs/WORKLOG.md`;
- `data/editorial/manual-overrides.json`.

La reanudación debe continuar desde los JSONL aprobados, no volver a generar los slots existentes. Mantén separada la fase de generación, revisión, equivalencia bilingüe y publicación. El secreto editorial temporal no debe conservarse al terminar.

## Próxima ampliación: frases desde material real

La siguiente ampliación prioritaria será una entrada de texto, noticia o documento para convertir material auténtico en ejercicios. El flujo deberá extraer primero contenido legible, proponer frases autocontenidas y luego pasar cada par por la misma revisión editorial, asignación JLPT, tags, furigana y termómetro de dificultad del banco actual. No se publicará ninguna frase importada directamente ni se mezclará con el banco sin validación humana o editorial.

El alcance inicial debe aceptar texto pegado y URLs de noticias; después podrá incorporar documentos PDF y DOCX. La interfaz debe permitir revisar, editar, descartar y aprobar cada frase antes de añadirla al perfil o al banco compartido. El modo examen queda expresamente fuera de esta fase.

Las lecturas generadas en `Noticia del día` deben tratarse como cantera editorial. Cada noticia debería guardarse con fuente, nivel, artículo japonés reescrito, vocabulario, kanji, gramática, preguntas de comprensión y posibles pares extraíbles. Cuando el usuario pida “crea frases”, el primer paso será revisar esa cola, cribar frases válidas, descartar duplicadas o innecesarias y priorizar las que cubran deuda real de vocabulario, kanji, estructuras o familias poco practicadas.

Las respuestas a preguntas de comprensión de noticias también deben convertirse en evidencia de estudio. La corrección con IA debe devolver score, tags impactados, dificultad aproximada y delta de EXP compatible con la ruta ranked, sin mezclarse con los ejercicios de traducción. Ese ledger servirá para informes y recalibración, igual que los intentos normales.

Además, tras cada corrección diaria, la app debe extraer las palabras, kanji o expresiones concretas falladas y alimentar una sección SRS específica de vocabulario. Si el fallo ocurrió en JP→ES, la tarjeta mostrará el término japonés y exigirá escribir el significado español; si ocurrió en ES→JP, mostrará el estímulo español y exigirá producir japonés. Este SRS de microelementos también debe sumar o restar EXP, pero con peso menor que una frase completa.

## Pruebas y auditorías

```powershell
node --test tests/evaluation-policy.test.mjs
node --check app.js
node --check worker/src/index.js
python scripts/audit-editorial-pairs.py
python scripts/audit-jlpt-bank.py
```

Pruebas manuales mínimas:

1. iniciar sesión en PC y móvil;
2. transferir la sesión activa y comprobar el aviso en el dispositivo suspendido;
3. resolver un ejercicio y confirmar que aparece en el otro dispositivo antes de avanzar;
4. verificar furigana en varias frases con kanji;
5. abrir historial y recuperar respuesta + feedback;
6. practicar una dirección y confirmar que la otra no progresa;
7. probar offline/online y actualización del service worker.

## Archivos clave

- `app.js`: controlador principal y renderizado.
- `src/session-planner.js`: composición de sesiones.
- `src/srs.js`: actualización SRS.
- `src/topic-progression.js`: avance temático.
- `src/cloud-sync.js`: consolidación remota.
- `src/reports.js`: base de informes periódicos en curso.
- `src/difficulty.js`: escala continua en curso.
- `worker/src/index.js`: proxy seguro y endpoints editoriales/evaluación.
- `worker/src/evaluation-policy.js`: reglas de puntuación.
- `data/exercises.full.csv`: banco servido por la app.
- `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/SRS_RULES.md`: diseño existente.

## Seguridad y costes

- Nunca exponer `OPENAI_API_KEY` ni una Supabase service-role key.
- Aplicar RLS a cualquier tabla nueva.
- El cron debe ser idempotente para no facturar dos veces el mismo informe.
- Guardar evidencia agregada y referencias a intentos; minimizar datos enviados a OpenAI.
- Limitar informes acumulados a resúmenes estructurados anteriores.
- Registrar tokens por tarea y cortar por presupuesto configurable.
- La generación editorial diaria queda autorizada hasta 1.500.000 tokens por tanda mientras el usuario indique que hay créditos disponibles.

## Nota sobre archivos locales

`docs/JapoTeacher_plan_multilingue_bajo_demanda.docx` es un documento de idea de negocio y puede aparecer como no rastreado. No lo borres. Decide explícitamente en el nuevo PC si debe añadirse al repositorio.
