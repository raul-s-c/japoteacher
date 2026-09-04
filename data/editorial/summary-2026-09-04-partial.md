# Generación parcial del 4 de septiembre de 2026

| Resultado | Cantidad |
| --- | ---: |
| Presupuesto autorizado | 1.500.000 tokens |
| Consumo registrado | 133.804 tokens |
| Candidatos revisados por API | 25 parejas |
| Publicados tras revisión adicional | 20 parejas / 40 ejercicios |
| Apartados para reparar | 5 parejas |
| Banco activo resultante | 2.248 parejas / 4.496 ejercicios |

La generación se interrumpió por conexiones cerradas sin respuesta, reproducidas con dos clientes HTTP y también con lotes de una frase. El endpoint de salud y una revisión de equivalencia sí respondieron. No se ha identificado la causa del cierre. Puede existir consumo no registrado en las llamadas desconectadas: no se afirma que el resto del presupuesto esté íntegramente disponible.

## Clasificación final de las nuevas parejas

| Nivel por uso contextual | Parejas |
| --- | ---: |
| N5 | 1 |
| N4 | 9 |
| N3 | 7 |
| N2 | 3 |
| N1 | 0 |

Los objetivos léxicos procedían de las deudas de cobertura N5/N4, pero el nivel final depende de los componentes reales de cada frase. No se fuerza el nivel del lote sobre el ejercicio.

Se inspeccionaron previamente ocho candidatos de noticias y ocho de lupa. No se incorporaron automáticamente: hay fragmentos incompletos, expresiones repetidas y noticias específicas que requieren reformulación y revisión.

## Validación

- Revisión editorial estricta y equivalencia bidireccional para los candidatos generados; cinco construcciones dudosas separadas para reparación adicional.
- Los 4.956 registros anteriores del CSV y las 2.465 entradas anteriores de furigana son idénticos a HEAD previo a esta tanda.
- Los 20 pares nuevos tienen furigana para todos sus kanjis.
- 97 pruebas JavaScript y 8 pruebas Python correctas; auditoría del banco sin incidencias estructurales.
- No se han modificado intentos, EXP, configuración, progreso ni marcas de repetición voluntaria en la base de datos del usuario.

Listado completo: [Frases nuevas](new-phrases-2026-09-04-partial.md).
Pendientes de reparación: `pending-review-2026-09-04.json`.

Al continuar, usar el consumo base 25.296.635 y el registro `run-2026-09-04-1.5m.json`; no reiniciar un presupuesto de 1,5M como si esta tanda no hubiera consumido nada. Resolver primero el fallo de transporte.
