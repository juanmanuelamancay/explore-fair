# Formato JSON para preguntas

El panel admin permite cargar varias preguntas directamente dentro de un stand o de una charla.
El archivo debe contener un **arreglo JSON** codificado en UTF-8, con entre 1 y 200 preguntas.

## Campos esperados

Cada elemento del arreglo debe tener exactamente estos campos. Si falta uno o sobra otro, el archivo se rechaza.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `texto` | Texto | Sí | Enunciado de la pregunta. |
| `opcion_a` | Texto | Sí | Primera alternativa. |
| `opcion_b` | Texto | Sí | Segunda alternativa. |
| `opcion_c` | Texto | Sí | Tercera alternativa. |
| `opcion_d` | Texto | Sí | Cuarta alternativa. |
| `correcta` | Texto | Sí | Letra de la respuesta correcta: `A`, `B`, `C` o `D`. |
| `puntos` | Número | Sí | Puntos otorgados. Entero, mayor o igual a cero. Con `0` la pregunta vale `puntos_por_defecto` de `Config`. |
| `activo` | Booleano | Sí | `true` para publicar la pregunta o `false` para dejarla inactiva. Debe ser un booleano, no un texto. |

## Ejemplo

```json
[
  {
    "texto": "¿Qué servicio se utiliza para almacenar objetos?",
    "opcion_a": "Cloud Storage",
    "opcion_b": "Cloud SQL",
    "opcion_c": "Cloud Tasks",
    "opcion_d": "Cloud DNS",
    "correcta": "A",
    "puntos": 10,
    "activo": true
  },
  {
    "texto": "¿Qué opción representa una baja lógica?",
    "opcion_a": "Eliminar la fila",
    "opcion_b": "Marcar activo como false",
    "opcion_c": "Cambiar el nombre",
    "opcion_d": "Duplicar el registro",
    "correcta": "B",
    "puntos": 10,
    "activo": true
  }
]
```

## Datos que genera el sistema

El archivo no debe incluir estos campos:

- `pregunta_id`: el sistema genera una ID correlativa como `PRG-001`.
- `stand_id`: se toma del stand o de la charla desde donde se seleccionó el archivo, que debe estar activo. Para una charla lleva el ID de la charla (`CHA-001`).
- `creado_en`: se asigna con la fecha y hora del servidor.

El sistema valida todas las preguntas antes de escribirlas. Si una pregunta es inválida,
no se carga ninguna del archivo y el mensaje indica el número de la pregunta que debe corregirse.

La carga agrega filas a la hoja `Preguntas`: no reemplaza las que el stand ya tenía ni revisa duplicados.
Cargar dos veces el mismo archivo deja las preguntas repetidas.

Para cargarlo, abre el panel admin: en la pestaña Pabellones despliega el pabellón, localiza el stand y pulsa **Cargar JSON**; en la pestaña Charlas despliega la charla y pulsa **Cargar JSON**.

Cada stand necesita al menos 12 preguntas activas para que su pabellón abra el quiz; el servidor sortea 2 de cada stand (el quiz de un pabellón de 4 stands es de 8 preguntas) y no envía las demás al celular. Cada charla necesita al menos 15, y se sortean 5. Doce (stand) y quince (charla) son también el tope de lo que puede tener activo un expositor o un ponente; el admin puede cargar más.

Un archivo de ejemplo con 12 preguntas activas por stand está en `preguntas_demo_stands.tsv`.
