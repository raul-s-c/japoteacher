# Referencia contextual de vocabulario

`vocabulary-context-v1.csv` combina cuatro senales para ordenar conceptos lexicales:

- 30% frecuencia web escrita del inventario Leeds/RTK Companion.
- 45% frecuencia de dialogo en OpenSubtitles 2018.
- 15% equilibrio entre ambos registros.
- 10% dispersion entre las cinco familias pedagogicas del banco activo. Con menos de tres evidencias esta senal es neutral.

Las formas incluidas en `semantic-concepts.json` comparten cobertura conceptual y frecuencia agregada. No se consideran intercambiables: lectura, escritura, cortesia y registro siguen perteneciendo a cada forma concreta. Tambien se agrupan automaticamente variantes con la misma lectura y la misma glosa; cualquier sinonimo con lectura distinta necesita revision explicita.

OpenSubtitles usa formas superficiales y puede omitir lemas muy comunes por su tokenizacion. Una ausencia no se interpreta como frecuencia cero: `Dialogue_Evidence=web_prior` aplica una estimacion conservadora desde la frecuencia web; `direct` indica que hay recuento conversacional observable.

El fichero se regenera con `scripts/build-contextual-usage-reference.py`. La frecuencia conversacional procede de `hermitdave/FrequencyWords`, contenido derivado de OpenSubtitles 2018 bajo CC BY-SA 4.0. No se versiona el fichero bruto de subtitulos; este directorio contiene solo la proyeccion sobre el inventario educativo.
