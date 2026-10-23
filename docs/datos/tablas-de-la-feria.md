# Tablas de la feria y sentido de cada una

Explore Fair guarda todo en un único Google Sheets con 11 hojas. Este documento explica para qué sirve cada tabla dentro de la feria. Los campos, reglas y relaciones detalladas están en [datos/modelo-de-datos.md](modelo-de-datos.md).

## Sentido de la feria

La feria se convierte en una experiencia de participación por retos. Antes del evento hay una semana de charlas y talleres; durante la feria, las personas recorren pabellones, responden preguntas sobre lo que escucharon o vieron y acumulan puntos. Todos los puntos, de charlas y de feria, suman a un mismo ranking.

Las tablas responden a cuatro necesidades:

1. **Contenido:** qué pabellones, stands y charlas existen, y qué preguntas tiene cada uno.
2. **Responsables:** quién administra, lidera, expone o presenta, y qué puede hacer cada rol.
3. **Acceso:** quién entró a la app y con qué código puede responder cada cuestionario.
4. **Resultados:** qué respondió cada persona y cuánto puntaje obtuvo.

## Resumen

| Tabla | Tipo | Sentido en la feria |
|---|---|---|
| `Pabellones` | Catálogo | Las zonas de la feria. Cada pabellón es un cuestionario que la persona responde completo. |
| `Stands` | Catálogo | Los agentes dentro de un pabellón. Cada stand aporta su banco de preguntas al cuestionario del pabellón. |
| `Charlas` | Catálogo | Las charlas y talleres de la semana previa, con su horario. Cada charla tiene su propio cuestionario. |
| `Preguntas` | Catálogo | El banco de preguntas de cada stand y de cada charla. |
| `Staff` | Catálogo | Las personas con un rol distinto a participante: líderes, expositores, ponentes, validadores y administradores. |
| `Permisos` | Catálogo | Qué pantallas ve cada rol. Permite alternar entre la semana de charlas y el evento. |
| `Config` | Catálogo | Parámetros generales: duraciones, puntos por defecto, sala de espera y ajustes de la pantalla de ranking. |
| `Premios` | Catálogo | Premios que se muestran en la sala de espera. Es opcional. |
| `Usuarios` | Transaccional | Las personas que entraron a la app, con su número de orden. |
| `Codigos` | Transaccional | El código temporal vigente de cada pabellón y de cada charla. |
| `Intentos` | Transaccional | Cada cuestionario respondido por una persona: puntaje, respuestas y estado. |

El ranking no es una hoja: se calcula desde `Intentos`.

## Detalle por tabla

### Catálogo

**`Pabellones`.** Agrupa stands en una zona de la feria. Es la unidad que se responde: se contesta el pabellón entero, con código o sin él. El pabellón de entrada (`requiere_codigo` en FALSE) es el primer cuestionario que hace cada persona antes de abrir el resto.

**`Stands`.** Representa un agente dentro de un pabellón. No se responde por sí solo: su banco de preguntas alimenta el cuestionario del pabellón (por defecto, 2 preguntas por stand).

**`Charlas`.** Lista las charlas y talleres de la semana previa, con inicio, fin y hora de cierre. Cada charla es una unidad con su propio banco. Es opcional fuera de la semana de charlas.

**`Preguntas`.** Guarda el enunciado, las cuatro opciones, la respuesta correcta y los puntos de cada pregunta. Cada pregunta pertenece a un stand o a una charla. La respuesta correcta nunca se envía al celular del participante.

**`Staff`.** Asigna responsables. El líder maneja un pabellón y genera su código. El expositor maneja un stand y edita sus preguntas. El ponente maneja una charla, genera su código y edita sus preguntas. El validador revisa sin editar. El administrador controla todo. Quien no aparece aquí es un participante.

**`Permisos`.** Define qué vistas ve cada rol (mapa, charlas, quiz, ranking, generar código, preguntas, panel admin, ingresos). Es la hoja que el administrador cambia para pasar de la semana de charlas al evento.

**`Config`.** Guarda los parámetros de la app: minutos de vigencia de un código, minutos para responder, puntos por defecto, cantidad de preguntas por stand o charla, si la feria está abierta, si la sala de espera está activa y los ajustes visuales de la pantalla de ranking.

**`Premios`.** Lista los premios que se muestran en la sala de espera, en orden. Si la hoja no existe, la sección simplemente no aparece.

### Transaccionales

**`Usuarios`.** Registra a cada participante la primera vez que entra a la app, con su nombre y un número de orden. El número define en qué bloque de `Intentos` escribe la persona. Los líderes, expositores, ponentes y administradores no aparecen aquí.

**`Codigos`.** Guarda el código temporal vigente de cada pabellón con código y de cada charla. Cada unidad tiene una sola fila: al generar un código nuevo se reemplaza el anterior. Un código dura unos minutos y solo abre la unidad para la que se generó.

**`Intentos`.** Es el registro central de participación: una fila por persona y por pabellón o charla. Guarda las preguntas sorteadas, las respuestas dadas, el puntaje y el estado (`EN_CURSO`, `COMPLETADO` o `VENCIDO`). Solo los intentos completados suman al ranking.

## Relaciones principales

- Un pabellón agrupa varios stands; cada stand y cada charla tiene su banco de preguntas.
- Un código abre un pabellón o una charla, y lo genera un líder, un ponente o el administrador.
- Un intento pertenece a una persona y a una unidad (pabellón o charla), y puede estar habilitado por un código.
- El personal se relaciona con su pabellón, stand o charla, y con los permisos de su rol.

## Qué se puede medir con estas tablas

Las preguntas que el equipo quiere responder, y cuáles no se pueden responder con estas tablas, están en [analisis/preguntas-respondibles.md](../analisis/preguntas-respondibles.md).
