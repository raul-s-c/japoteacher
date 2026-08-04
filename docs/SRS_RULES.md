# Reglas SRS

La calidad 0–5 deriva de la evaluación multidimensional. Los primeros éxitos usan 1, 3 y 7 días; después el intervalo se multiplica por `ease_factor`. Un fallo grave vuelve en 1 día y uno moderado en 2. El cooldown recomendado para una respuesta nueva correcta es de 14 días, reducido a 1–7 según el fallo.

La selección diaria se realiza por separado para cada dirección, descarta ejercicios en cooldown salvo repasos vencidos y penaliza candidatos con alta similitud de tags.

## Progresión temática JLPT

La progresión se calcula por cada valor de `topic_tags`, de N5 hacia N1. Un nivel temático se considera consolidado con al menos tres intentos, media igual o superior a 80 y dos tercios de respuestas aceptables. Entonces el planificador puede probar ejercicios del siguiente JLPT disponible para ese mismo tema, aunque no forme parte de los niveles iniciales seleccionados.

Dos resultados consecutivos inferiores a 65 activan refuerzo en el nivel anterior. Una respuesta posterior de al menos 75 en ese nivel inferior permite volver a probar el superior. Si el banco no contiene ejercicios para un nivel, la ruta visual lo marca como no disponible y no inventa una promoción.
