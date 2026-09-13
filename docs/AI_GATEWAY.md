# Ruta alternativa de IA

Estado: autorizada explícitamente por el usuario y desplegada el 13/09/2026, versión 1.

El cliente usa primero `https://kvcptfbmhuagzauwoluh.supabase.co/functions/v1/ai-gateway`. La función valida la sesión mediante Supabase Auth y reenvía el token del usuario, identificador del dispositivo y contenido de la consulta al Worker existente. No recibe claves de OpenAI ni usa permisos de administrador. Solo permite las nueve rutas de IA declaradas; excluye editorial, destinos arbitrarios y otros orígenes. Conserva los controles de sesión del Worker. No registra contenido ni credenciales.

La función requiere `verify_jwt=false` porque ofrece `/health` público y realiza autenticación explícita en su cuerpo con `/auth/v1/user` antes de reenviar consultas. El despliegue mediante el conector fue rechazado por auto-review por requerir autorización específica de este flujo y configuración. Tras el consentimiento explícito del usuario, se desplegó por el mismo conector.

El cliente conserva la ruta directa como alternativa ante errores de red, sin reenviar por errores HTTP ni cancelaciones. Como cualquier reintento tras un corte de red, no garantiza ejecución exactamente una vez si se pierde una respuesta después de procesarla. El proveedor y la lógica de corrección siguen siendo los mismos; esto aporta una entrada distinta desde el móvil, no independencia total del backend Cloudflare.

Validación: 156 pruebas Node correctas, incluidos autenticación, restricción de rutas, conservación de controles de sesión y transporte alternativo. Pruebas de navegador con Playwright (Browser plugin not available), perfil aislado y corrección simulada. Validación real: health 200, preflight 204, sesión ausente/inválida 401, ruta editorial 404. Pendiente comprobación de una corrección desde el móvil Digi; no se ha usado una sesión real del usuario en las pruebas.
