# Mapa de conocimientos

El mapa se abre desde Hoy o «Ver mapa» de un plan. Lee exclusivamente ejercicios activos, con texto coincidente con el índice, y evidencia del perfil/dirección elegidos. No escribe progreso ni inventa prerrequisitos: solo conexiones palabra-kanji, coincidencia en ejemplos y bases gramaticales declaradas. La evidencia de frases es indirecta; consolidación no equivale a certificar dominio de cada concepto.

## Actualizar el banco y el índice

Dependencia de compilación: `python -m pip install -r scripts/requirements-knowledge-map.txt` (Janome 0.5.0, sin dependencia adicional en el navegador).

Después de publicar nuevas frases, ejecutar `python scripts/build-knowledge-map.py`, revisar el diff de metadatos y regenerar las versiones de banco, colección, mapa y caché. El analizador conserva texto, IDs y traducciones. Los nuevos conceptos no indexados se omiten hasta regenerar; nunca se consideran dominados. `scripts/usage-classification.py` también requiere Janome y ya no escanea subcadenas de vocabulario ni convierte frecuencia en JLPT.

El nivel pedagógico histórico se conserva/restaura cuando está disponible: es una estimación editorial. Sakamoto conserva su nivel existente. Las asociaciones son morfológicas, no una desambiguación semántica perfecta: homógrafos pueden compartir nodo; nombres propios y fragmentos no independientes se omiten. Los 14 patrones gramaticales tienen comprobación textual y de límites; las demás etiquetas antiguas no se incorporan automáticamente al mapa.

## Validación

`node --test tests/*.test.mjs`

`python -m unittest discover -s tests -p "test_*.py"`

Pruebas de perfiles, direcciones, fechas, contextos duplicados, fallo reciente y texto obsoleto. La frase 毎朝七時に起きます。 no incorpora 買う ni 時に. La app revalida el plan antes de iniciar una recomendación; previsualizar no consume cupos.

El mapa se descarga al abrirlo y se reutiliza en la sesión; no bloquea el arranque ni envía datos a IA. Audio usa la síntesis del dispositivo; diccionario abre Jisho mediante acción explícita.
