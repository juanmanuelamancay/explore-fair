# Reglas de UX y UI

Última actualización: 2026-10-13 (versión del código `2026-10-13.1`)

Reglas de diseño de la aplicación. Nacieron de los tres prototipos y hoy describen la app real de `appscript/`; donde los dos difieren, vale la app.

| Prototipo | Rol | Qué muestra el prototipo |
|---|---|---|
| [prototipo/usuario.html](../../prototipo/usuario.html) | `USUARIO` | Mapa, quiz y ranking |
| [prototipo/lider.html](../../prototipo/lider.html) | `LIDER` | Generar código y ranking |
| [prototipo/admin.html](../../prototipo/admin.html) | `ADMIN` | Reinicio de datos y ranking |

Diferencias principales de la app real: el usuario y el líder no tienen ranking, el celular no muestra el puesto, y existen cuatro vistas sin prototipo: la pantalla de ranking (`RANKING`), las preguntas del líder (`PREGUNTAS`), el editor del catálogo del panel y la sala de espera (`ESPERA`).

## Principios

1. **Primero el celular.** El usuario usa la app de pie, en una feria, con una mano. Todo se diseña para 375 px de ancho y se centra con un máximo de 480 px en pantallas más grandes. La única vista pensada para pantalla grande es la pantalla de ranking.
2. **Estilo Google, minimalista.** Fondo blanco, bordes finos, mucho espacio y color solo donde aporta significado.
3. **Nadie está obligado a visitarlo todo.** La interfaz muestra lo ganado, nunca lo que falta. No se muestran contadores como "3 de 19 stands" ni barras de avance global.
4. **Una acción principal por pantalla.** Un solo botón relleno; lo demás es secundario.
5. **El servidor decide.** El celular del participante nunca recibe la respuesta correcta ni calcula el puntaje.

## Estilo visual

### Colores base

| Uso | Valor | Variable CSS |
|---|---|---|
| Acción principal, enlaces, dato propio | `#1a73e8` | `--azul` |
| Fondo de selección y avisos | `#e8f0fe` | `--azul-suave` |
| Error, tiempo por agotarse, acción destructiva | `#d93025` | `--rojo` |
| Fondo del resumen de lo que se va a borrar | `#fce8e6` | `--rojo-suave` |
| Primer lugar del podio | `#f9ab00` | `--amarillo` |
| Acierto, completado | `#188038` | `--verde` |
| Fondo del aviso de operación exitosa | `#e6f4ea` | `--verde-suave` |
| Fondo | `#ffffff` | `--fondo` |
| Superficie secundaria | `#f8fafd` | `--superficie` |
| Texto principal | `#1f1f1f` | `--texto` |
| Texto secundario | `#5f6368` | `--texto-2` |
| Bordes | `#dadce0` y `#e8eaed` | `--borde`, `--borde-suave` |

Las variables están en `comun-style.html`. Una franja fija de 4 px con los cuatro colores de Google (`#4285f4`, `#ea4335`, `#fbbc04`, `#34a853`) corona todas las pantallas, salvo la de ranking, que usa el tema escénico de [UX_UI_solo_para_vista_ranking.md](../UX_UI_solo_para_vista_ranking.md).

### Color por pabellón

Cada pabellón tiene un color, un tinte claro del mismo tono y un ícono. El color identifica al pabellón en el mapa, en su hoja de stands, en la etiqueta de las pantallas de quiz y en las vistas del líder.

| Posición | Pabellón del catálogo inicial | Color | Tinte |
|---|---|---|---|
| 1 | Backend | `#1a73e8` | `#e8f0fe` |
| 2 | Frontend | `#d93025` | `#fce8e6` |
| 3 | Quality | `#188038` | `#e6f4ea` |
| 4 | Seguridad | `#e37400` | `#fef7e0` |
| 5 | Data | `#9334e6` | `#f3e8fd` |
| 6 | Host | `#c2185b` | `#fce4ec` |
| 7 | Codegraph | `#00897b` | `#e0f2f1` |

Los colores no están atados al nombre: salen de la lista `PALETA` de `comun-script.html` según la posición del pabellón en el mapa. Codegraph usa un ícono de tres nodos conectados; a partir del octavo pabellón se repite la paleta. Si se quiere elegir el color de cada pabellón, tiene que pasar a ser un campo de `Pabellones`.

### Tipografía

- **Fuente:** Roboto, cargada desde Google Fonts, con la fuente del sistema como respaldo.
- **Pesos:** 400 para texto y títulos grandes, 500 para énfasis. La negrita pesada (700) queda para las abreviaturas de stand, las medallas y el número de la base del podio.
- **Códigos:** Roboto Mono, para que cada carácter se distinga. Se usa en el campo donde el usuario escribe el código, en el código que muestra el líder y en la palabra de confirmación del admin.
- **Tamaños:** 16 px de base; 20–24 px en títulos y enunciados; 12–14 px en texto de apoyo. Nunca menos de 11 px.
- **Cifras protagonistas:** el dato principal de una pantalla puede ser más grande: 28 px en los puntos del resultado del quiz, 32 px en la cuenta regresiva y 64 px en el código del líder, que debe leerse a distancia.
- **Números que cambian** (puntaje, puesto, reloj) usan cifras tabulares para que no salten.

### Formas

- **Botones:** píldora de 52 px de alto mínimo. Principal en azul relleno con texto blanco; secundario con borde y texto azul; de solo texto para cancelar; deshabilitado en gris.
- **Botones destructivos:** con borde y texto rojo para abrir la confirmación, y rojo relleno solo para el paso final que ejecuta el borrado.
- **Tarjetas:** borde de 1 px, radio de 24 px, sin sombra.
- **Listas:** radio de 20 px. **Opciones y filas tocables:** radio de 16 px.
- **Círculos:** para todo lo que representa a una persona, un pabellón o un stand.
- **Sombra:** solo en elementos que flotan sobre el contenido (el círculo del usuario).

### Medallas de puesto

Los tres primeros puestos (uno por premio) se muestran siempre igual, en cualquier vista:

| Puesto | Metal | Fondo | Borde | Texto | Corona |
|---|---|---|---|---|---|
| 1 | Oro | `#fef7e0` | `#f9ab00` | `#b06000` | `#fbbc04` |
| 2 | Plata | `#f1f3f4` | `#9aa0a6` | `#5f6368` | `#aab0b7` (contorno `#6f757c`) |
| 3 | Bronce | `#fbe9e0` | `#c5733a` | `#8a4720` | `#d98e5a` |

- **Forma:** el mismo círculo de siempre, con borde de 2 px del metal, un anillo blanco fino por dentro y una corona pequeña y plana encima, sin brillos ni degradados.
- **Del cuarto puesto en adelante:** círculo neutro, sin corona (también en la lista de premios de la sala de espera).
- **Dónde se usa:** lista de premios de la sala de espera, y podio y cuadrícula del ranking.
- **En el código:** clases `oro`, `plata` y `bronce`, y las funciones `medalla` y `avatarDePuesto` de `comun-script.html`.

### Iconos

Iconos de línea de 2 px, sin relleno, dibujados en SVG dentro del archivo. No se usan emojis ni librerías de iconos externas.

## Reglas para celular

- **Área táctil mínima:** 44 × 44 px en lo que toca el participante y el líder. El editor del panel admin usa botones de 38 a 40 px.
- **Campos de texto con 16 px o más**, para que el celular no haga zoom al enfocarlos.
- **Sin desplazamiento horizontal** de la página. Las filas de fichas y pestañas se deslizan dentro de su propia franja.
- **Filas deslizables con mouse:** toda fila de fichas lleva la clase `carril` (estilo en `comun-style`, comportamiento en `activarCarriles` de `comun-script`). En el celular se arrastra con el dedo, sin barra. Con mouse muestra una barra delgada y se mueve con la rueda o arrastrando; al llegar al extremo, la rueda vuelve a mover la página. Si la fila se repinta al elegir una ficha, se envuelve con `recordarCarril` para que no vuelva al inicio.
- **Zonas seguras:** la navegación inferior y las hojas respetan `env(safe-area-inset-bottom)`.
- **Movimiento reducido:** animaciones y transiciones se desactivan con `prefers-reduced-motion`.
- **Accesibilidad:** cada botón sin texto lleva `aria-label`; los mensajes temporales usan `aria-live`; las opciones del quiz se anuncian como grupo de radio.

## Pantallas del usuario

El usuario tiene tres vistas, que corresponden a los valores de `vista` en la hoja `Permisos`. En el evento usa `MAPA` y `QUIZ`; en la semana de charlas, `CHARLAS` y `QUIZ`:

| `vista` | Pantallas que incluye |
|---|---|
| `MAPA` | Mapa (inicio), hoja del pabellón y hoja "Cómo participar" |
| `CHARLAS` | Agenda de charlas (inicio en la semana previa) |
| `QUIZ` | Ingreso de código, preguntas, resultado y tiempo agotado |

No tiene barra inferior, porque tiene un solo destino: el mapa en el evento o la agenda de charlas en la semana previa (el admin decide cuál con `Permisos`).

### Mapa (inicio)

De arriba hacia abajo:

1. **Cabecera:** la marca "Explore Fair" (sin rol), el saludo con el nombre, un recuadro compacto con los puntos y el botón de actualizar. No muestra el puesto.
2. **Mensaje guía:** franja azul suave con un ícono, un título y una línea de instrucción. Cambia según el momento:
   - Sin quiz de entrada: da la bienvenida e indica responderlo para abrir los pabellones.
   - Con quiz de entrada terminado: indica escuchar la charla y pulsar el pabellón.
3. **Ayuda:** la franja del mensaje guía es un botón. Su ícono alterna entre una mano y un signo de pregunta, y al tocarla abre la hoja "Cómo participar", con cuatro pasos: empezar con el quiz de entrada, recorrer la feria y escuchar las charlas de los pabellones (después, el líder del pabellón comparte un código), abrir el quiz del pabellón con el código, y responder para sumar puntos. El último paso aclara que los puestos se ven en la pantalla grande de la feria.
4. **Mapa radial:** bajo el título "Pabellones", el usuario en el centro y los pabellones repartidos alrededor en un círculo.

Reglas del mapa:

- **El círculo central es el usuario y también el botón del quiz de entrada.** Muestra sus iniciales. Mientras el quiz está pendiente, tiene un anillo que late y la etiqueta "Empieza aquí"; si lo dejó a medias, dice "Continúa aquí". Una vez respondido, muestra un check verde y los puntos obtenidos. Si se le venció, dice "Sin puntaje". El validador ve este círculo siempre en su estado pendiente (anillo que late y "Empieza aquí"), aunque sus pabellones estén abiertos: no responde, así que nunca pasa a respondido.
- **El quiz de entrada va primero.** Mientras no esté terminado (respondido o con el tiempo vencido), los pabellones se muestran en gris con un candado y no se abren: al tocarlos sale un aviso que indica pulsar el círculo propio. El servidor aplica la misma regla, así que tampoco se puede empezar un stand por otra vía.
- **Apertura animada.** Al volver al mapa tras terminar el quiz de entrada, los pabellones se abren uno tras otro en el sentido del reloj: cada uno recupera su color, su candado salta y desaparece, y una onda de su color se expande. Con seis pabellones dura alrededor de 1,6 segundos en total y la acompaña el mensaje "Ya puedes visitar los pabellones". Con movimiento reducido activado, aparecen abiertos sin animación.
- **El resultado se ve al instante.** Al volver de cualquier quiz, el mapa ya muestra el puntaje y el estado del pabellón con lo que el navegador sabe, sin esperar al servidor. Cuando el servidor responde, sus datos reemplazan a los anteriores.
- **Suma animada.** Al volver de un pabellón respondido, su arco se llena, un "+N" sube sobre el pabellón, el número de puntos de la cabecera da un pulso y un mensaje temporal dice cuántos puntos se sumaron.
- **Alrededor van los pabellones, no los stands.** Los stands se ven al tocar el pabellón, solo como información: el quiz es del pabellón entero.
- **Cada pabellón muestra** su ícono, su nombre corto (`nombre_corto`, o `nombre` si no hay), los puntos ganados ahí (solo si hay) y un arco de su color que se llena cuando respondió el quiz del pabellón.
- **Pabellón completo:** cuando el quiz del pabellón está respondido a tiempo, lleva el mismo check verde que el círculo central.
- **Las posiciones se calculan** según la cantidad de pabellones, empezando arriba. Agregar un pabellón no requiere rediseñar.

### Al tocar un pabellón

No hay hoja intermedia: el toque lleva directo a la pantalla del quiz, que pide el código del líder (ver "Ingreso de código"). Si el pabellón ya está respondido o vencido, solo sale un aviso ("Ya respondiste este pabellón: N de M · P pts" / "Se te venció el tiempo en este pabellón. No se puede repetir."). Si está en curso, retoma sin pedir el código.

### Ingreso de código

- Muestra el pabellón o la charla, cuántas preguntas tiene, el tiempo disponible y los puntos posibles antes de pedir nada.
- **Campo de código:** 4 caracteres, se convierte a mayúsculas y solo acepta letras y números. El botón "Empezar" se habilita al completar los 4.
- **Código inválido o vencido:** el campo vuelve vacío, se marca en rojo, tiembla una vez y muestra un mensaje que dice qué hacer ("Pídele uno nuevo al líder"). "Empezar" sigue deshabilitado hasta escribir otros 4 caracteres.
- **Tres códigos incorrectos:** la persona queda bloqueada 120 segundos, en todos los pabellones y charlas. El campo se vacía, se marca en rojo y **deja de aceptar texto**; debajo dice "Fallaste el código 3 veces. Espera para volver a intentarlo." y el botón pasa a "Espera 1:58", contando hacia atrás. Al llegar a cero el campo se libera solo y el botón vuelve a "Empezar" (deshabilitado hasta escribir 4 caracteres). Durante la espera el código correcto tampoco entra. Si la persona sale y vuelve, sigue bloqueada.
- **Aviso fijo del código:** "Si fallas el código 3 veces, tendrás que esperar 2 minutos para volver a intentarlo." Los números salen del servidor (`FALLOS_DE_CODIGO_MAX` y `SEGUNDOS_BLOQUEO_CODIGO`).
- **El quiz de entrada** usa esta misma pantalla sin el campo de código, con el título "Listo para empezar" y el aviso "Solo tienes un intento."
- **Mientras el servidor arma el quiz** se ve una pantalla de espera animada: "Preparando tu quiz".

### Preguntas

- **Una pregunta por pantalla**, con el rótulo "Pregunta N de M" (M es el total del quiz: en un pabellón, las de todos sus stands).
- **Cabecera fija al desplazar:** etiqueta ("Pabellón", "Charla" o "General"), título, reloj y una barra de pasos.
- **Aviso al pie, bajo el botón:** "Solo tienes un intento."
- **Reloj:** cuenta regresiva siempre visible, guiada por la hora del servidor. En los últimos 30 segundos pasa a rojo.
- **Opciones:** botones de ancho completo con letra A–D. La elegida se marca con borde y fondo azul. Se puede cambiar antes de avanzar.
- **Solo se avanza.** No hay botón para volver a la pregunta anterior ni para salir del quiz.
- **Botón:** "Siguiente", y "Enviar respuestas" en la última. Deshabilitado hasta elegir una opción.
- **No se indica si acertó** hasta enviar todo.
- **Al enviar,** el reloj se detiene y se ve "Revisando tus respuestas" mientras el servidor corrige.
- **Si el envío no llega** después de los reintentos automáticos, aparece "No pudimos guardar tus respuestas" con un botón "Reintentar". Las respuestas siguen en el celular y el reloj no se reanuda.

### Resultado

- Sello circular verde con un check; dorado y con un trofeo si acertó todas. Debajo, los puntos ganados, que suben contando desde cero, y el total acumulado ("Llevas N puntos en total.").
- Un recuadro con "N de M correctas". **No se muestra qué preguntas acertó ni cuál era la respuesta correcta**, para que no se pase entre usuarios. El servidor ni siquiera envía el detalle por pregunta, así que tampoco se puede sacar desde el navegador.
- Acción principal "Volver al mapa" (o "Volver a las charlas" si el quiz era de una charla). El botón secundario "Ver ranking" aparece solo si el rol tiene la vista `RANKING`, así que el usuario no lo ve.

### Tiempo agotado

Pantalla propia, en tono neutro (gris, sin rojo): explica que ese quiz no suma y recuerda que puede seguir sumando en los demás pabellones (o en las demás charlas).

## Charlas (agenda de la semana previa)

Vista `CHARLAS`: lo que ve el usuario en la semana previa al evento, en lugar del mapa. Es una **agenda**, no un recorrido: cada charla es independiente, no hay que terminar una para pasar a otra y cada persona entra a las que quiere (una, dos o todas). Por eso no hay línea que una las charlas ni contadores de avance.

De arriba hacia abajo: cabecera con saludo y puntos, mensaje guía (misma franja-botón que el mapa, con el ícono que alterna mano y "?": "Te damos la bienvenida a los talleres / Responde cada quiz para sumar puntos."; al tocarla abre la hoja "Cómo participar en los talleres" con cuatro pasos: ubicar el taller en el que está, escucharlo, ingresar el código y responder; los horarios ya están planificados, así que no se elige), una línea "Cada charla: N preguntas · M minutos para responder" (si todas tienen las mismas preguntas; si no, cada tarjeta lo dice) y las charlas agrupadas por día. El día lleva "Hoy" (en azul) o "Mañana" cuando corresponde.

- **Tarjeta abierta o próxima:** ícono de estado, horario de la charla ("16:00 – 17:00"; la hora de fin solo se muestra si es posterior al inicio), etiqueta de estado, título, ponente, descripción y los datos: "Hasta N pts" y "Responde hasta las HH:MM" (el cierre, separado del horario de la charla). La abierta lleva borde azul y el botón "Ingresar código". Los datos van en una sola línea de apoyo ("Hasta 50 pts · Responde hasta las HH:MM"), sin fichas. Solo el taller *En vivo* (o *En curso*) tiene el botón relleno y la etiqueta azul con un punto que parpadea; una abierta que ya terminó lleva el botón secundario, para mantener una sola acción principal por pantalla.
- **Estados:** *Próxima* (aún no es su hora de inicio, sin botón), *Abierta* / *En vivo* / *En curso* (botón "Ingresar código" o "Continuar el quiz"), *Completada* (borde verde y los puntos ganados en grande: "+20 pts · 2 de 5 correctas"), *Cerrada* y *Se venció* (ver abajo).
- **Tarjetas compactas:** una charla *Cerrada* (pasó la hora de `cierre`) o *Se venció* ocupa una sola línea de título con su estado y una nota ("La hora para responder se venció (cerró a las HH:MM)"), sin descripción ni datos, para que lo vigente quede arriba. No se muestra como fallo: gris, sin rojo.
- **La charla vigente a la vista:** al abrir la pantalla, si la primera charla abierta (o, si no hay, la primera próxima) queda fuera de la pantalla, la lista se mueve hasta ella, una sola vez por visita.
- **El estado se actualiza solo** con la hora del servidor (la pantalla se repinta cada 30 segundos).
- **Si el cierre llega mientras la persona escribe el código,** la app la saca de esa pantalla y la lleva a la agenda, con el aviso "La hora para responder esta charla se venció"; el servidor rechaza empezar con el motivo `CIERRE` aunque el código sea válido. Quien ya empezó su quiz puede terminarlo.
- **El código lo da el ponente** al terminar; el quiz abre la misma pantalla de código, preguntas y resultado que los pabellones, y al terminar vuelve a la agenda ("Volver a las charlas"). No pide el quiz de entrada.
- **Solo lectura:** el validador ve las charlas con "Ver preguntas" en cada una; el admin las ve sin botones.

## Sala de espera

Es lo que ve un usuario antes del evento, mientras `espera_activa` está en TRUE. No tiene barra inferior: es su única vista. De arriba hacia abajo:

- **Cuenta regresiva:** cuatro recuadros (días, horas, minutos, segundos) que avanzan cada segundo según la hora del servidor, bajo "Los talleres de agentes empiezan en" (o "La feria de agentes empieza en" si no hay talleres cargados). Cuenta hasta lo primero que empiece: el primer taller (hoja `Charlas`) o `fecha_feria`, lo que caiga antes. Debajo van esa fecha y hora, una línea por mecánica ("Talleres del lunes 19 al miércoles 21 de octubre" y "Feria el jueves 22 de octubre"), el lugar y un mensaje opcional. Sin ninguna fecha dice "Muy pronto".
- **Llegada la hora:** la cuenta se queda en 00:00:00 (no hay pantalla de "llegó el día": el admin apaga `espera_activa` y activa `CHARLAS` en `Permisos` antes) y la app pregunta al servidor una vez por minuto si ya se abrió. Cuando `espera_activa` pasa a FALSE, la app se vuelve a abrir sola con el mapa; si el navegador no la deja, queda el aviso "Tu acceso cambió" con el botón "Abrir de nuevo". El botón de actualizar hace la misma comprobación al instante.
- **Carrusel:** debajo de la cuenta van cinco láminas: Objetivo del evento, Cómo sumar puntos, Talleres (si la hoja tiene talleres), Pabellones y Premios. Se pasa de una a otra deslizando con el dedo; cada deslizamiento avanza una sola lámina.
- **Puntos:** sobre el carrusel (así se ven aunque la lámina sea larga) hay un punto por lámina, de 28 × 44 px de área táctil; el de la lámina a la vista se alarga y se pinta de azul. Tocar un punto lleva a esa lámina.
- **Avance solo:** cambia de lámina cada 6 segundos y al llegar a la última vuelve a la primera. Se detiene 12 segundos cuando la persona lo toca, y no avanza con la app en segundo plano, con movimiento reducido activado, ni cuando la persona ya bajó y dejó el inicio del carrusel fuera de la pantalla.
- **Alto variable:** el carrusel toma el alto de la lámina a la vista.
- **Premios:** título, la frase "Participando y aprendiendo podrás ganar:" y la lista con la medalla de cada puesto (ver "Medallas de puesto"). La feria entrega tres premios; del cuarto puesto en adelante el círculo es neutro, sin corona. Es la última lámina. Si no hay premios cargados, no aparece y el carrusel termina en el último pabellón.
- **Objetivo:** primera lámina, "Objetivo del evento": una frase ("Talleres en Meet y una feria en la sede central. Participa, suma puntos y gana grandes premios."), tres viñetas bajo "¿Qué encontrarás?" (demos y retos, casos y buenas prácticas, espacio para dudas y dinámicas) y, en un recuadro azul, la frase con la que se espera que cada persona termine: "Sé qué agente puede ayudarme y cómo empezar a utilizarlo en mi día a día." Es la lámina más alta y se queda 25 segundos antes de avanzar (`data-segundos`), el resto 6.
- **Cómo sumar puntos:** titulada "Dos formas de sumar puntos", con dos bloques de dos pasos, cada uno con una línea de apoyo: En los talleres (asistir y recibir el código, que dura pocos minutos; responder su quiz, un intento) y En la feria (quiz de entrada; recorrer los pabellones con el código del líder, un intento por pabellón).
- **Talleres:** lámina "Empieza con los talleres", sin texto de introducción. Un rótulo por día ("Lunes, 19 de octubre") y, debajo, una fila por taller con su hora (en un recuadro azul), el título y el ponente. Sale de la hoja `Charlas`; sin talleres activos no aparece.
- **Pabellones:** una sola lámina con una fila por pabellón (ícono y nombre en su color, y la cantidad de stands). Tocar la fila la abre y muestra sus stands con su abreviatura; el carrusel ajusta su alto. Un pabellón nuevo en el Sheet agrega su fila sin tocar código.

El `ADMIN` ve esta misma pantalla como una pestaña más, "Espera", mientras la sala está activa.

## Pantallas del líder de pabellón, el ponente y el expositor

Ninguno de los tres compite: no tienen mapa ni quiz. El **líder de pabellón** y el **ponente** tienen como inicio la pantalla de generar código; el **expositor**, la de preguntas. El ponente tiene además `PREGUNTAS`, con una barra inferior de Código y Preguntas.

### Generar código

De arriba hacia abajo: saludo, mensaje guía, pabellón o charla y tarjeta del código. No lleva KPI, contador de personas ni historial de códigos.

- **Mensaje guía:** sin código activo indica generarlo al terminar la charla; con código activo indica compartirlo en voz alta o mostrando la pantalla.
- **Pabellón o charla:** se muestra fijo con su abreviatura y su rótulo ("Pabellón" o "Charla"). El admin, que ve varios, elige con fichas horizontales; un punto verde marca los que tienen código activo.
- **Charla cerrada (ponente):** al llegar la hora de `cierre` la tarjeta pasa a "Charla cerrada" (candado, "Cerró a las HH:MM. Ya no se pueden generar códigos ni responder el quiz"), sin código y sin botón. Antes del cierre, bajo la tarjeta, dice "Puedes generar códigos hasta las HH:MM". El admin conserva el botón y ve la nota "como admin todavía puedes generar un código".
- **Tarjeta sin código:** ícono neutro, "Sin código activo", cuánto dura y para qué pabellón o charla sirve, y el botón principal "Generar código".
- **Mientras se genera:** cuatro casillas giran con caracteres al azar y se fijan una por una cuando llega el código real.
- **Tarjeta con código activo:** mismo encabezado y mismas cuatro casillas que al generar, ahora fijas con el código y con el título "Código listo"; debajo, una barra que se vacía, el tiempo restante para ingresarlo y el botón secundario "Generar uno nuevo". En el último minuto la barra y el tiempo pasan a rojo.
- **Tarjeta con código vencido:** las casillas en gris y el botón principal "Generar código nuevo". Se ve así mientras la pantalla siga abierta; al volver a entrar, el stand aparece "Sin código activo".
- **Reemplazar un código activo** pide confirmación en una hoja inferior: avisa que el código actual deja de funcionar y que quienes ya entraron pueden terminar su quiz.
- **Caracteres del código:** 4, solo consonantes y dígitos del 2 al 9. Sin vocales y sin `0`, `1` ni `L`, para que no se confundan al dictarlos.
- **No hay acción de anular** sin generar otro: un código se reemplaza o se deja vencer.
- **Sin nada asignado:** la tarjeta dice "No tienes nada asignado" y pide avisar a un administrador.

### Preguntas

Vista `PREGUNTAS`. El expositor revisa y edita el banco de su stand; el ponente, el de su charla.

- **Banco:** si ve varios (el admin y el validador), los elige con fichas horizontales; si es uno, se muestra fijo con su pabellón.
- **Resumen:** una fila de puntitos y el texto "N de M activas" (M es 10 en un stand y 15 en una charla), con el botón "Nueva".
- **Lista:** una tarjeta por pregunta, con su número y su enunciado. Las inactivas se ven atenuadas. Tocar una abre el editor.
- **Editor:** hoja inferior con el enunciado, las cuatro opciones y la respuesta correcta. No incluye los puntos ni el estado activo: esos los decide el administrador.
- **Banco lleno:** con las M preguntas activas desaparece el botón "Nueva" y la ayuda dice que no se pueden agregar más; el expositor y el ponente solo editan las que ya hay. El admin no tiene ese tope.
- **Mientras guarda:** los campos se bloquean, los botones se reemplazan por "Guardando…" y la hoja no se puede cerrar. Al terminar, un mensaje temporal confirma y la tarjeta editada destella una vez.

## Pantallas del admin

El admin tiene en la barra inferior todas las vistas que `Permisos` le dé: Mapa, Código, Preguntas, Panel, Ranking y, con la sala de espera activa, Espera.

### Panel

De arriba hacia abajo: saludo, mensaje guía, editor del catálogo, tarjeta "Actualizar desde el Sheet", tarjeta "Usuarios registrados" y tarjeta "Reiniciar la feria".

Editor del catálogo:

- **Pestañas:** `Pabellones`, `Charlas`, `Staff`, `Permisos`, `Configuración` y `Premios`. Los stands y las preguntas no tienen pestaña: se editan dentro de su pabellón, y las preguntas de cada charla, dentro de su charla.
- **Botón "+":** agrega un registro a la pestaña abierta.
- **Búsqueda y estado:** un campo busca dentro de la pestaña. El interruptor "Solo activos" viene encendido; al apagarlo se ven también los inactivos, atenuados.
- **Pestaña Pabellones:** un árbol. Cada pabellón se despliega para mostrar sus stands, y cada stand muestra sus preguntas y el contador "N/10 preguntas" (con "· faltan K" cuando no llega). Dentro del árbol están "Añadir stand", "Añadir pregunta" y "Cargar JSON" (ver [formato](../datos/formato-preguntas-json.md)). El pabellón muestra su líder ("Líder: …") o "sin líder"; cada stand, su expositor o "Sin expositor". El pabellón del quiz de entrada dice "quiz de entrada, sin código". Es lo que el admin revisa antes de abrir.
- **Responsables:** el formulario del pabellón tiene el campo opcional "Correo del líder", el del stand "Correo del expositor" y el de la charla "Correo del ponente", prellenados con quien responde hoy. Al guardar, el servidor lo deja en `Staff` con el rol y el alcance que corresponden (nombre completado desde el directorio de Google o el correo) y el mensaje temporal dice quién quedó. Vacío quita al responsable. Los rechazos (correo de un admin o de alguien que ya responde de otra cosa, registro inactivo, pabellón sin código) salen como mensaje temporal y el formulario sigue abierto.
- **Pestaña Permisos:** una tarjeta por rol que se despliega y muestra sus vistas como fichas, con "Añadir vista".
- **Pestaña Charlas:** igual que los pabellones: cada charla se despliega con sus preguntas, "Añadir pregunta" y "Cargar JSON". Su formulario tiene título, nombre del ponente, descripción, inicio, fin, correo del ponente, preguntas del banco y del quiz (vacías = valores de `Config`), orden y activo. Sin la hoja `Charlas` en el Sheet no deja guardar.
- **Demás pestañas:** una lista de registros, cada uno con editar y desactivar.
- **Formularios:** hoja inferior con selectores para las referencias a otras hojas, limitadas a registros activos. Los identificadores se generan solos al guardar.
- **Bajas:** siempre con hoja de confirmación. Un pabellón se elimina con todo su contenido y la hoja muestra cuántos stands y preguntas se borran; un parámetro de `Config` se quita; el resto se desactiva.
- **Integridad:** el servidor valida claves únicas, roles y vistas válidos, relaciones activas y dependencias antes de escribir. Si rechaza el cambio, el motivo sale en un mensaje temporal y el formulario sigue abierto.

Sincronización y reinicio:

- **Tarjeta "Actualizar desde el Sheet":** botón secundario "Actualizar ahora". Hace que la app relea las hojas de catálogo en el momento y confirma con un mensaje temporal cuántos pabellones, stands y preguntas activas encontró.
- **Tarjeta "Usuarios registrados":** dice cuántas personas están en la hoja `Usuarios` y cuántas siguen por escribir. El botón secundario "Registrar ahora" las escribe en el momento; queda deshabilitado cuando no hay ninguna pendiente.
- **Tarjeta "Reiniciar la feria":** explica el efecto y separa en dos listas lo que se borra (equis roja: intentos y códigos) y lo que se conserva (check verde: usuarios y catálogo).
- **Botón "Reiniciar datos":** destructivo con borde. Si no hay nada que borrar, queda deshabilitado y dice "No hay datos que borrar".
- **Confirmación:** hoja inferior con el número exacto de filas a borrar de `Intentos` y `Codigos` sobre fondo rojo suave, el aviso de que se guarda una copia y un campo donde hay que escribir `REINICIAR`. El botón rojo relleno se habilita solo cuando la palabra coincide.
- **Durante la ejecución:** el botón muestra un indicador giratorio y "Reiniciando…", y no se puede volver a tocar.
- **Resultado:** el mensaje guía pasa a verde con lo borrado y el nombre de la copia, y bajo el botón se muestra la hora del último reinicio y quién lo hizo.
- **Tarjeta "Respaldos de los reinicios":** cada reinicio copia `Intentos` y `Codigos` en hojas ocultas `respaldo_...`, que con el tiempo ocupan muchas celdas del Sheet. La tarjeta dice cuántas hay y el botón "Borrar respaldos" las elimina. Pide escribir `BORRAR` en una hoja inferior, no se puede deshacer y solo toca hojas cuyo nombre empieza por `respaldo_`. Sin respaldos, el botón queda deshabilitado ("No hay respaldos que borrar").

### Ranking

Vista `RANKING`, solo del admin (una persona), para proyectar. Usa todo el ancho de la pantalla, con el contenido centrado hasta 1.680 px.

- **Sin cabecera:** no lleva marca ni título visibles, para dejarle todo el alto al ranking. La hora de la última actualización, el botón de ajustes y el de actualizar flotan casi transparentes en la esquina superior derecha y se encienden al pasar el mouse.
- **Podio** con los tres primeros, uno por premio, en oro, plata y bronce: el avatar con las iniciales toma el metal, y solo el 1.º lleva una corona dorada encima. La base del podio se pinta del mismo metal. De izquierda a derecha van el 2.º, el 1.º (el más alto) y el 3.º.
- **Cuadrícula** del cuarto en adelante, que se llena columna por columna, de arriba hacia abajo: cada celda lleva puesto, nombre, el reloj con sus segundos totales debajo del nombre y los puntos. El podio también muestra los segundos de cada uno. Muestra las personas que caben en pantalla, o menos si los ajustes fijan una cantidad.
- **Pie:** "Puestos 1 a N de T" y la regla de desempate.
- **Menos de tres personas:** el podio muestra solo a quienes hay: con una, el 1.º; con dos, el 2.º y el 1.º. Sin nadie con puntaje, "Esperando los primeros puntajes".
- **Cambios:** quien sumó puntos desde la última actualización destella en verde y muestra un "+N" que se desvanece.
- **Actualización:** se trae del servidor al entrar y luego sola cada `segundos_refresco_board` (mínimo 10 segundos). Se pausa con la app en segundo plano y, al volver, se actualiza de inmediato. El botón de actualizar recalcula el ranking en ese momento.
- **Ajustes:** hoja con deslizadores para personas por pantalla, columnas, alto de fila, espacio entre filas, tamaño de nombres de la lista, tamaño de puntos, tamaño y ancho del podio, tamaño de nombres del podio y tamaño del tiempo; un interruptor, "Ocultar menú de navegación"; y "Restablecer valores". Cada cambio se ve al momento y se guarda en `Config` (claves `rp_*`); las demás pantallas abiertas lo toman en su siguiente actualización.
- **Pantalla angosta:** por debajo de 900 px la cuadrícula pasa a una columna y el podio ocupa todo el ancho.

## Patrones compartidos

- **Marca y rol:** la cabecera de cada vista del staff (salvo Ranking, que no tiene cabecera) lleva "Explore Fair · Rol" (Líder, Admin, Validador), para saber con qué rol se entró. El usuario ve solo "Explore Fair".
- **Hoja inferior:** sube desde abajo sobre un velo oscuro, con un asa y un botón de cerrar. Se cierra tocando el velo, con ese botón o con Escape.
- **Hoja de confirmación:** toda acción que anula o borra algo se confirma en una hoja inferior con título en forma de pregunta, la consecuencia en una frase, el botón de acción y "Cancelar" como botón de solo texto.
- **Confirmación reforzada:** si la acción afecta a todos y no se puede deshacer desde la app, además hay que escribir una palabra.
- **Mensaje guía:** franja con ícono, título y una línea, siempre debajo del saludo. Azul suave para orientar; verde suave para confirmar una operación terminada.
- **Estado sin datos:** ícono en un círculo gris, título de 20 px y una línea de apoyo.
- **Cargando y error:** mientras llegan los datos se ve un indicador giratorio con "Cargando…". Si fallan, "No pudimos cargar" con un botón "Reintentar".
- **Acceso cambiado:** si a la persona le cambian el rol o las vistas mientras tiene la app abierta, sale la hoja "Tu acceso cambió" y la app se vuelve a abrir.

## Navegación

- **Botón de actualizar:** ícono circular al final de la cabecera de cada vista, salvo el quiz. Solo lo ven el líder y el admin: el `USUARIO` no lo tiene, porque la sala de espera y el mapa ya se actualizan solos y, si algo cambió, la app se vuelve a abrir. Vuelve a pedir los datos de esa vista sin recargar la página y, a la vez, comprueba si a la persona le cambiaron el rol o las vistas. Mientras carga, el ícono gira y el botón no responde.

- **Barra inferior:** un destino por cada vista del rol, en este orden: Mapa, Charlas, Código, Preguntas, Panel, Ranking, Espera. El activo se marca con una píldora de color detrás del ícono. Si el rol tiene un solo destino, la barra no se muestra.

  Con las filas de referencia de `Permisos`:

  | Rol | Destinos |
  |---|---|
  | `USUARIO` | Solo Mapa (evento) o solo Charlas (semana previa): sin barra |
  | `LIDER` | Solo Código: sin barra |
  | `EXPOSITOR` | Solo Preguntas: sin barra |
  | `PONENTE` | Código y Preguntas |
  | `VALIDADOR` | Mapa, Charlas, Preguntas e Ingresos (y Espera mientras la sala está activa) |
  | `ADMIN` | Además de lo anterior, Ingresos (solo `ADMIN` y `VALIDADOR` la reciben) |
  | `ADMIN` | Mapa, Charlas, Código, Panel y Ranking |

- **La barra se oculta** en todo el quiz (código, preguntas, resultado y tiempo agotado), para no ofrecer salidas a mitad, y en la pantalla de ranking cuando se activa "Ocultar menú de navegación".
- **Flecha de volver** arriba a la izquierda en código, resultado y tiempo agotado; lleva al mapa o, si el quiz era de una charla, a la agenda de charlas. Durante las preguntas no hay flecha.

## Mensajes y textos

- **Trato de tú**, frases cortas, sin tecnicismos.
- **Lenguaje neutro en género:** "Te damos la bienvenida" en lugar de "Bienvenido".
- **Los errores dicen qué hacer**, no solo qué falló.
- **Mensajes temporales (toast):** barra oscura sobre la navegación, unos 3 segundos. Se usan para acciones que no abren pantalla, como tocar el quiz de entrada ya respondido.
- **Aviso con cierre (toast largo):** tarjeta oscura pegada abajo, con ícono de información, título, texto, botón de cerrar y una barra que se vacía durante 8 segundos, tiempo tras el cual se cierra sola. Un toque en cualquier parte la cierra antes. Con la barra de navegación a la vista, va encima de ella; se cierra sola al cambiar de vista o abrir una hoja. Hoy solo la ve el validador (`mostrarAviso` en `comun-script.html`): en el quiz de un pabellón o charla, para decir cuántas preguntas responde un usuario en el evento, y en Preguntas, para decir que los expositores y ponentes las actualizarán según su presentación.
- **Puntos:** "pts" en espacios chicos, "puntos" cuando hay lugar.

## Estados de un pabellón o una charla

| Estado | Dónde se ve | Cómo se ve |
|---|---|---|
| Pendiente | Pantalla del quiz; agenda de charlas | Botón "Responder el quiz del pabellón" / "Ingresar código" |
| En curso | Pantalla del quiz; agenda de charlas | Botón "Continuar el quiz" |
| Respondido | Hoja del pabellón, mapa, agenda de charlas | Check verde, aciertos y puntos; llena el arco del pabellón y suma a los puntos |
| Vencido | Hoja del pabellón; agenda de charlas | Mensaje "Se te venció el tiempo", 0 pts; no permite reintento |

## Elementos solo del prototipo

No pasaron a la versión real:

- **Usuario:** el enlace "Prototipo: ver como usuario nuevo", la nota bajo el campo de código, los códigos de prueba `0000` y `9999`, el ranking y el indicador de puesto del mapa.
- **Líder:** los enlaces "Prototipo: hacer que venza en 10 segundos" y "Prototipo: ver como líder de todo el pabellón", y el ranking.
- **Admin:** el enlace "Prototipo: restaurar datos de ejemplo" y la espera simulada del reinicio.
- **En los tres:** los datos de ejemplo, las preguntas de relleno y toda lógica que en la versión real corre en el servidor (corrección, generación de códigos, borrado).

## Pendiente de confirmar

1. **Pabellón completo con stands vencidos:** hoy un pabellón con un stand vencido nunca obtiene el check. La alternativa es darlo cuando ya no queda ningún stand por intentar.
2. **Arco de avance del pabellón:** se mantiene mientras no se perciba como obligación de completar el pabellón.
3. **Stands dentro de una hoja:** la alternativa es que el mapa cambie y muestre los stands alrededor al tocar un pabellón.
4. **Colores de pabellón:** propuestos a partir de la paleta de Google; pendientes de validar con la identidad de la feria.
5. **Umbral del reloj en rojo:** el quiz del usuario avisa a los 30 segundos y el código del líder a los 60. Falta decidir si se unifican.
6. **Código sin caracteres confusos y sin acción de anular:** decisiones del prototipo del líder, no confirmadas.
7. **Copia antes del reinicio y palabra de confirmación:** decisiones del prototipo del admin, no confirmadas.
