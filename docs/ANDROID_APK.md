# JapoTeacher Android APK

La APK debe ser un contenedor nativo ligero sobre la app web publicada. La lógica de progreso, SRS, noticias, Tutor IA, Lupa IA y sincronización sigue viviendo en la PWA y en el Worker; la capa Android solo añade capacidades que el navegador no puede ofrecer bien.

## Objetivo

- Mantener una sola fuente de verdad: GitHub Pages + Worker + Supabase.
- No duplicar IndexedDB ni reimplementar el progreso en Android.
- No guardar claves en la APK.
- Permitir actualizaciones nativas desde la propia app mediante `android-version.json`.

## Actualizaciones

La app consulta `android-version.json` desde Ajustes. Si `version` es superior a la versión nativa embebida y `apk_url` contiene una URL, se muestra el botón `Descargar APK`.

Ejemplo para una release real:

```json
{
  "version": "1.0.0",
  "apk_url": "https://github.com/raul-s-c/japoteacher/releases/download/android-v1.0.0/japoteacher.apk",
  "published_at": "2026-08-30T00:00:00Z",
  "notes": [
    "Lupa flotante sobre otras apps",
    "Captura de pantalla nativa",
    "Compartir imágenes hacia JapoTeacher"
  ]
}
```

## Capacidades nativas previstas

1. WebView/TWA cargando `https://raul-s-c.github.io/japoteacher/`.
2. Botón flotante opcional para abrir Lupa IA.
3. Permiso de overlay Android para mostrarse sobre otras apps.
4. Captura de pantalla nativa con selección rectangular.
5. Compartir imágenes/texto desde otras apps hacia Lupa IA.

## Qué requiere una APK nueva

- Permisos Android nuevos.
- Cambios en overlay flotante.
- Captura de pantalla nativa.
- Integración con compartir desde Android.
- Notificaciones nativas.

## Qué no requiere APK nueva

- Nuevas frases.
- Cambios de UI web.
- Cambios de SRS.
- Noticias, Tutor IA, informes o prompts del Worker.
- Ajustes del banco editorial.

## Estado local actual

En este equipo se detecta Java, pero no Android SDK ni Gradle global. Para compilar aquí hará falta instalar Android Studio o configurar `ANDROID_HOME`/`ANDROID_SDK_ROOT` y Gradle. Hasta entonces, el canal de actualización queda preparado, pero no se puede producir un APK funcional localmente.
