# Continuación editorial del 4 de septiembre de 2026

| Resultado | Cantidad |
| --- | ---: |
| Tokens registrados en esta continuación | 205.802 |
| Tokens registrados acumulados | 339.606 |
| Presupuesto original | 1.500.000 |
| Parejas publicadas ahora | 32 |
| Ejercicios publicados ahora | 64 |
| Parejas publicadas en toda la tanda | 52 |
| Pendientes de reparación | 3 |
| Banco activo | 2.280 parejas / 4.560 ejercicios |

Se revisaron las cinco parejas pendientes y se generaron 30 nuevas. Tras inspección adicional se apartaron dos reparaciones que seguían sin convencer y una frase nueva con intención ambigua entre declaración e imperativo. Las otras 32 parejas quedan publicadas.

| JLPT final contextual | Parejas añadidas ahora |
| --- | ---: |
| N5 | 2 |
| N4 | 9 |
| N3 | 13 |
| N2 | 5 |
| N1 | 3 |

Se corrigieron el orden de lecturas repetidas y entradas de kana etiquetadas como kanji en tres frases. Todos los kanjis nuevos tienen furigana en el HTML generado. Los 4.996 registros anteriores y las 2.485 entradas anteriores de furigana permanecen idénticos al commit 9492c5c. No se han escrito datos de progreso del usuario.

Validación: 97 pruebas JavaScript, ocho Python, importación completa sin rechazos y auditoría estructural del banco sin incidencias.

La generación se detuvo por `Remote end closed connection without response`. Un nuevo proceso reprodujo el corte; la conexión de monitorización Wrangler también se reconectaba repetidamente, sin aportar un diagnóstico concluyente. No se ha cambiado ni desplegado el Worker. El presupuesto NO está completado. Las llamadas interrumpidas podrían haber consumido tokens no registrados.

Para continuar: conservar el baseline 25.296.635 y consultar `run-2026-09-04-1.5m.json`. Resolver primero el transporte; no reiniciar el presupuesto. Las tres pendientes están en `pending-review-2026-09-04.json` y no cuentan como cobertura publicada.

[Listado de las 32 parejas](new-phrases-2026-09-04-continuation.md).
