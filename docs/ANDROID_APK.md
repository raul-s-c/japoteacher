# JapoTeacher Android APK

La APK debe ser un contenedor nativo ligero sobre la app web publicada. La lógica de progreso, SRS, noticias, Tutor IA, Lupa IA y sincronización sigue viviendo en la PWA y en el Worker; la capa Android solo añade capacidades que el navegador no puede ofrecer bien.

## Objetivo

- Mantener una sola fuente de verdad: GitHub Pages + Worker + Supabase.
- No duplicar IndexedDB ni reimplementar el progreso en Android.
- No guardar claves en la APK.
- Permitir actualizaciones nativas desde la propia app mediante `android-version.json`.

## Actualizaciones

La app consulta `android-version.json` desde Ajustes. Si `versionName`/`version` es superior a la versión nativa embebida, o `versionCode` es superior al código nativo embebido, y `apkUrl`/`apk_url` contiene una URL, se muestra el botón `Descargar APK`.

El patrón puede ser el mismo que `raul-s-c/nubeplay-releases`: repositorio público usado como canal de distribución, APKs versionadas como archivos y un manifiesto JSON apuntando al último APK mediante URL raw.

Ejemplo para una release real:

```json
{
  "versionCode": 1,
  "versionName": "1.0.0",
  "version": "1.0.0",
  "apkUrl": "https://raw.githubusercontent.com/raul-s-c/japoteacher-releases/main/JapoTeacher-1.0.0-arm64.apk",
  "apk_url": "https://github.com/raul-s-c/japoteacher/releases/download/android-v1.0.0/japoteacher.apk",
  "sha256": "...",
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

En este equipo se detecta Java y Android SDK en `C:\Users\rauls\AppData\Local\Android\Sdk`. Lo que no existe todavía en este repositorio es un proyecto Android/Gradle versionado (`android/`, `gradlew`, `build.gradle`) ni una configuración Bubblewrap/TWA guardada.

Para producir una APK desde aquí hay dos rutas válidas:

1. Crear y versionar un contenedor Android/TWA dentro del repo, con Gradle wrapper incluido.
2. Repetir un flujo externo tipo Bubblewrap/PWABuilder usando el SDK local y publicar el APK resultante como archivo en un repo de distribución, igual que `nubeplay-releases`.

El canal de actualización ya está preparado; cuando haya una APK real, basta con publicar el archivo y actualizar `android-version.json`.
