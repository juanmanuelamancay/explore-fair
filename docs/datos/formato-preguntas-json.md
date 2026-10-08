# Formato JSON para preguntas

El panel admin permite cargar varias preguntas directamente dentro de un stand.
El archivo debe contener un **arreglo JSON** codificado en UTF-8.

## Campos esperados

Cada elemento del arreglo debe tener exactamente estos campos:

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `texto` | Texto | Sí | Enunciado de la pregunta. |
| `opcion_a` | Texto | Sí | Primera alternativa. |
| `opcion_b` | Texto | Sí | Segunda alternativa. |
| `opcion_c` | Texto | Sí | Tercera alternativa. |
| `opcion_d` | Texto | Sí | Cuarta alternativa. |
| `correcta` | Texto | Sí | Letra de la respuesta correcta: `A`, `B`, `C` o `D`. |
| `puntos` | Número | Sí | Puntos otorgados. Debe ser mayor o igual a cero. |
| `activo` | Booleano | Sí | `true` para publicar la pregunta o `false` para dejarla inactiva. |

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
- `stand_id`: se toma del stand desde donde se seleccionó el archivo.
- `creado_en`: se asigna con la fecha y hora del servidor.

El sistema valida todas las preguntas antes de escribirlas. Si una pregunta es inválida,
no se carga ninguna del archivo y se muestra la fila que debe corregirse.

Para cargarlo, abre el árbol del panel admin, localiza el stand y pulsa **Cargar JSON**.

Cada stand debe tener un banco de 16 preguntas activas. Al iniciar un quiz, el servidor selecciona 4 al azar y no envía las otras 12 al celular.