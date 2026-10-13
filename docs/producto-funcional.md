# Explore Fair: descripción funcional

## Qué es

Explore Fair es una aplicación para convertir una feria en una experiencia de participación por retos. Antes del evento hay una semana de charlas y talleres; en el evento las personas recorren pabellones, responden preguntas sobre lo que escucharon y acumulan puntos para aparecer en un ranking. Los puntos de las charlas y los del evento suman al mismo ranking.

## Para qué sirve

- Guiar a cada persona por la agenda de charlas de la semana previa y por los pabellones y stands de la feria.
- Comprobar de forma sencilla qué aprendió en cada charla.
- Dar a los líderes de pabellón y a los ponentes una forma rápida de habilitar cada cuestionario, y a los expositores y ponentes mantener las preguntas de lo que presentan.
- Mostrar a cada participante los puntos que lleva.
- Mostrar el ranking en la pantalla grande de la feria.
- Permitir al administrador preparar y mantener el contenido de la feria.

## Área de preguntas

El área de preguntas es el centro de la experiencia. Cada **pabellón** tiene un cuestionario formado por unas pocas preguntas de cada uno de sus stands, y cada **charla** tiene el suyo.

### Preparación

El administrador puede:

- Crear y editar preguntas para cada stand y cada charla, una por una o cargando un archivo.
- Escribir el enunciado y cuatro opciones de respuesta.
- Marcar cuál es la opción correcta.
- Definir los puntos que vale cada acierto.
- Activar o desactivar preguntas.
- Revisar cuántas preguntas tiene cada stand y cada charla, y qué pabellones, stands y charlas todavía no tienen responsable asignado.

Si el administrador le da acceso, el **expositor** de cada stand y el **ponente** de cada charla pueden crear y corregir las preguntas de su banco: el enunciado, las opciones y la respuesta correcta. Los puntos y qué preguntas están activas los decide el administrador. Un expositor puede tener hasta 12 preguntas activas y un ponente hasta 15.

Un pabellón solo puede abrirse cuando cada uno de sus stands tiene al menos 12 preguntas activas; una charla, cuando tiene al menos 15.

### Cómo responde una persona

1. Completa primero el cuestionario de entrada. Hasta entonces los pabellones están cerrados.
2. Elige un pabellón (el cuestionario es del pabellón entero, no de un stand).
3. Escucha la charla y recibe un código del líder del pabellón.
4. Introduce el código para abrir el cuestionario.
5. Responde una pregunta por pantalla.
6. Envía todas las respuestas antes de que termine el tiempo.

Cada cuestionario tiene un solo intento por persona y pabellón. A cada persona le tocan 2 preguntas de cada stand, elegidas al azar entre las de ese stand (un pabellón de 4 stands da un cuestionario de 8). Si cierra la app a mitad del cuestionario y vuelve dentro de su tiempo, continúa con las mismas preguntas.

### Resultado

Al enviar el cuestionario, la persona ve:

- Cuántos puntos obtuvo.
- Cuántos puntos lleva en total.
- Cuántas preguntas acertó (por ejemplo, "5 de 8"), sin decir cuáles.

Nunca se muestra cuáles preguntas acertó ni cuál era la respuesta correcta, para que no pase de una persona a otra. Tampoco se muestra el puesto: el ranking se ve en la pantalla grande de la feria.

Los cuestionarios completados suman al ranking. Si se acaba el tiempo, el cuestionario queda vencido, no suma puntos y no se puede repetir.

## La semana de charlas

Antes del evento hay cinco charlas o talleres, con su día y hora. Quien asiste ingresa a la app, ve la **agenda de charlas** y, al terminar cada una, ingresa el código que comparte el ponente (dura 5 minutos) y responde 5 preguntas de las 15 del banco de la charla. No pide el cuestionario de entrada. Los puntos suman al ranking y las mismas personas siguen sumando en el evento.

Las fechas y horas, los puntos y el tiempo salen de las hojas (`Charlas`, `Preguntas`, `Config`), no del código. El administrador alterna lo que ve el participante entre la semana de charlas y el evento con la hoja `Permisos`.

## Antes del evento

El administrador puede encender una sala de espera. Mientras está activa, los participantes ven una cuenta regresiva hasta el inicio del evento (la primera charla o la feria, lo que ocurra antes), un resumen de las fechas de las charlas y de la feria, cómo se juega, la lista de charlas por día, los premios y los pabellones con sus stands. Los puntos de las charlas y los de la feria se acumulan en el mismo ranking. Líderes, expositores, ponentes y administradores entran a la app normal, sin registrarse. Quien entra a la sala de espera y no está en Staff queda registrado como participante desde ese momento. Cuando empieza el evento el administrador apaga la sala (`espera_activa` en FALSE) y deja a `USUARIO` con la vista que toque (`CHARLAS` o `MAPA`).

## Roles principales

- **Participante:** recorre la feria, responde preguntas y consulta sus puntos.
- **Líder de pabellón:** entrega el código temporal que permite responder el cuestionario de su pabellón.
- **Expositor:** mantiene las preguntas de su stand (hasta 12 activas).
- **Ponente:** entrega el código de su charla y mantiene sus preguntas (hasta 15 activas).
- **Validador:** recorre los cuestionarios y las preguntas sin responder ni editar.
- **Administrador:** prepara pabellones, stands, preguntas, personas, premios y reglas de la feria; ve el ranking y lo proyecta en la pantalla grande, y puede reiniciar los datos después de las pruebas.
