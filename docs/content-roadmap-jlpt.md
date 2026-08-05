# Estrategia de frases N5 → N1

## Alcance de JapoTeacher

JapoTeacher practica exclusivamente traducción escrita de frases en dos direcciones:

- japonés → español;
- español → japonés.

No incorpora preguntas tipo test, ejercicios independientes de kanji o gramática, lecturas largas ni comprensión auditiva. Los criterios JLPT se usan para graduar vocabulario, kanji, gramática y dificultad de las frases; la traducción es una actividad de apoyo al aprendizaje y no un formato del examen oficial.

El JLPT actual no publica una lista oficial cerrada de vocabulario, kanji o gramática. Los inventarios internos son taxonomías pedagógicas contrastadas con los descriptores y muestras oficiales, nunca supuestos temarios oficiales.

## Definición no ambigua de nivel completo

| Nivel | Pares semánticos activos | Ejercicios publicados |
|---|---:|---:|
| N5 | 300 | 600: 300 JP→ES + 300 ES→JP |
| N4 | 450 | 900: 450 JP→ES + 450 ES→JP |
| N3 | 650 | 1.300 |
| N2 | 850 | 1.700 |
| N1 | 1.100 | 2.200 |

N5 o N4 solo se considera completo cuando cada par:

1. tiene una escena autosuficiente y plausible;
2. expresa exactamente el mismo significado en japonés y español;
3. está disponible en ambas direcciones con un ID estable;
4. contiene nivel, tema, situación, gramática, partículas, vocabulario, registro, función, tiempo/aspecto y polaridad comprobados;
5. explica la lectura contextual de todos los kanji visibles;
6. supera revisión lingüística, adversarial, lógica y técnica;
7. no duplica ni parafrasea trivialmente otra frase activa.

El número por sí solo nunca basta. Un par defectuoso se corrige antes de publicar; si ya fue utilizado, se conserva con `active=false` para no romper intentos ni progreso.

## Perfil cuantitativo

Las bandas son objetivos de diversidad, no motivos para rellenar una frase con información artificial.

| Parámetro | N5 | N4 | N3 | N2 | N1 |
|---|---:|---:|---:|---:|---:|
| Caracteres japoneses habituales | 6–32 | 10–52 | 18–55 | 25–70 | 35–95 |
| Palabras españolas habituales | 2–18 | 4–28 | 8–30 | 12–40 | 16–52 |
| Cláusulas habituales | 1 | 1–2 | 2–3 | 2–4 | 3–5 |
| Patrones gramaticales centrales | 1–2 | 1–3 | 2–4 | 2–5 | 3–6 |
| Temas | 1 principal + 0–1 secundario | 1 + 0–1 | 1 + 0–2 | 1 + 0–2 | 1 + 0–2 |

Cada lote busca aproximadamente 25 % de frases cortas, 50 % estándar y 25 % largas. Los límites superiores son estrictos; los inferiores admiten una tolerancia pequeña cuando la expresión natural es breve, como `行きましょうか` / «¿Vamos?».

## Taxonomía temática

Los niveles reutilizan 16 temas: vida diaria, hogar, comida, compras, transporte, viajes, salud, estudio, trabajo, relaciones, ocio, naturaleza, servicios, tecnología, sociedad y cultura.

El tema principal debe aparecer en el contenido de la frase, no solo en una escena editorial oculta. Se permiten como máximo dos temas por par y ninguno puede superar el 20 % de un lote general.

## Mezcla de cada lote de 25 pares

- 12 enunciados informativos o descriptivos;
- 4 preguntas reales;
- 3 peticiones, invitaciones o respuestas sociales;
- 3 negativas, restricciones o correcciones;
- 3 relaciones de causa, contraste, condición o consecuencia.

Cada lote contiene 25 microescenas distintas. Un mismo esqueleto no aparece más de dos veces y nunca se crea una variante cambiando únicamente persona, lugar u objeto.

Registro orientativo:

| Nivel | Cortés | Neutro/conversacional | Formal |
|---|---:|---:|---:|
| N5 | 70 % | 30 % | 0 % |
| N4 | 60 % | 35 % | 5 % |
| N3 | 45 % | 45 % | 10 % |
| N2 | 30 % | 45 % | 25 % |
| N1 | 20 % | 40 % | 40 % |

## Puertas de calidad por par

Un par se rechaza si ocurre cualquiera de estos casos:

- la situación resulta extraña sin añadir contexto;
- japonés y español difieren en sujeto recuperable, acción, tiempo, lugar, polaridad, modalidad, registro o intención;
- una causa no justifica lógicamente su consecuencia;
- una condición, contraste o secuencia está invertida o es artificial;
- la traducción usa un equivalente impreciso cuando existe uno directo;
- una alternativa añade información ausente;
- falta la lectura de un kanji visible o no corresponde a su uso contextual;
- el tema o los tags no están evidenciados en la frase;
- la dificultad excede el nivel sin justificación;
- existe un duplicado exacto o una plantilla apenas sustituida.

## Flujo editorial

```text
matriz de cobertura
  → microescenas
  → generación de 5 pares
  → revisión adversarial independiente
  → reparación especializada de kanji si hace falta
  → validación local de slots, lógica, longitudes y duplicados
  → auditoría frase por frase
  → cuarentena
  → publicación simultánea JP→ES y ES→JP
```

El proceso guarda checkpoints de cinco pares. Una interrupción conserva los grupos aprobados y nunca incorpora un grupo parcial.

## Progresión adaptativa

La progresión se calcula por tema, no elevando todo el perfil de nivel a la vez:

- consolidado: al menos 12 intentos, 8 frases distintas, media reciente ≥82 % y ningún error crítico en los últimos tres;
- sondeo superior: una frase del siguiente JLPT por cada ocho ejercicios del tema consolidado;
- ascenso: dos sondeos aceptables de tres y media ≥78 %;
- refuerzo: dos resultados consecutivos inferiores a 65 % devuelven temporalmente el tema al nivel anterior;
- reentrada: cuatro aciertos de refuerzo habilitan otro sondeo.

La sesión orientativa mezcla 55 % del objetivo actual, 25 % de repasos vencidos, 10 % de puntos débiles y 10 % de sondeo superior.

## Orden de ejecución

1. Revalidar todos los pares N5 existentes y completar 300.
2. Revalidar todos los pares N4 existentes y completar 450.
3. Publicar cada par en ambas direcciones sin modificar IDs utilizados.
4. Auditar sincronización, selección adaptativa, furigana y feedback.
5. Ampliar después N3, N2 y N1 manteniendo exactamente la misma mecánica de traducción.
