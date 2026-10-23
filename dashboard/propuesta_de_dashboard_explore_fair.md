# Propuesta de Dashboard Ejecutivo: Explore Fair (19 al 22 de Octubre, 2026)

Este documento detalla la estructura recomendada de visualización de datos para presentar al liderazgo todos los resultados ocurridos durante la semana de charlas (19 al 21 de octubre) y la feria presencial por pabellones (22 de octubre).

La arquitectura del dashboard se divide en **4 bloques estratégicos**, alimentados directamente por las tablas transaccionales (`Usuarios` e `Intentos`) y cruzados con los catálogos (`Pabellones`, `Stands`, `Charlas` y `Preguntas`).

---

## 1. Resumen Ejecutivo (Tarjetas KPI Superiores)

Cinco indicadores clave en la parte superior del tablero para entender de un vistazo la magnitud y el éxito general del evento:

| KPI | Tablas de origen | Qué le dice al líder |
| :--- | :--- | :--- |
| **Total de Participantes Registrados** | `Usuarios` | Cuántas personas entraron a la aplicación por primera vez. |
| **Participantes Activos (Tasa de Activación)** | `Usuarios` vs. `Intentos` | % de registrados que respondieron al menos un cuestionario (ej. el pabellón de entrada). |
| **Total de Cuestionarios Completados** | `Intentos` (`estado = COMPLETADO`) | Volumen real de interacción exitosa que sumó puntos al ranking. |
| **Tasa de Finalización Global** | `Intentos` (`COMPLETADO` / Total) | Qué tan fluido fue completar los retos sin abandonar (`EN_CURSO`) o que expirara el tiempo (`VENCIDO`). |
| **Recorrido Completo ("Full Explorer")** | `Intentos` + `Pabellones` | Cantidad y % de personas que visitaron y completaron **todos** los pabellones de la feria. |

---

## 2. Rendimiento de la Feria Presencial (Pabellones y Stands - 22 de Octubre)

Dado que los `Stands` no se responden por separado, sino que aportan sus preguntas al cuestionario del `Pabellón`, en este bloque se mide el **tráfico físico por pabellón** y la **retención de conocimiento por stand**.

### A. Ranking de Visitas y Finalización por Pabellón
* **Tipo de gráfico:** Barras Horizontales Apiladas.
* **Tablas involucradas:** `Pabellones` + `Intentos` (agrupado por `estado`: `COMPLETADO`, `VENCIDO`, `EN_CURSO`).
* **Objetivo:** Responder directamente **qué pabellón fue el más visitado**. Al apilar por estado, el líder verá no solo dónde ingresó más gente con código, sino también en qué pabellón hubo mayor abandono o vencimiento de tiempo.
* **Nota técnica:** Se sugiere destacar o separar visualmente el pabellón de entrada (`requiere_codigo = FALSE`), ya que por regla de negocio concentrará el mayor volumen inicial.

### B. Embudo de Recorrido del Participante (Customer Journey)
* **Tipo de gráfico:** Gráfico de Embudo (*Funnel Chart*).
* **Tablas involucradas:** `Usuarios` + `Intentos` + `Pabellones`.
* **Pasos del embudo:**
  1. Usuarios registrados en `Usuarios`.
  2. Completaron el Pabellón de Entrada (`requiere_codigo = FALSE`).
  3. Completaron al menos 1 Pabellón con código.
  4. Completaron el 50% o más de los Pabellones.
  5. Completaron el 100% de los Pabellones.
* **Objetivo:** Mostrar en qué punto exacto del recorrido presencial se mantuvo o se perdió el interés de los asistentes.

### C. Nivel de Captación de Mensaje por Stand
* **Tipo de gráfico:** Mapa de Calor (*Treemap*) o Barras Horizontales Agrupadas por Pabellón.
* **Tablas involucradas:** Desglose de respuestas en `Intentos` + `Preguntas` + `Stands`.
* **Objetivo:** Como los stands no registran visitas independientes en el modelo, se evalúan midiendo el **% de respuestas correctas** a las preguntas de cada stand. Un alto porcentaje indica que el expositor transmitió muy bien su mensaje; un porcentaje muy bajo alerta sobre preguntas excesivamente difíciles o falta de claridad en la exposición.

---

## 3. Impacto de las Charlas y Talleres (19 al 21 de Octubre)

Esta sección evalúa el desempeño de la fase previa y cómo impulsó la asistencia al evento principal.

### A. Asistencia y Éxito por Charla
* **Tipo de gráfico:** Gráfico Combinado (Columnas Agrupadas + Línea).
* **Tablas involucradas:** `Charlas` + `Intentos`.
* **Métricas:**
  * *Columnas (Eje Y izquierdo):* Cantidad de participantes que ingresaron el código y respondieron cada charla.
  * *Línea (Eje Y derecho):* Puntaje promedio obtenido (o % de respuestas correctas) en esa charla.
* **Objetivo:** Identificar qué ponentes y temáticas convocaron más público y en cuáles hubo mayor retención de información.

### B. Efecto "Warm-up": Conversión de Charlas a Feria Presencial
* **Tipo de gráfico:** Gráfico de Dona o Diagrama de Venn.
* **Tablas involucradas:** `Usuarios` + `Intentos` (cruzando intentos de tipo Charla vs. intentos de tipo Pabellón).
* **Segmentos:**
  1. Solo asistieron a Charlas (19–21 oct).
  2. Solo asistieron a la Feria Presencial (22 oct).
  3. Asistieron a Ambos (Charlas + Feria).
* **Objetivo:** Demostrarle al líder si la semana previa de charlas funcionó como motor de fidelización para llevar público motivado a los pabellones presenciales.

---

## 4. Dinámica del Evento y Gamificación (19 al 22 de Octubre)

Para entender el pulso del evento, el ritmo de participación por horarios y la efectividad del sistema de puntos.

### A. Flujo de Actividad por Hora y Día
* **Tipo de gráfico:** Gráfico de Áreas o Línea de Tiempo Continua.
* **Tablas involucradas:** Marca temporal de `Intentos` (del 19/10 al 22/10).
* **Objetivo:** Identificar las "horas pico" tanto en los días de charlas como durante la jornada de la feria presencial (ej. detectar picos de tráfico a media mañana o caídas en horario de almuerzo). Insumo clave para decisiones logísticas en futuras ediciones.

### B. Top 10 Participantes y Distribución de Puntos
* **Tipo de gráfico:** Tabla de Posiciones (Leaderboard) + Histograma de Distribución.
* **Tablas involucradas:** `Usuarios` + `Intentos` (`estado = COMPLETADO`).
* **Objetivo:** 
  * Mostrar una tabla limpia con el Top 10 de participantes con mayor puntaje acumulado (y desempate por tiempo si aplica) para efectos de premiación.
  * Acompañar con un histograma que muestre cuántos usuarios quedaron en rangos de puntaje bajo, medio y alto para evaluar si la dificultad general estuvo bien calibrada.

### C. Auditoría del Banco de Preguntas (Top 5 Más Fáciles vs. Top 5 Más Difíciles)
* **Tipo de gráfico:** Barras Divergentes o Tabla con Barras de Datos.
* **Tablas involucradas:** Respuestas en `Intentos` + `Preguntas` + `Stands`/`Charlas`.
* **Objetivo:** Detectar las preguntas "filtro" que casi nadie logró acertar y aquellas que resultaron demasiado obvias.

---

## 5. Recomendación de Diseño Visual (Layout en 1 Sola Vista)

Para facilitar la lectura ejecutiva en herramientas como Looker Studio, Power BI o Google Sheets, se recomienda la siguiente distribución espacial:

1. **Barra Superior de Filtros:** Rango de Fechas (19 al 22 de oct), Tipo de Unidad (*Todos / Pabellones / Charlas*) y Selector de Pabellón/Charla.
2. **Fila 1 (Visión Macro):** Las 5 Tarjetas KPI en una sola línea horizontal.
3. **Fila 2 (El Corazón de la Feria):** 
   * *Izquierda (60% ancho):* Ranking de Pabellones más visitados.
   * *Derecha (40% ancho):* Embudo de Recorrido del Participante.
4. **Fila 3 (Calidad de Contenidos y Charlas):** 
   * *Izquierda (50% ancho):* Asistencia y Éxito por Charla.
   * *Derecha (50% ancho):* % de Aciertos por Stand.
5. **Fila 4 (Tendencias y Cierre):** 
   * *Izquierda (60% ancho):* Flujo de Actividad por Hora/Día.
   * *Derecha (40% ancho):* Tabla del Top 10 del Ranking y Distribución de Puntos.