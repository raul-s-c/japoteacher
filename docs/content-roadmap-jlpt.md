# Estrategia de contenidos N5 → N1

## Principios innegociables

1. Una frase debe describir una situación humana plausible; no se generan combinaciones cartesianas de lugares, objetos y acciones.
2. Cada unidad semántica se publica como un par japonés→español y español→japonés con un identificador estable.
3. Los ejercicios utilizados nunca se borran: una retirada cambia `active=false` y conserva intentos, feedback y progreso.
4. La dificultad se organiza primero por JLPT y después por tema, gramática, función comunicativa, registro y tipo de comprensión.
5. El furigana se almacena precomputado y se comprueba palabra por palabra antes de publicar.

## Volumen objetivo

| Nivel | Pares semánticos objetivo | Ejercicios en ambas direcciones | Tamaño de lote |
|---|---:|---:|---:|
| N5 | 300 | 600 | 25 pares / 50 ejercicios |
| N4 | 450 | 900 | 25 pares / 50 ejercicios |
| N3 | 650 | 1.300 | 25 pares / 50 ejercicios |
| N2 | 850 | 1.700 | 25 pares / 50 ejercicios |
| N1 | 1.100 | 2.200 | 25 pares / 50 ejercicios |

El objetivo final es 3.350 pares o 6.700 ejercicios. El volumen es un techo de cobertura, no una cuota: ningún lote se publica si baja la calidad.

## Taxonomía común

Los cinco niveles reutilizan una taxonomía estable: vida diaria, hogar, comida, compras, transporte, viajes, salud, estudio, trabajo, relaciones, ocio, naturaleza, servicios, tecnología, sociedad y cultura. Cada tema progresa internamente desde situaciones concretas a matices abstractos.

Cada fila debe incluir como mínimo: nivel, tema, situación, gramática, partículas, vocabulario, kanji, registro, función comunicativa, tiempo/aspecto, polaridad, tipo de frase y notas de ambigüedad.

## Flujo de creación de cada lote

1. **Matriz de cobertura:** detectar huecos reales por nivel × tema × gramática × función.
2. **Escenarios:** redactar 25 microescenas distintas y plausibles antes de escribir frases.
3. **Autoría:** escribir japonés natural y su traducción española por significado, nunca sustituyendo palabras en una plantilla.
4. **Contraste:** crear la dirección inversa, alternativas aceptables y límites de ambigüedad.
5. **Validación lingüística:** naturalidad, corrección, adecuación JLPT, lectura de kanji, furigana y correspondencia semántica.
6. **Validación adversarial:** buscar dobles interpretaciones, contextos absurdos, traducciones demasiado literales y respuestas alternativas que la evaluación debería aceptar.
7. **Validación técnica:** esquema, identificadores, duplicados, equilibrio de direcciones y prueba de importación/selección en IndexedDB.
8. **Cuarentena:** el lote entra inactivo; solo se activa después de superar todas las comprobaciones y una revisión final completa.

## Puertas de calidad

Un par se rechaza si falla una sola de estas condiciones:

- La escena puede resultar extraña sin un contexto adicional.
- La traducción cambia sujeto, tiempo, polaridad, registro o intención.
- Contiene gramática o kanji claramente superiores al nivel sin una razón pedagógica explícita.
- El furigana no coincide exactamente con la lectura contextual.
- Tiene una ambigüedad no cubierta por alternativas aceptables.
- Duplica esencialmente otra frase cambiando solo un sustantivo.

## Adaptación por temática

La progresión no sube al usuario entero de nivel. Cada tema tiene su propio estado.

- **Consolidado:** al menos 12 intentos, 8 frases diferentes, media reciente ≥82 %, ≥80 % de respuestas aceptables y ningún error crítico en los últimos 3 intentos.
- **Sondeo superior:** una frase del nivel siguiente por cada 8 ejercicios del tema consolidado.
- **Ascenso:** dos sondeos aceptables de tres y media ≥78 %.
- **Refuerzo:** dos resultados consecutivos <65 % devuelven temporalmente el tema al nivel anterior.
- **Reentrada:** después de 4 aciertos de refuerzo, vuelve a aparecer un sondeo superior.

La sesión mezcla aproximadamente 55 % objetivo actual, 25 % repaso vencido, 10 % puntos débiles y 10 % sondeo. Estos porcentajes se reajustan si hay poco contenido disponible.

## Evolución pedagógica

- **N5 — autonomía básica:** identidad, horarios, ubicación, peticiones, compras y rutinas con frases simples.
- **N4 — vida cotidiana conectada:** razones, condiciones, experiencia, planes y secuencias de varias acciones.
- **N3 — conversación funcional:** intención implícita, opinión, explicación, registro neutro y textos cortos conectados.
- **N2 — comprensión social y profesional:** matices, contraste, causa compleja, noticias, trabajo y argumentación.
- **N1 — precisión avanzada:** abstracción, ironía limitada por contexto, registro formal, inferencia, densidad léxica y reformulación.

## Orden de ejecución

1. Completar N5 hasta 300 pares en lotes de 25.
2. Auditar los 105 pares N4 existentes y retirar cualquier frase débil antes de ampliar.
3. Completar N4 hasta 450 pares.
4. Construir N3, N2 y N1 por capas temáticas: ningún nivel se considera terminado si un tema esencial queda sin cobertura.
5. Reauditar trimestralmente con datos reales: baja aceptación, respuestas divergentes o feedback repetido envían la frase a revisión, nunca a borrado.
