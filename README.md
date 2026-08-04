# Japoteacher

PWA estática para practicar traducción entre japonés y español con dos baterías independientes, sesiones diarias persistentes, evaluación multidimensional con OpenAI y repetición espaciada.

## Ejecutar en local

IndexedDB funciona al abrir `index.html`, pero la carga automática del CSV y el service worker necesitan HTTP. La forma recomendada es:

```powershell
python -m http.server 8080
```

Después abre `http://localhost:8080`. No hay dependencias, framework ni proceso de build.

## Flujo de uso

1. En **Hoy**, inicia una dirección o continúa el plan estable de la fecha local.
2. Responde y usa **Corregir**. Con el Worker configurado, `gpt-5.4-mini` evalúa con razonamiento bajo y JSON Schema estricto. También puedes seleccionar el modo simulado.
3. Tras una evaluación válida se guarda un intento inmutable y se actualizan el progreso por ejercicio, tags y SRS.
4. En **Progreso**, revisa evidencia por dirección y tags o exporta `attempts_export.csv` con BOM UTF-8.
5. En **Ajustes**, importa otro CSV, cambia cantidades y niveles o descarga `full_backup.json`.

El banco inicial contiene 10 ejercicios `ja_es` y 10 `es_ja` diseñados de forma independiente.

## Publicar en GitHub Pages

1. Integra la rama en `main` y súbela a GitHub.
2. En **Settings → Pages**, elige **GitHub Actions** como fuente.
3. El workflow `.github/workflows/deploy-pages.yml` publica todo el repositorio sin build.

## Configurar OpenAI

La clave de OpenAI **no se coloca en `index.html`, `app.js`, Ajustes ni GitHub**. Se configura como secreto cifrado de un Cloudflare Worker:

```powershell
cd worker
npm install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put PROXY_TOKEN
npx wrangler deploy
```

Cuando `wrangler secret put OPENAI_API_KEY` lo solicite, pega tu clave de OpenAI. Para `PROXY_TOKEN`, usa una contraseña aleatoria larga diferente.

Después, en **Japoteacher → Ajustes → Evaluación con IA**:

- Proveedor: `OpenAI`.
- URL del Worker: la URL desplegada seguida de `/evaluate`.
- Token privado del proxy: el mismo valor usado en `PROXY_TOKEN`.

La configuración completa está en [worker/README.md](worker/README.md).

## Seguridad

No se incluyen claves. `OPENAI_API_KEY` solo existe en Cloudflare. El token del proxy se guarda en IndexedDB en tu navegador, no se cachea ni se incluye en backups. El Worker restringe orígenes y exige autorización antes de consumir créditos.

## Cuenta y sincronización

La aplicación usa Supabase Auth para continuar una sesión en otro dispositivo. Antes del primer uso, ejecuta [`supabase/schema.sql`](supabase/schema.sql) en **Supabase → SQL Editor**. La tabla tiene RLS: cada usuario solo puede leer y modificar su propio estado.

Después, crea una cuenta desde **Ajustes → Cuenta y sincronización** e inicia sesión con la misma cuenta en el PC y el móvil. El token privado del proxy de OpenAI no se sincroniza y debe introducirse una vez en cada dispositivo.

Consulta [Arquitectura](docs/ARCHITECTURE.md), [decisiones](docs/DECISIONS.md) y la [especificación de evaluación](docs/AI_EVALUATION_SCHEMA.md).
