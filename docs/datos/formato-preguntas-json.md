# Formato JSON para preguntas

El panel admin permite cargar varias preguntas directamente dentro de un stand.
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
- `stand_id`: se toma del stand desde donde se seleccionó el archivo. El stand debe estar activo.
- `creado_en`: se asigna con la fecha y hora del servidor.

El sistema valida todas las preguntas antes de escribirlas. Si una pregunta es inválida,
no se carga ninguna del archivo y el mensaje indica el número de la pregunta que debe corregirse.

La carga agrega filas a la hoja `Preguntas`: no reemplaza las que el stand ya tenía ni revisa duplicados.
Cargar dos veces el mismo archivo deja las preguntas repetidas.

Para cargarlo, abre el panel admin, despliega el pabellón en la pestaña Pabellones, localiza el stand y pulsa **Cargar JSON**.

Cada stand necesita al menos 16 preguntas activas. Al iniciar un quiz, el servidor selecciona 4 al azar entre las activas y no envía las demás al celular.
