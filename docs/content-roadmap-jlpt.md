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

## Perfil cuantitativo por nivel

Los rangos siguientes son límites editoriales. No se rellenan plantillas para alcanzarlos: primero se escribe una frase natural y después se comprueba que su complejidad sea apropiada. Hasta un 10 % de un lote puede salir del rango si existe una justificación pedagógica escrita.

| Parámetro por par semántico | N5 | N4 | N3 | N2 | N1 |
|---|---:|---:|---:|---:|---:|
| Caracteres japoneses, sin espacios ni puntuación | 8–22 | 12–32 | 18–45 | 25–65 | 35–90 |
| Palabras de la traducción española | 4–12 | 7–18 | 10–25 | 14–36 | 18–48 |
| Cláusulas habituales | 1 | 1–2 | 2–3 | 2–4 | 3–5 |
| Máximo absoluto de cláusulas | 2 | 3 | 4 | 5 | 6 |
| Kanji distintos orientativos | 0–5 | 2–9 | 4–13 | 7–20 | 10–28 |
| Patrones gramaticales centrales | 1–2 | 1–3 | 2–4 | 2–5 | 3–6 |
| Temas por frase | 1 principal + 0–1 secundario | 1 + 0–1 | 1 + 0–2 | 1 + 0–2 | 1 + 0–2 |
| Total orientativo de tags pedagógicos | 6–10 | 8–13 | 10–16 | 12–20 | 14–24 |

### Cómo se mide la longitud

- `jp_char_count`: caracteres japoneses visibles, excluyendo espacios y signos de puntuación.
- `es_word_count`: unidades separadas por espacios después de normalizar signos.
- `clause_count`: proposiciones con predicado propio; una forma subordinada cuenta cuando introduce una relación semántica independiente.
- `kanji_unique_count`: kanji distintos, no número total de apariciones.
- La longitud de la traducción es una señal de control, nunca una obligación de traducir literalmente.

Cada lote debe contener aproximadamente 25 % de frases cortas, 50 % medias y 25 % largas dentro del rango del nivel. Así se evita que todas tengan el mismo ritmo.

## Cardinalidad de etiquetas por elemento

| Campo | Cantidad | Regla |
|---|---:|---|
| `topic_primary` | exactamente 1 | La situación que organiza el ejercicio. |
| `topic_secondary` | 0–2 | Solo si el segundo tema es realmente necesario para entender la escena. |
| `situation_tags` | exactamente 1 | Contexto concreto: estación, consulta, reunión, domicilio… |
| `grammar_tags` | N5: 1–2; N4: 1–3; N3+: 2–6 | Solo estructuras que el ejercicio practica o contrasta. |
| `particle_tags` | 1–5 | Partículas relevantes; no etiquetar automáticamente todas las presentes. |
| `vocabulary_tags` | N5: 2–4; N4: 3–5; N3: 3–6; N2–N1: 4–8 | Lemas centrales, no palabras funcionales triviales. |
| `kanji_tags` | 0–12 | Solo kanji que deben explicarse en el feedback. |
| `verb_tags` | 1–3 | Lema y, cuando sea pedagógico, conjugación. |
| `adjective_tags` | 0–2 | Únicamente adjetivos relevantes. |
| `counter_tags` | 0–1 | Solo cuando el contador sea parte del objetivo. |
| `communicative_function` | exactamente 1 | Pedir, rechazar, comparar, justificar, inferir… |
| `register` | exactamente 1 | Familiar, neutro, cortés o formal. |
| `tense_aspect` | exactamente 1 principal | Presente, pasado, progresivo, experiencia, hipótesis… |
| `ambiguity_tags` | 0–3 | Elipsis, sujeto implícito, polisemia o lectura dependiente del contexto. |

El total de tags no se maximiza. Un tag incorrecto es peor que un tag ausente porque distorsiona la selección adaptativa.

## Parámetros cualitativos obligatorios

Cada par incorpora además estas decisiones explícitas:

- `scenario`: microcontexto de una línea que hace plausible la frase.
- `speaker_role` y `listener_role`: cuando influyen en registro o elección léxica.
- `intent`: qué intenta conseguir el hablante.
- `naturalness_rationale`: por qué la frase suena normal en esa situación.
- `reference_translation`: traducción natural prioritaria.
- `accepted_alternatives`: variantes españolas o japonesas igualmente válidas.
- `rejected_near_misses`: respuestas cercanas que cambian un elemento importante.
- `critical_meaning_units`: sujeto, acción, objeto, tiempo, lugar, polaridad, modalidad y registro que la corrección debe comparar.
- `furigana_segments`: pares exactos kanji/lectura, comprobados en contexto.
- `kanji_explanations`: lectura contextual y razón de esa lectura.
- `difficulty_rationale`: qué hace que la frase pertenezca al nivel indicado.
- `source_or_review_note`: incidencia editorial o excepción justificada.

## Mezcla de cada lote de 25 pares

- 12 enunciados informativos o descriptivos.
- 4 preguntas reales, no preguntas creadas solo para cambiar la terminación.
- 3 peticiones, invitaciones o respuestas sociales.
- 3 frases negativas, restrictivas o de corrección.
- 3 relaciones de causa, contraste, condición o consecuencia.

Estas categorías pueden solaparse, pero el lote debe contener 25 escenarios distintos. Un mismo esqueleto sintáctico no puede aparecer más de dos veces y nunca cambiando únicamente un sustantivo.

Distribución de registro recomendada:

| Nivel | Cortés | Neutro/conversacional | Formal/escrito |
|---|---:|---:|---:|
| N5 | 70 % | 30 % | 0 % |
| N4 | 60 % | 35 % | 5 % |
| N3 | 45 % | 45 % | 10 % |
| N2 | 30 % | 45 % | 25 % |
| N1 | 20 % | 40 % | 40 % |

## Cobertura y diversidad del banco

- Ningún tema puede ocupar más del 20 % de un lote.
- Ningún patrón gramatical puede dominar más del 12 %, salvo lote monográfico declarado.
- Una combinación de escenario + verbo principal + intención no se repite dentro del lote.
- La similitud léxica con una frase existente superior al 80 % obliga a revisión manual.
- Cada tema debe contener acciones, estados, opiniones e interacciones; no solo descripciones.
- A partir de N3, al menos 20 % del contenido debe depender de una relación entre dos oraciones o turnos.
- En N2, ese mínimo sube al 35 %; en N1, al 50 %.
- Los referentes culturales deben poder comprenderse con el contexto ofrecido y no convertirse en preguntas enciclopédicas.

## Estados editoriales

Cada elemento recorre `draft → linguistic_review → adversarial_review → technical_review → quarantine → active`. Cualquier problema real lo mueve a `needs_revision`; si ya fue utilizado, pasa a `active=false` sin cambiar su identificador.

Para activar un lote deben cumplirse simultáneamente:

1. 25/25 escenarios plausibles.
2. 25/25 correspondencias semánticas completas.
3. 100 % de lecturas de kanji comprobadas.
4. 0 duplicados exactos y 0 paráfrasis triviales sin intención pedagógica.
5. 100 % de campos obligatorios y cardinalidades válidas.
6. Importación correcta y selección de sesión sin elementos inactivos.
7. Revisión final corrida, frase por frase, sin aprobación masiva.

## Métricas posteriores a la publicación

La calidad se sigue midiendo con uso real:

- Porcentaje de respuestas que la IA considera alternativas válidas no previstas.
- Dispersión entre puntuación objetiva y comprensibilidad.
- Frecuencia con la que los usuarios abren furigana o explicación de kanji.
- Tasa de error por unidad de significado y no solo por frase.
- Tiempo de respuesta anómalo, abandono y repetición inmediata.
- Comentarios de feedback repetidos que indiquen ambigüedad del enunciado.

Una tasa de alternativas no previstas superior al 15 %, tres reclamaciones semánticas equivalentes o una divergencia de evaluación persistente envían automáticamente el ejercicio a revisión.

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
