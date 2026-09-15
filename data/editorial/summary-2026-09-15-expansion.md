# Ampliación editorial — 15/09/2026

Presupuesto independiente: 2.200.000 tokens de API OpenAI.

- Consumo confirmado: 769.961 tokens en 272 llamadas contabilizadas.
- 14 peticiones sin respuesta contabilizable: reservas conservadoras de 1.378.441 tokens. No equivalen a consumo demostrado y no se han liberado.
- Máximo conservador imputado a la tanda: 2.148.402 tokens. Saldo sin comprometer: 51.598; insuficiente para reservar otra petición completa.
- La conexión falló repetidamente después de las primeras 272 llamadas. La comprobación de salud y un POST sin autorización respondían, pero las generaciones fallaban; las últimas dos registraron UND_ERR_SOCKET. No se ha determinado la causa del cierre de conexión ni el consumo real de las peticiones fallidas.
- 124 candidatas revisadas: 84 publicadas y 40 descartadas por contexto, traducción, duplicados o furigana. Un slot adicional se saltó durante los reintentos de generación.
- 168 ejercicios nuevos, en ambas direcciones.

| Nivel editorial | Frases nuevas |
|---|---:|
| N5 | 30 |
| N4 | 16 |
| N3 | 14 |
| N2 | 20 |
| N1 | 4 |
| Total | 84 |

Niveles estimados mediante revisión pedagógica, independientes de los grupos de frecuencia de referencia.

Banco general: 8.096 ejercicios y 3.798 frases activas en ambas direcciones. Sakamoto conserva 304 frases. Se preservan las 7.928 filas anteriores, 3.951 entradas de furigana y todas las asociaciones previas del mapa.

Mapa actualizado: 4.324 conceptos y 8.204 ejercicios activos indexados.

## Cobertura del vocabulario de referencia

Conteo conservador de lemas del mapa contra miembros de cada concepto, con frases japonesas únicas e incluyendo Sakamoto. Dos direcciones de traducción no cuentan como dos contextos. Puede infracontar variantes, compuestos y nombres propios no asociados por el mapa. No mide el progreso personal ni acredita dominio del JLPT.

| Estado | Antes | Después | Cambio |
|---|---:|---:|---:|
| Sin ningún contexto | 6.806 | 6.767 | −39 |
| Con un contexto | 1.375 | 1.396 | +21 |
| Con al menos dos contextos | 1.419 | 1.437 | +18 |
| Pendientes de llegar a dos | 8.181 | 8.163 | −18 |

Referencia total: 9.600 conceptos; 14,97 % con al menos dos contextos.

Validación: 157 pruebas Node y 15 Python superadas. Verificación de IDs, pares, duplicados exactos, furigana y conservación del banco anterior correcta. Banco/mapa versión 20260915-editorial-84, caché v170. Sin llamadas de IA durante las pruebas.
QA de navegador correcta a 390 y 1280 px: planes, persistencia, filtros, fichas, zoom y práctica.
