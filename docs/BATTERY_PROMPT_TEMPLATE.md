# Plantilla para ampliar la batería de Japoteacher

Usa este prompt sustituyendo los valores entre corchetes. Lo ideal es generar lotes de 20 frases: 10 japonés → español y 10 español → japonés, todos de un único nivel y una única temática principal.

```text
Quiero ampliar la batería de ejercicios de Japoteacher.

OBJETIVO DEL LOTE
- Nivel JLPT: [N5 / N4 / N3 / N2 / N1]
- Temática principal normalizada: [viaje / comida / trabajo / estudio / salud / etc.]
- Temáticas secundarias permitidas: [lista o "ninguna"]
- Situaciones comunicativas: [hotel, restaurante, oficina, universidad...]
- Número total: 20
- Direcciones: 10 ja_es y 10 es_ja
- Registro predominante: [cortés / neutro / combinación especificada]
- Dificultad dentro del nivel: progresiva, sin salir del JLPT indicado

REQUISITOS PEDAGÓGICOS
1. Crea frases naturales y útiles, no traducciones literales artificiales.
2. Cada frase debe evaluar una idea principal clara.
3. Evita duplicados semánticos y frases demasiado parecidas a ejercicios existentes.
4. Distribuye vocabulario, partículas, conjugaciones y funciones comunicativas.
5. Para ja_es, la referencia española debe conservar el significado y sonar natural.
6. Para es_ja, la referencia japonesa debe ser una respuesta natural y adecuada al registro.
7. Incluye alternativas únicamente cuando sean realmente equivalentes.
8. No mezcles estructuras claramente superiores a [NIVEL], salvo vocabulario contextual comprensible.
9. Usa al menos una topic_tag y coloca primero la temática principal.
10. Los IDs deben ser únicos y seguir:
   - JAES-[NIVEL]-[TEMA_CORTO]-0001
   - ESJA-[NIVEL]-[TEMA_CORTO]-0001

FORMATO DE SALIDA
- Devuelve exclusivamente CSV UTF-8 dentro de un único bloque de código.
- Usa exactamente las columnas y el orden de la plantilla de Japoteacher.
- Separa listas de tags con |.
- accepted_alternatives_json debe ser JSON válido, por ejemplo [] o ["Alternativa"].
- No incluyas explicaciones antes ni después del CSV.

CONTROL DE CALIDAD ANTES DE RESPONDER
- Confirma internamente que hay 10 ejercicios ja_es y 10 es_ja.
- Confirma que todos tienen jlpt_level=[NIVEL].
- Confirma que todos incluyen topic_tags=[TEMA PRINCIPAL] como primera etiqueta.
- Confirma que no hay IDs, source_text ni pares de traducción duplicados.
- Confirma que cada fila tiene el mismo número de columnas que la cabecera.

EJERCICIOS EXISTENTES QUE NO DEBES DUPLICAR
[PEGA AQUÍ LAS FILAS EXISTENTES DEL MISMO NIVEL Y TEMÁTICA, O INDICA "ninguno"]
```

## Flujo recomendado

1. Elige una celda concreta de la ruta: por ejemplo `viaje · N4`.
2. Genera 20 ejercicios equilibrados en ambas direcciones.
3. Pasa el CSV por una revisión automática de estructura y duplicados.
4. Revisa manualmente una muestra mínima de cinco filas por dirección.
5. Importa primero el lote en Japoteacher y comprueba el informe de rechazados.
6. Practica una muestra antes de producir el siguiente lote.
7. Amplía verticalmente: N5 → N4 → N3 dentro del mismo tema.
8. Después amplía horizontalmente con otra temática.

No conviene generar cientos de ejercicios en una sola petición: aumenta la repetición, dificulta revisar el nivel y hace más costoso corregir etiquetas inconsistentes.

## Tamaño mínimo útil por celda

Para que la adaptación tenga variedad suficiente, el objetivo recomendado por combinación `temática × JLPT` es:

- Mínimo inicial: 20 ejercicios, 10 por dirección.
- Banco cómodo: 40 ejercicios, 20 por dirección.
- Banco maduro: 60–100 ejercicios, con variedad de situaciones y gramática.

Una frase puede tener varias temáticas, pero debe existir una temática principal estable como primer elemento de `topic_tags`.
