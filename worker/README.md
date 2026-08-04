# Worker de evaluación OpenAI

Este Worker mantiene la clave de OpenAI fuera de GitHub Pages y limita el acceso mediante origen y un token privado.

## Configuración

Desde esta carpeta ejecuta:

```powershell
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put PROXY_TOKEN
npx wrangler deploy
```

En el primer comando `secret put`, pega tu clave de OpenAI cuando Wrangler la solicite. En el segundo, introduce una contraseña aleatoria larga distinta de la clave de OpenAI.

Después copia la URL mostrada por Wrangler, añade `/evaluate` y colócala en **Japoteacher → Ajustes → URL del Worker**. Introduce también el mismo `PROXY_TOKEN` en **Token privado del proxy**.

No escribas los secretos en `wrangler.toml`, JavaScript, GitHub ni archivos del proyecto.
