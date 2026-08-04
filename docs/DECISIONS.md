# Decisiones

- Las baterías `ja_es` y `es_ja` son independientes; no se generan inversas.
- Los intentos son inmutables y usan UUID.
- La referencia no se trata como la única respuesta válida: el evaluador acepta alternativas conocidas.
- La evaluación conserva dimensiones separadas y calcula una media ponderada.
- El SRS opera por ejercicio; el diagnóstico adicional se agrega por tags y dirección.
- Las claves no forman parte del repositorio, CSV, backup ni caché PWA.
- Se usan scripts clásicos ordenados, no módulos ES, para maximizar la compatibilidad sin build y con apertura local. GitHub Pages sigue siendo el modo recomendado.
- OpenAI es el proveedor predeterminado y `MockEvaluator` permanece como fallback sin coste.
- La clave de OpenAI vive exclusivamente como secreto del Worker. Un segundo secreto protege el proxy público.
- El modelo fijado es `gpt-5.4-mini` con razonamiento bajo y salida JSON Schema estricta.
