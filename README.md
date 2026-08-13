# Japoteacher

PWA estática para aprender traduciendo frases en dos direcciones independientes:

- japonés → español (`ja_es`);
- español → japonés (`es_ja`).

La aplicación combina sesiones adaptativas, SRS, evaluación mediante OpenAI, furigana, historial detallado y sincronización robusta entre dispositivos mediante Supabase. No utiliza un framework ni necesita compilación.

## Estado de relevo — 9 de agosto de 2026

La versión publicada y estable está en `main`, commit `c4f381c`. El árbol de trabajo contiene además el inicio, todavía incompleto, de tres mejoras solicitadas:

1. informes semanales/mensuales de aprendizaje;
2. termómetro continuo de dificultad;
3. analítica y dominio separados por dirección.

Estas mejoras se han completado en la PWA local y quedan pendientes de validación final con una cuenta sincronizada en PC y móvil. La generación automática de informes con IA sigue deliberadamente desactivada hasta autorizar presupuesto.

### Actualización de implementación — 9 de agosto de 2026

- El termómetro se muestra en selector, práctica, historial y detalle temático. El planificador lo usa como ajuste gradual dentro del nivel JLPT, sin sustituir el nivel curricular.
- El progreso, historial, informes y drill-down temático respetan el filtro de dirección. La comparativa muestra dos rutas temáticas independientes y los desbloqueos se calculan por dirección.
- La navegación comparte un único ciclo de actualización entre pestañas. En Progreso, los tags se agrupan por categoría y solo se muestran las tres prioridades con más evidencia y margen de mejora.
- Los informes se pueden generar bajo demanda desde Progreso y se presentan como resumen, métricas por dirección, fortalezas, prioridades y plan de acción. El Worker programa un cierre semanal y mensual idempotente.
- Las migraciones `003` a `006` crean el almacenamiento, permisos, historial y borrado de informes. Aplícalas después de `002_atomic_sync.sql` antes de activar el backend de informes.
- Se añadieron pruebas unitarias para la independencia direccional de la ruta temática y para los periodos semanal/mensual.

### Banco editorial actual

- N5: 337 pares semánticos publicados, 674 ejercicios direccionales.
- N4: 547 pares semánticos publicados, 1.094 ejercicios direccionales.
- Total publicado en `data/exercises.full.csv`: 2.268 ejercicios, de los que 1.768 están activos y 500 se conservan archivados.
- La tanda editorial del 13 de agosto añadió 7 pares N5 y 17 N4 en `Dinero y proyectos` (ahorro, banco, pagos, precio, inversión y negocio). Pasó generación, revisión adversarial, equivalencia bilingüe, deduplicación y furigana; consumió 507.105 tokens.
- La siguiente ampliación debe seguir reforzando `Dinero y proyectos`: quedan 10 ejercicios N5 y 26 N4 por dirección, todavía por debajo de las demás familias.
- Fuentes editoriales aprobadas: `data/editorial/n5-approved.jsonl` y `data/editorial/n4-approved.jsonl`.
- La app solo contiene traducción JP→ES y ES→JP. No se deben añadir otros tipos de ejercicio.

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

- `src/db.js`: IndexedDB local. La versión en curso es la 5.
- `src/cloud-sync.js`: sincronización automática y consolidación con Supabase.
- `supabase/schema.sql`: instalación inicial.
- `supabase/migrations/002_atomic_sync.sql`: revisión optimista y sesión activa única.
- `user_state.payload` contiene las colecciones locales. Cada escritura importante se confirma remotamente antes de continuar cuando existe sesión autenticada.
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

En Auth configura la URL pública correcta y las redirect URLs. El error de correo hacia `localhost:3000` se evita configurando el Site URL de producción, actualmente `https://raul-s-c.github.io/japoteacher/`.

### Cloudflare Worker y OpenAI

```powershell
cd worker
npm.cmd install
npx.cmd wrangler login
npx.cmd wrangler secret put OPENAI_API_KEY
npx.cmd wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx.cmd wrangler deploy
```

### Buzon de incidencias

El boton `!` de la barra superior abre un formulario para describir una incidencia y adjuntar hasta cinco pantallazos de la galeria. El navegador los reduce antes de enviarlos y conserva una cola local cuando no hay red. Al recuperarla, registra una fila privada en `public.user_issue_reports` y guarda los adjuntos en el bucket privado `issue-reports`, segregado por usuario. Este buzon es la fuente de trabajo para revisar y resolver incidencias posteriores; no se exporta en las copias de aprendizaje para no mezclar capturas con el progreso.

Para recuperar la cola desde el entorno editorial, usa `node scripts/fetch-issue-reports.mjs` con `JAPOTEACHER_EDITORIAL_KEY` o `PROXY_TOKEN` en el entorno. El endpoint no es publico y usa el secreto del Worker para leer la tabla; las imagenes siguen siendo privadas en Storage.

No guardes `OPENAI_API_KEY`, service-role keys ni secretos editoriales en Git, JavaScript o documentación. La configuración detallada está en `worker/README.md`.

### Publicación

GitHub Pages publica la raíz mediante `.github/workflows/deploy-pages.yml`. Tras hacer push a `main`, espera el workflow y recarga la PWA. Si el móvil conserva una versión vieja, cierra y abre la app instalada; el service worker usa un nombre de caché versionado.

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

### Criterio global de finalización

Esta línea de trabajo solo se considerará terminada cuando los tres requisitos funcionen con una cuenta sincronizada entre PC y móvil, sobrevivan a cerrar sesión/reinstalar la PWA, tengan pruebas de independencia direccional y muestren el mismo estado consolidado en ambos dispositivos.

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

El termómetro se muestra en selector, ejercicio, historial y detalle temático, y el planificador lo usa como preferencia gradual por dirección. Pendiente:

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

Pendiente:

- ejecutar la prueba manual de sincronización real en dos dispositivos;
- ampliar la cobertura automatizada al intervalo SRS por dirección, además de la ruta temática ya cubierta.

## Antes de desplegar

1. Ejecutar las pruebas y comprobaciones de sintaxis indicadas abajo.
2. Aplicar las migraciones `003_learning_reports.sql` a `006_learning_report_history.sql` en Supabase.
3. Probar el filtro de dirección, el termómetro y la PWA en escritorio y móvil.
4. Probar sincronización entre dos dispositivos con una misma cuenta.
5. Confirmar presupuesto antes de habilitar cron, secreto service-role y llamadas de IA para informes.

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
- No reactivar la generación editorial ni los informes automáticos sin confirmar créditos disponibles.

## Nota sobre archivos locales

`docs/JapoTeacher_plan_multilingue_bajo_demanda.docx` es un documento de idea de negocio y puede aparecer como no rastreado. No lo borres. Decide explícitamente en el nuevo PC si debe añadirse al repositorio.
