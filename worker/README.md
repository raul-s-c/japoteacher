# Worker de evaluación OpenAI

Este Worker mantiene la clave de OpenAI fuera de GitHub Pages y limita el acceso mediante origen y sesiones verificadas de Supabase.

## Configuración

Desde esta carpeta ejecuta:

```powershell
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put BRAVE_SEARCH_API_KEY
npx wrangler deploy
```

En `secret put`, pega la clave correspondiente solo cuando Wrangler la solicite. `OPENAI_API_KEY` alimenta correcciones, tutor e informes; `BRAVE_SEARCH_API_KEY` alimenta la pestaña `Noticia del día`.

La URL del Worker está configurada en la aplicación. Cada solicitud envía el token temporal de Supabase del usuario conectado; no hay datos técnicos que introducir en los dispositivos.

No escribas los secretos en `wrangler.toml`, JavaScript, GitHub ni archivos del proyecto.
