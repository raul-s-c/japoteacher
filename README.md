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

Estas mejoras se han guardado como trabajo en curso para continuarlas desde otro PC. Antes de desplegar, completa y prueba la lista de “Trabajo pendiente inmediato”.

### Banco editorial actual

- N5: 300 pares semánticos aprobados, 600 ejercicios direccionales.
- N4: 233 pares semánticos aprobados, 466 ejercicios direccionales.
- Total publicado en `data/exercises.full.csv`: 1.066 ejercicios.
- La generación editorial con API quedó pausada por presupuesto de tokens.
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

- `src/db.js`: IndexedDB local. La versión en curso es la 3.
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
3. la futura migración de informes, todavía pendiente.

En Auth configura la URL pública correcta y las redirect URLs. El error de correo hacia `localhost:3000` se evita configurando el Site URL de producción, actualmente `https://raul-s-c.github.io/japoteacher/`.

### Cloudflare Worker y OpenAI

```powershell
cd worker
npm.cmd install
npx.cmd wrangler login
npx.cmd wrangler secret put OPENAI_API_KEY
npx.cmd wrangler deploy
```

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

Pendiente:

- crear `supabase/migrations/003_learning_reports.sql` con tabla normalizada, RLS, índice `(user_id, period_end desc)` y restricción única por periodo;
- decidir si el Worker lee provisionalmente `user_state.payload` o si se normalizan intentos en Supabase; para empezar, leer el payload evita una migración grande;
- añadir trigger cron a `worker/wrangler.toml` y handler `scheduled()`;
- guardar la service-role key únicamente como secreto del Worker;
- definir el JSON Schema del informe y el prompt editorial;
- implementar reclamación de trabajos, reintentos y estados `pending/generating/ready/failed`;
- completar la UI con gráficos, detalle y estados de error;
- medir tokens y no enviar respuestas completas antiguas: usar agregados y resúmenes previos;
- no activar llamadas automáticas hasta volver a autorizar presupuesto API.

### 2. Termómetro continuo de dificultad

Ya existe `src/difficulty.js`. Convierte la dificultad editorial 1–7 en una escala global 0–100 dentro de bandas solapadas/progresivas:

- N5: 5–39;
- N4: 40–59;
- N3: 60–74;
- N2: 75–89;
- N1: 90–100.

El selector de frases ya empieza a mostrarlo. Pendiente:

- añadir estilos CSS para `.difficulty-meter`;
- mostrarlo también dentro del ejercicio, historial y detalle temático;
- revisar todos los datos para que `difficulty` sea editorialmente coherente, no solo derivado mecánicamente;
- crear auditoría de distribución por JLPT, longitud, gramática, kanji y número de tags;
- usar el score continuo en el planificador adaptativo sin sustituir el nivel JLPT oficial;
- documentar que es una estimación pedagógica, no una nota oficial JLPT.

### 3. Progreso independiente por dirección

El almacenamiento ya es independiente:

- los ejercicios JP→ES y ES→JP tienen IDs diferentes;
- `exercise_progress` se identifica por ejercicio;
- `tag_progress` incluye la dirección en su clave;
- los intentos guardan `direction`.

Lo que mezclaba datos era principalmente la agregación visual. En el trabajo en curso:

- Progreso incorpora el selector “Comparar ambas / JP→ES / ES→JP”;
- `renderProgress()` filtra intentos, tags, ruta y gráficos.

Pendiente:

- enlazar el evento `change` del selector para refrescar inmediatamente;
- comprobar que “dominados” cuenta el progreso correcto incluso con cero intentos locales tras una sincronización;
- adaptar todos los gráficos, informes y drill-downs al filtro;
- mostrar dos barras paralelas por tema cuando se comparen ambas direcciones;
- añadir tests que prueben que acertar JP→ES no modifica dominio, intervalo SRS ni desbloqueos de ES→JP.

## Trabajo pendiente inmediato antes de desplegar el WIP

1. Añadir el listener de `#progressDirection` en `bind()`.
2. Hacer que `LearningReports.ensureDue()` se ejecute después de abrir IndexedDB y sincronizar.
3. Añadir estilos de informes, selector de dirección y termómetro.
4. Mostrar el termómetro en la tarjeta activa de práctica.
5. Crear la migración `003_learning_reports.sql`.
6. Añadir tests unitarios de separación direccional y periodos de informe.
7. Ejecutar `node --check` sobre todo JS modificado.
8. Probar con navegador a 1440 px y móvil, incluyendo PWA instalada.
9. Incrementar la versión de caché si se hacen más cambios de assets.
10. Solo después, commit, push y verificación de GitHub Pages.

## Continuación de la generación editorial

No generar frases mecánicamente. Cada par debe ser natural, útil, coherente por sí mismo, correcto en ambos idiomas, adecuado al JLPT y validado antes de publicarse.

Flujo recomendado:

```powershell
python scripts/editorial-generate.py
python scripts/editorial-revalidate-pairs.py
python scripts/audit-editorial-pairs.py
python scripts/publish-editorial-bank.py
python scripts/audit-jlpt-bank.py
```

Consulta antes:

- `docs/content-roadmap-jlpt.md`;
- `data/jlpt-content-policy.json`;
- `docs/BATTERY_PROMPT_TEMPLATE.md`;
- `docs/WORKLOG.md`;
- `data/editorial/manual-overrides.json`.

La reanudación debe continuar desde los JSONL aprobados, no volver a generar los slots existentes. Mantén separada la fase de generación, revisión, equivalencia bilingüe y publicación. El secreto editorial temporal no debe conservarse al terminar.

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
