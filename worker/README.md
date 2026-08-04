# Worker de evaluación OpenAI

Este Worker mantiene la clave de OpenAI fuera de GitHub Pages y limita el acceso mediante origen y sesiones verificadas de Supabase.

## Configuración

Desde esta carpeta ejecuta:

```powershell
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

En `secret put`, pega tu clave de OpenAI cuando Wrangler la solicite.

La URL del Worker está configurada en la aplicación. Cada solicitud envía el token temporal de Supabase del usuario conectado; no hay datos técnicos que introducir en los dispositivos.

No escribas los secretos en `wrangler.toml`, JavaScript, GitHub ni archivos del proyecto.
