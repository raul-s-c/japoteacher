# Matriz de completitud editorial - 2026-08-31

La unidad curricular es el par semántico; cada par publica una dirección JP→ES y otra ES→JP. La cobertura se expresa como `≥1 / ≥2 / ≥3` apariciones sobre el total de elementos de referencia. El umbral mínimo para considerar cubierto un elemento es `≥2`; `≥3` es el objetivo preferente.

## Volumen del banco

| Nivel | Pares activos | Ejercicios activos | Objetivo de ejercicios | Completitud de volumen |
| --- | ---: | ---: | ---: | ---: |
| N5 | 837 | 1.674 | 1.400 | 120% |
| N4 | 1.045 | 2.090 | 2.400 | 87% |
| N3 | 0 | 0 | 4.000 | 0% |
| N2 | 0 | 0 | 7.000 | 0% |
| N1 | 0 | 0 | 12.000 | 0% |

## Cobertura de referencia

| Nivel | Vocabulario ≥1 / ≥2 / ≥3 | Kanji ≥1 / ≥2 / ≥3 | Expresiones ≥1 / ≥2 / ≥3 |
| --- | --- | --- | --- |
| N5 | 573/800 (72%) / 259/800 (32%) / 201/800 (25%) | 99/100 (99%) / 96/100 (96%) / 87/100 (87%) | 78/80 (98%) / 78/80 (98%) / 78/80 (98%)* |
| N4 | 508/700 (73%) / 155/700 (22%) / 93/700 (13%) | 191/200 (96%) / 155/200 (78%) / 129/200 (64%) | 78/80 (98%) / 78/80 (98%) / 75/80 (94%)* |
| N3 | 0/2.200 / 0/2.200 / 0/2.200 | 0/350 / 0/350 / 0/350 | 0/120 / 0/120 / 0/120 |
| N2 | 0/2.300 / 0/2.300 / 0/2.300 | 0/350 / 0/350 / 0/350 | 0/190 / 0/190 / 0/190 |
| N1 | 0/4.000 / 0/4.000 / 0/4.000 | 0/1.000 / 0/1.000 / 0/1.000 | 0/280 / 0/280 / 0/280 |

\* La cobertura de expresiones es todavía un proxy por forma superficial. No distingue con fiabilidad estructuras que comparten una misma cadena, como varios usos de `の` o `れる`. La completitud semántica requerirá vincular cada frase a `Grammar_ID`.

## Deuda prioritaria

| Nivel | Vocabulario con 0 usos | Vocabulario con 1 uso | Kanji con 0 usos | Kanji con 1 uso | Prioridad siguiente |
| --- | ---: | ---: | ---: | ---: | --- |
| N5 | 227 | 314 | 1 | 3 | Vocabulario 0x, después vocabulario 1x |
| N4 | 192 | 353 | 9 | 36 | Kanji 0x y vocabulario 0x; después cobertura 2x |

N5 ya supera el objetivo de volumen, pero no está completo curricularmente: solo el 32% del vocabulario aparece al menos dos veces. N4 aún necesita 310 ejercicios para alcanzar el volumen previsto y solo el 22% del vocabulario alcanza 2x. Por tanto, las siguientes tandas deben optimizar cobertura, no añadir frases generales.

## Deuda estructural heredada

La auditoría global marca 3.310 avisos en el banco activo: 2.266 por cantidad de tags, 716 por longitud española y 328 por longitud japonesa. No equivalen automáticamente a frases incorrectas; en su mayoría son registros anteriores a la política editorial actual. Sí indican que la base todavía requiere normalización y revisión progresiva antes de poder considerarse completa, aunque las nuevas tandas N5/N4 hayan superado sus auditorías específicas sin incidencias.
