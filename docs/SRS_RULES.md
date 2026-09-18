# Reglas SRS

La calidad 0–5 deriva de la evaluación multidimensional. Los primeros éxitos usan 1, 3 y 7 días; después el intervalo se multiplica por `ease_factor`. Un fallo grave vuelve en 1 día y uno moderado en 2. El cooldown recomendado para una respuesta nueva correcta es de 14 días, reducido a 1–7 según el fallo.

Desde el 16/09/2026, los planes de estudio seleccionan por media ascendente de las tres últimas notas válidas disponibles, por perfil y dirección. Las fechas calculadas arriba son orientativas: no bloquean una frase débil ni obligan a repetir una dominada. Tres últimas notas consecutivas de al menos 95 retiran la frase del repaso automático. Un resultado posterior menor vuelve a habilitarla. Se respetan los aplazamientos manuales de dominio, las suspensiones, las respuestas del día y los límites de nuevas. Véase STUDY_PLANS.md.

## Progresión temática JLPT histórica (no selecciona las frases de los planes actuales)

La progresión se calcula por cada valor de `topic_tags`, de N5 hacia N1. Un nivel temático se considera consolidado con al menos tres intentos, media igual o superior a 80 y dos tercios de respuestas aceptables. Entonces el planificador puede probar ejercicios del siguiente JLPT disponible para ese mismo tema, aunque no forme parte de los niveles iniciales seleccionados.

Dos resultados consecutivos inferiores a 65 activan refuerzo en el nivel anterior. Una respuesta posterior de al menos 75 en ese nivel inferior permite volver a probar el superior. Si el banco no contiene ejercicios para un nivel, la ruta visual lo marca como no disponible y no inventa una promoción.


## Rondas de refuerzo (18/09/2026)

Cada tanda termina cuando todas sus frases alcanzan al menos 50. Al terminar una ronda, las frases cuya última respuesta de esta sesión sigue por debajo de 50 se barajan y forman la siguiente ronda, sin límite de rondas. Se consulta la nota guardada después de los ajustes manuales. 50 exacto permite terminar; una corrección inválida no avanza. La ronda y su orden se guardan para retomarlos al reabrir. Los refuerzos añaden intentos al historial, pero no consumen más frases distintas ni cupo de nuevas.

La prioridad de otro día usa la media aritmética de las tres últimas notas válidas disponibles, incluyendo los intentos de refuerzo y los ajustes manuales: una nota se divide entre 1, dos entre 2 y tres entre 3. No se redondea para ordenar. La exclusión por tres notas recientes >=95 y los aplazamientos manuales siguen vigentes.
