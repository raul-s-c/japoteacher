# JapoTeacher Lupa · Windows

Aplicación portable para Windows 10/11 x64. Descomprime **toda** la carpeta y ejecuta `JapoTeacher-Lupa.exe`. No requiere instalar Node ni un paquete de idioma OCR.

Inicia sesión en **Ajustes y cuenta** con tu cuenta de JapoTeacher. El servicio mantiene una sesión activa: si usabas el móvil, puede pedirte traer la sesión a este PC.

- **Ctrl + Mayús + L** o burbuja: recorta una zona de la pantalla donde está el puntero. Arrastra para seleccionar; Esc cancela. Compatible con monitores con diferente escala; cada recorte pertenece a una pantalla.
- **Ctrl + Mayús + V** o Pegar imagen: analiza una imagen del portapapeles. Puedes usar previamente **Win + Mayús + S**.
- **Abrir imágenes**, arrastrar archivos o pegar una imagen en el panel. Hasta diez capturas en cola, procesadas una a una.
- Arrastra los tres puntos de la burbuja para moverla. Clic derecho abre los resultados. El panel se mueve y redimensiona como una ventana normal y puede mantenerse encima.
- **Minimizar** y la X de Windows dejan la burbuja funcionando. **Cerrar la lupa…** en ajustes o en la bandeja pide confirmación y termina la aplicación.

## Modos

**Visión** envía el recorte al servicio de IA. **OCR local** usa Tesseract japonés incluido y envía solo el texto reconocido; no cambia automáticamente a visión si falla. En manga puedes activar texto vertical. El OCR depende de la tipografía y calidad del recorte.

**Analizar al recibir** evita confirmaciones repetidas. **Recibir automáticamente nuevas imágenes del portapapeles** está desactivado por defecto; al activarlo, solo recoge imágenes nuevas mientras la aplicación está abierta. Con ambas opciones activas se envían automáticamente según el modo elegido. No monitoriza texto ni captura pantallas continuamente.

Necesita internet para abrir el panel, iniciar sesión y consultar IA. El OCR se ejecuta localmente. Usa el mismo servicio y formato de análisis que Android: traducción, explicación, gramática, furigana, vocabulario, notas, preguntas posteriores e historial.

## Guardado

Cada análisis conserva sus frases potenciales como `pending_editorial_review`. Se guardan primero en IndexedDB dentro del perfil persistente de Windows y después mediante la sincronización habitual de JapoTeacher. No se convierten automáticamente en ejercicios aprobados. Los mensajes posteriores también se guardan.

Si falla el análisis, la imagen queda preparada para reintentar. Las imágenes pendientes están en memoria: un cierre completo las descarta, previa confirmación; el historial ya guardado permanece. No se escribe una galería de capturas de pantalla. El perfil se almacena bajo `%APPDATA%/japoteacher-lupa`.

## Compilar

```powershell
cd desktop
npm ci
npm start
npm run package
```

Salida: `desktop/dist/JapoTeacher-Lupa-win32-x64/`. Electron 44.4.3, Tesseract.js 7 y datos japoneses locales. Se conservan las licencias de las dependencias en el paquete. El ejecutable no está firmado digitalmente.

La página `desktop-lens.html` y el módulo `src/lens.js` se publican junto a la PWA; el ejecutable carga únicamente esa página autorizada. No se permite Node en el renderizador ni navegación externa, y cada operación nativa valida ventana, frame y URL. El modo de servidor local y perfil aislado está deshabilitado al empaquetar.

## Validación 20-09-2026

Recorrido con Electron real y perfil aislado: importación, visión con respuestas simuladas, modo manual, error/reintento, persistencia de candidatos tras recarga, OCR japonés real, portapapeles manual y automático sin duplicados, recorte nativo, minimizar con X y cancelar el cierre. Sin consultas reales a OpenAI. Pendiente de confirmar con la cuenta del usuario la sincronización entre Windows y Android; se reutiliza el mecanismo existente.
