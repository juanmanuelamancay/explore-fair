# Preguntas respondibles con los datos de la feria

Base: las hojas de [modelo de datos](../datos/modelo-de-datos.md). Las preguntas se responden con `Usuarios`, `Intentos`, `Charlas`, `Pabellones`, `Stands`, `Preguntas` y `Codigos`.

Regla general: en esta base, "participar" significa **haber empezado un quiz** (una fila en `Intentos`). No hay registro de presencia física en charlas ni en pabellones.

## 1. Ingreso y registro

| Pregunta | Fuente | Cómo se calcula | Advertencia |
|---|---|---|---|
| ¿Cuántas personas ingresaron a la app? | `Usuarios` | Filas con `email` (sin repetidos) | Incluye a quien solo pasó por la sala de espera. Solo cuenta `USUARIO`; staff no figura |
| ¿Cuántas personas se registraron por día y por hora? | `Usuarios` | Agrupar `registrado_en` por día y hora | `registrado_en` es la hora de ingreso, pero la fila se escribe por lotes unos segundos después |
| ¿Cuántas personas ingresaron en la sala de espera y cuántas durante la feria? | `Usuarios` + `Config` | Comparar `registrado_en` con la fecha de `fecha_feria` | Requiere conocer la hora de apertura de la feria |
| ¿Cuántas personas entraron a la app pero nunca empezaron un quiz? | `Usuarios` + `Intentos` | Emails de `Usuarios` que no aparecen en `Intentos` | Es un indicador de abandono antes de jugar, no de falta de interés |

## 2. Participación en quizzes

| Pregunta | Fuente | Cómo se calcula | Advertencia |
|---|---|---|---|
| ¿Cuántas personas resolvieron al menos un quiz? | `Intentos` | Emails distintos con `estado` = `COMPLETADO` | Solo cuenta quienes enviaron respuestas |
| ¿Cuántas personas empezaron un quiz pero no lo terminaron? | `Intentos` | Emails con `EN_CURSO` y `vence_en` pasado, o `VENCIDO` | La app no escribe `VENCIDO`; se deduce de `vence_en` |
| ¿Cuántos quizzes se completaron en total? | `Intentos` | Filas `COMPLETADO` | |
| ¿Cuántas personas resolvieron pabellones, cuántas charlas y cuántas ambas? | `Intentos` | Emails distintos por tipo, según `pabellon_id` vacío o no | |
| ¿Cuántas personas completaron los 6 pabellones? | `Intentos` + `Pabellones` | Emails con `COMPLETADO` en todos los pabellones con código | Excluir el quiz de entrada (PAB-000) |
| ¿Cuántas personas respondieron el quiz de entrada? | `Intentos` | Emails con `COMPLETADO` en `PAB-000` | |
| ¿Cuántas personas volvieron a jugar en otro día? | `Intentos` | Emails con `iniciado_en` en más de un día | |
| ¿Cuántos intentos tuvo cada persona, en promedio? | `Intentos` | Filas por email | |
| ¿Cuál es la distribución de horas de mayor participación? | `Intentos` | Agrupar `iniciado_en` por hora | Útil para dimensionar personal y pantallas |

## 3. Pabellones visitados

| Pregunta | Fuente | Cómo se calcula | Advertencia |
|---|---|---|---|
| ¿Qué pabellones fueron los más visitados? | `Intentos` + `Pabellones` | Emails distintos por `pabellon_id` (excluyendo PAB-000) | Es "respondieron el quiz", no "caminaron por el pabellón" |
| ¿Cuántas personas visitaron cada pabellón? | `Intentos` | Emails distintos por `unidad_id` | |
| ¿Qué pabellón tuvo más quizzes completados? | `Intentos` | Filas `COMPLETADO` por `pabellon_id` | |
| ¿Qué pabellón tuvo mayor porcentaje de quizzes terminados? | `Intentos` | `COMPLETADO` / total de intentos por pabellón | |
| ¿Cuál fue el puntaje promedio por pabellón? | `Intentos` | Promedio de `puntaje` por `pabellon_id` | |
| ¿Qué pabellones se visitaron antes o después del quiz de entrada? | `Intentos` | Orden de `iniciado_en` por email | |
| ¿Qué pabellones visitó cada persona, y cuál fue el recorrido más común? | `Intentos` | Secuencia de `unidad_id` ordenada por `iniciado_en` | |

## 4. Stands (a partir de las preguntas respondidas)

| Pregunta | Fuente | Cómo se calcula | Advertencia |
|---|---|---|---|
| ¿Qué stands tuvieron más interacción? | `Intentos` + `Preguntas` + `Stands` | Cruzar `preguntas_json` o `respuestas_json` con `Preguntas.stand_id` y contar | `preguntas_json` contiene preguntas sorteadas, no vistas; `respuestas_json` es la medida más fiel |
| ¿Qué stands tuvieron mejor tasa de acierto? | `Intentos` + `Preguntas` | Aciertos (`ok` = true) / respuestas por stand | Cada stand aporta pocas preguntas; la muestra puede ser chica |

## 5. Charlas y talleres

| Pregunta | Fuente | Cómo se calcula | Advertencia |
|---|---|---|---|
| ¿Cuáles fueron las charlas con más público? | `Intentos` + `Charlas` | Emails distintos por `unidad_id` (tipo charla) | Mide quiz respondido con código, no asistencia |
| ¿Cuántas personas respondieron cada charla? | `Intentos` + `Charlas` | Conteo de emails por charla | |
| ¿Qué charla tuvo más quizzes completados o mejor puntaje promedio? | `Intentos` | Filas `COMPLETADO` y promedio de `puntaje` por charla | |
| ¿A qué hora empezaron a responder más personas cada charla? | `Intentos` + `Charlas` | Comparar `iniciado_en` con `inicio`, `fin` y `cierre` | Permite ver si el quiz se respondió durante la charla o después |
| ¿Cuántas personas respondieron una charla después de su cierre? | `Intentos` + `Charlas` | `iniciado_en` > `cierre` | Por diseño no debería ocurrir; sirve para validar |
| ¿Qué charlas tuvieron más abandono? | `Intentos` + `Charlas` | `EN_CURSO` vencidos / intentos por charla | |
| ¿Qué personas asistieron a charlas y cuántas charlas por persona? | `Intentos` | Filas de charla agrupadas por email | |

## 6. Puntajes, aciertos y preguntas

| Pregunta | Fuente | Cómo se calcula | Advertencia |
|---|---|---|---|
| ¿Cuál es el puntaje promedio, mediana y máximo? | `Intentos` | Estadística sobre `puntaje` de `COMPLETADO` | |
| ¿Cuál es el porcentaje de aciertos general? | `Intentos` | Suma de `correctas` / total de preguntas respondidas | |
| ¿Qué preguntas fueron las más acertadas y las más falladas? | `respuestas_json` + `Preguntas` | Aciertos por `p` (pregunta) | |
| ¿Qué preguntas se respondieron menos veces? | `respuestas_json` + `Preguntas` | Conteo por `p` | Preguntas con pocas respuestas no tienen muestra suficiente |
| ¿Qué opción eligió la gente más veces en cada pregunta? | `respuestas_json` | Conteo de `r` por `p` | |
| ¿Qué pregunta tuvo la respuesta más equivocada frecuentemente? | `respuestas_json` + `Preguntas.correcta` | Opción más elegida distinta de `correcta` | |
| ¿Cuántos puntos se repartieron en total? | `Intentos` | Suma de `puntaje` | |
| ¿Qué porcentaje de personas tuvo puntaje perfecto en un quiz? | `Intentos` | `correctas` = preguntas del quiz / total | |

## 7. Ranking y premios

| Pregunta | Fuente | Cómo se calcula | Advertencia |
|---|---|---|---|
| ¿Quiénes fueron las 10 personas con más puntos? | `Intentos` + `Usuarios` | Suma de `puntaje` por email, con `nombre` | Desempate por `completado_en` |
| ¿Cuántas personas tuvieron puntaje de 0? | `Intentos` | Emails con suma 0 | |
| ¿Cuál es la distribución de puntos? | `Intentos` | Histograma de puntaje total por persona | |
| ¿Cuál es la diferencia entre el primer y segundo lugar? | `Intentos` | Diferencia de puntaje total | |

## 8. Códigos

| Pregunta | Fuente | Cómo se calcula | Advertencia |
|---|---|---|---|
| ¿Cuántos intentos se abrieron con código? | `Intentos` | Filas con `codigo` no vacío | |
| ¿Cuántas personas entraron por pabellón con código y cuántas por charla? | `Intentos` | Agrupar por tipo de `unidad_id` con `codigo` | |
| ¿Cuál es la participación por código activo? | `Intentos` + `Codigos` | Intentos con el `codigo` actual de cada unidad | `Codigos` solo guarda el código vigente, no el historial |

## 9. Preguntas que no se pueden responder con las tablas actuales

- ¿Cuántas personas asistieron físicamente a una charla o pasaron por un pabellón? No hay registro de presencia.
- ¿Cuánto tiempo pasó cada persona en un pabellón o en un stand? No hay registro de tiempo de permanencia.
- ¿Cuántas personas escanearon o vieron el mapa sin responder? Solo se registra quien empezó un quiz (aunque sí se registra quien ingresó a la app).
- ¿Cuál era el historial de códigos generados y cuántas personas los usaron en cada generación? `Codigos` guarda una sola fila por unidad.
- ¿Quiénes son los ganadores de cada premio? La hoja `Premios` lista premios, pero no registra a quién se entregaron.
- ¿Cuál es el perfil de los asistentes (empresa, cargo, edad)? Solo se guarda `email` y `nombre`.
- ¿Cuántas personas respondieron el quiz de un stand en particular? Los quizzes son por pabellón; el stand se infiere de las preguntas.
- ¿Cuánto tardó cada persona en responder cada pregunta? Solo se registra el inicio y el envío del quiz completo.
- ¿Qué personas usaron el quiz de entrada sin entrar a la app? Todo ingreso queda en `Usuarios`, así que no aplica.

## 10. Notas para el análisis

- Antes de presentar cifras, verificar duplicados en `Intentos` (una fila por persona y unidad) y filas con `estado` `EN_CURSO` vencidas.
- Excluir del análisis de pabellones el quiz de entrada `PAB-000` y las filas de staff si aparecen.
- Las simulaciones escriben datos con `SIMULACION` en `Codigos.generado_por` y correos de prueba; filtrarlos antes de publicar.
- `Usuarios` y `Intentos` pueden tener un desfase de segundos por la escritura en lotes.
