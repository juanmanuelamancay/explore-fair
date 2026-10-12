# Reglas de UX y UI

Última actualización: 2026-10-09 (versión del código `2026-10-09.3`)

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

Las variables están en `comun-style.html`. Una franja fija de 4 px con los cuatro colores de Google (`#4285f4`, `#ea4335`, `#fbbc04`, `#34a853`) corona todas las pantallas.

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

Los colores no están atados al nombre: salen de la lista `PALETA` de `comun-script.html` según la posición del pabellón en el mapa. Un séptimo pabellón repite el primer color. Si se quiere elegir el color de cada pabellón, tiene que pasar a ser un campo de `Pabellones`.

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

Los cuatro primeros puestos (uno por premio) se muestran siempre igual, en cualquier vista:

| Puesto | Metal | Fondo | Borde | Texto | Corona |
|---|---|---|---|---|---|
| 1 | Oro | `#fef7e0` | `#f9ab00` | `#b06000` | `#fbbc04` |
| 2 | Plata | `#f1f3f4` | `#9aa0a6` | `#5f6368` | `#aab0b7` (contorno `#6f757c`) |
| 3 | Bronce | `#fbe9e0` | `#c5733a` | `#8a4720` | `#d98e5a` |
| 4 | Azul | `--azul-suave` | `--azul` | `--azul` | `#8ab4f8` |

- **Forma:** el mismo círculo de siempre, con borde de 2 px del metal, un anillo blanco fino por dentro y una corona pequeña y plana encima, sin brillos ni degradados.
- **Del quinto puesto en adelante:** círculo neutro, sin corona (en la lista de premios de la sala de espera, azul con corona).
- **Dónde se usa:** lista de premios de la sala de espera, y podio y cuadrícula del ranking.
- **En el código:** clases `oro`, `plata`, `bronce` y `azul`, y las funciones `medalla` y `avatarDePuesto` de `comun-script.html`.

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

El usuario tiene dos vistas, que corresponden a los valores de `vista` en la hoja `Permisos`:

| `vista` | Pantallas que incluye |
|---|---|
| `MAPA` | Mapa (inicio), hoja de stands y hoja "Cómo participar" |
| `QUIZ` | Ingreso de código, preguntas, resultado y tiempo agotado |

No tiene barra inferior, porque su único destino es el mapa.

### Mapa (inicio)

De arriba hacia abajo:

1. **Cabecera:** la marca "Explore Fair" (sin rol), el saludo con el nombre, un recuadro compacto con los puntos y el botón de actualizar. No muestra el puesto.
2. **Mensaje guía:** franja azul suave con un ícono, un título y una línea de instrucción. Cambia según el momento:
   - Sin quiz de entrada: da la bienvenida e indica responderlo para abrir los pabellones.
   - Con quiz de entrada terminado: indica escuchar la charla y pulsar el pabellón.
3. **Ayuda:** la franja del mensaje guía es un botón. Su ícono alterna entre una mano y un signo de pregunta, y al tocarla abre la hoja "Cómo participar", con cuatro pasos: empezar con el quiz de entrada, recorrer la feria y escuchar una charla, abrir el quiz del stand con el código, y responder para sumar puntos. El último paso aclara que los puestos se ven en la pantalla grande de la feria.
4. **Mapa radial:** bajo el título "Pabellones", el usuario en el centro y los pabellones repartidos alrededor en un círculo.

Reglas del mapa:

- **El círculo central es el usuario y también el botón del quiz de entrada.** Muestra sus iniciales. Mientras el quiz está pendiente, tiene un anillo que late y la etiqueta "Empieza aquí"; si lo dejó a medias, dice "Continúa aquí". Una vez respondido, muestra un check verde y los puntos obtenidos. Si se le venció, dice "Sin puntaje".
- **El quiz de entrada va primero.** Mientras no esté terminado (respondido o con el tiempo vencido), los pabellones se muestran en gris con un candado y no se abren: al tocarlos sale un aviso que indica pulsar el círculo propio. El servidor aplica la misma regla, así que tampoco se puede empezar un stand por otra vía.
- **Apertura animada.** Al volver al mapa tras terminar el quiz de entrada, los pabellones se abren uno tras otro en el sentido del reloj: cada uno recupera su color, su candado salta y desaparece, y una onda de su color se expande. Con seis pabellones dura alrededor de 1,6 segundos en total y la acompaña el mensaje "Ya puedes visitar los pabellones". Con movimiento reducido activado, aparecen abiertos sin animación.
- **El resultado se ve al instante.** Al volver de cualquier quiz, el mapa ya muestra el puntaje y el estado del stand con lo que el navegador sabe, sin esperar al servidor. Cuando el servidor responde, sus datos reemplazan a los anteriores.
- **Suma animada.** Al volver de un stand respondido, el arco de su pabellón crece desde donde estaba, un "+N" sube sobre el pabellón, el número de puntos de la cabecera da un pulso y un mensaje temporal dice cuántos puntos se sumaron.
- **Alrededor van los pabellones, no los stands.** Los stands se ven al tocar el pabellón.
- **Cada pabellón muestra** su ícono, su nombre corto (`nombre_corto`, o `nombre` si no hay), los puntos ganados ahí (solo si hay) y un arco de su color que crece con los stands respondidos.
- **Pabellón completo:** cuando todos sus stands están respondidos a tiempo, lleva el mismo check verde que el círculo central.
- **Las posiciones se calculan** según la cantidad de pabellones, empezando arriba. Agregar un pabellón no requiere rediseñar.

### Hoja de stands

Al tocar un pabellón sube una hoja desde abajo, sobre un velo oscuro. Se cierra tocando el velo, con su botón de cerrar o con Escape.

- **Encabezado:** ícono y nombre del pabellón; dice "Pabellón completo" cuando corresponde.
- **Cada fila** lleva un círculo con el estado del stand y su nombre. No muestra abreviatura, cantidad de preguntas ni puntos posibles, porque son iguales en todos los stands.
- **Stand pendiente:** fila tocable con flecha. Lleva a la pantalla del código.
- **Stand en curso:** fila tocable con "En curso · toca para continuar". Retoma el quiz sin pedir el código.
- **Stand respondido:** fila no tocable con check verde, "N de 4 correctas" y los puntos.
- **Stand vencido:** fila atenuada, no tocable, con "Se venció el tiempo" y 0 pts.
- **Pie:** recordatorio de que se necesita el código del líder.

### Ingreso de código

- Muestra el stand, cuántas preguntas tiene, el tiempo disponible y los puntos posibles antes de pedir nada.
- **Campo de código:** 4 caracteres, se convierte a mayúsculas y solo acepta letras y números. El botón "Empezar" se habilita al completar los 4.
- **Código inválido o vencido:** el campo vuelve vacío, se marca en rojo, tiembla una vez y muestra un mensaje que dice qué hacer ("Pídele uno nuevo al líder"). "Empezar" sigue deshabilitado hasta escribir otros 4 caracteres.
- **Tres códigos incorrectos:** la persona queda bloqueada 120 segundos, en todos los stands. El campo se vacía, se marca en rojo y **deja de aceptar texto**; debajo dice "Fallaste el código 3 veces. Espera para volver a intentarlo." y el botón pasa a "Espera 1:58", contando hacia atrás. Al llegar a cero el campo se libera solo y el botón vuelve a "Empezar" (deshabilitado hasta escribir 4 caracteres). Durante la espera el código correcto tampoco entra. Si la persona sale al mapa y vuelve, sigue bloqueada.
- **Aviso fijo del código:** "Si fallas el código 3 veces, tendrás que esperar 2 minutos para volver a intentarlo." Los números salen del servidor (`FALLOS_DE_CODIGO_MAX` y `SEGUNDOS_BLOQUEO_CODIGO`).
- **El quiz de entrada** usa esta misma pantalla sin el campo de código, con el título "Listo para empezar" y el aviso "Solo tienes un intento."
- **Mientras el servidor arma el quiz** se ve una pantalla de espera animada: "Preparando tu quiz".

### Preguntas

- **Una pregunta por pantalla**, con el rótulo "Pregunta N de 4".
- **Cabecera fija al desplazar:** pabellón, stand, reloj y una barra de pasos.
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
- Un recuadro con "N de 4 correctas". **No se muestra qué preguntas acertó ni cuál era la respuesta correcta**, para que no se pase entre usuarios. El servidor ni siquiera envía el detalle por pregunta, así que tampoco se puede sacar desde el navegador.
- Acción principal "Volver al mapa". El botón secundario "Ver ranking" aparece solo si el rol tiene la vista `RANKING`, así que el usuario no lo ve.

### Tiempo agotado

Pantalla propia, en tono neutro (gris, sin rojo): explica que ese stand no suma y recuerda que puede seguir sumando en los demás.

## Sala de espera

Es lo que ve un usuario antes del evento, mientras `espera_activa` está en TRUE. No tiene barra inferior: es su única vista. De arriba hacia abajo:

- **Cuenta regresiva:** cuatro recuadros (días, horas, minutos, segundos) que avanzan cada segundo según la hora del servidor, con la fecha, el lugar y un mensaje opcional debajo. Sin fecha configurada dice "Muy pronto".
- **Llegada la hora:** la cuenta se reemplaza por "Llegó el día" y la app pregunta al servidor una vez por minuto si ya se abrió. Cuando `espera_activa` pasa a FALSE, la app se vuelve a abrir sola con el mapa; si el navegador no la deja, queda el aviso "Tu acceso cambió" con el botón "Abrir de nuevo". El botón de actualizar hace la misma comprobación al instante.
- **Carrusel:** debajo de la cuenta va una fila de láminas que empieza en el Objetivo, sigue con Cómo participar, continúa con una tarjeta por cada pabellón (su título de sección es "Descubre agentes de IA") y termina en Premios. Se pasa de una a otra deslizando con el dedo.
- **Puntos:** bajo el carrusel hay un punto por lámina; el de la lámina a la vista se alarga y se pinta de azul. Tocar un punto lleva a esa lámina.
- **Avance solo:** cambia de lámina cada 6 segundos y al llegar a la última vuelve a la primera. Se detiene 12 segundos cuando la persona lo toca, y no avanza con la app en segundo plano, con movimiento reducido activado, ni cuando la persona ya bajó y dejó el inicio del carrusel fuera de la pantalla.
- **Alto variable:** el carrusel toma el alto de la lámina a la vista.
- **Premios:** título, la frase "Participando y aprendiendo podrás ganar:" y la lista con la medalla de cada puesto (ver "Medallas de puesto"). La feria entrega cuatro premios; del cuarto puesto en adelante la medalla es azul, con corona azul (clase `azul` en `espera-style.html`). Es la última lámina. Si no hay premios cargados, no aparece y el carrusel termina en el último pabellón.
- **Objetivo:** primera lámina, texto fijo tomado de la invitación al evento: una frase sobre la experiencia práctica, la lista de seis cosas que se encontrarán en la feria (demos en vivo, retos técnicos, casos prácticos, buenas prácticas, espacio para dudas, dinámicas) y, en un recuadro azul, la frase con la que se espera que cada persona termine: "Sé qué agente puede ayudarme y cómo empezar a utilizarlo en mi día a día." Es la lámina más alta y se queda 25 segundos antes de avanzar (`data-segundos`), el resto 6.
- **Cómo participar:** titulada "Esta app te servirá para…", con la misma frase de apertura de la hoja de ayuda del mapa y tres pasos fijos: responder el quiz de entrada, visitar los stands (el código del líder desbloquea las preguntas de cada stand) y sumar puntos para subir en el ranking.
- **Tarjeta de pabellón:** ícono y nombre en su color, cantidad de stands y la lista de sus stands con su abreviatura. Es solo informativa, no se puede tocar. Un pabellón nuevo en el Sheet agrega su tarjeta sin tocar código.

El `ADMIN` ve esta misma pantalla como una pestaña más, "Espera", mientras la sala está activa.

## Pantallas del líder

El líder no compite: no tiene mapa ni quiz. Su inicio es la pantalla de generar código. Si `Permisos` le da también `PREGUNTAS`, tiene una barra inferior con Código y Preguntas.

### Generar código

De arriba hacia abajo: saludo, mensaje guía, stand y tarjeta del código. No lleva KPI, contador de personas ni historial de códigos.

- **Mensaje guía:** sin código activo indica generarlo al terminar la charla; con código activo indica compartirlo en voz alta o mostrando la pantalla.
- **Stand:** si el líder tiene un solo stand, se muestra fijo con su abreviatura y pabellón. Si lidera todo el pabellón, elige el stand con fichas horizontales; un punto verde marca los que tienen código activo.
- **Tarjeta sin código:** ícono neutro, "Sin código activo", cuánto dura y para qué stand sirve, y el botón principal "Generar código".
- **Mientras se genera:** cuatro casillas giran con caracteres al azar y se fijan una por una cuando llega el código real.
- **Tarjeta con código activo:** mismo encabezado y mismas cuatro casillas que al generar, ahora fijas con el código y con el título "Código listo"; debajo, una barra que se vacía, el tiempo restante para ingresarlo y el botón secundario "Generar uno nuevo". En el último minuto la barra y el tiempo pasan a rojo.
- **Tarjeta con código vencido:** las casillas en gris y el botón principal "Generar código nuevo". Se ve así mientras la pantalla siga abierta; al volver a entrar, el stand aparece "Sin código activo".
- **Reemplazar un código activo** pide confirmación en una hoja inferior: avisa que el código actual deja de funcionar y que quienes ya entraron pueden terminar su quiz.
- **Caracteres del código:** 4, solo consonantes y dígitos del 2 al 9. Sin vocales y sin `0`, `1` ni `L`, para que no se confundan al dictarlos.
- **No hay acción de anular** sin generar otro: un código se reemplaza o se deja vencer.
- **Sin stands asignados:** la tarjeta dice "No tienes stands asignados" y pide avisar a un administrador.

### Preguntas

Vista `PREGUNTAS`. El líder revisa y edita el banco de sus stands.

- **Stand:** si lidera varios, los elige con fichas horizontales; si es uno, se muestra fijo con su pabellón.
- **Resumen:** una fila de 16 puntitos y el texto "N de 16 activas", con el botón "Nueva".
- **Lista:** una tarjeta por pregunta, con su número y su enunciado. Las inactivas se ven atenuadas. Tocar una abre el editor.
- **Editor:** hoja inferior con el enunciado, las cuatro opciones y la respuesta correcta. No incluye los puntos ni el estado activo: esos los decide el administrador.
- **Banco lleno:** si el stand ya tiene 16 activas, el editor avisa que la pregunta nueva se guardará desactivada.
- **Mientras guarda:** los campos se bloquean, los botones se reemplazan por "Guardando…" y la hoja no se puede cerrar. Al terminar, un mensaje temporal confirma y la tarjeta editada destella una vez.

## Pantallas del admin

El admin tiene en la barra inferior todas las vistas que `Permisos` le dé: Mapa, Código, Preguntas, Panel, Ranking y, con la sala de espera activa, Espera.

### Panel

De arriba hacia abajo: saludo, mensaje guía, editor del catálogo, tarjeta "Actualizar desde el Sheet", tarjeta "Usuarios registrados" y tarjeta "Reiniciar la feria".

Editor del catálogo:

- **Pestañas:** `Pabellones`, `Staff`, `Permisos`, `Configuración` y `Premios`. Los stands y las preguntas no tienen pestaña: se editan dentro de su pabellón.
- **Botón "+":** agrega un registro a la pestaña abierta.
- **Búsqueda y estado:** un campo busca dentro de la pestaña. El interruptor "Solo activos" viene encendido; al apagarlo se ven también los inactivos, atenuados.
- **Pestaña Pabellones:** un árbol. Cada pabellón se despliega para mostrar sus stands, y cada stand muestra sus preguntas y el contador "N/16 preguntas · quiz aleatorio de 4". Dentro del árbol están "Añadir stand", "Añadir pregunta" y "Cargar JSON" (ver [formato](../datos/formato-preguntas-json.md)). Si el stand tiene líder, su nombre aparece en una tercera línea ("Líder: …").
- **Líder del stand:** el formulario del stand tiene el campo opcional "Correo del líder", prellenado con el líder actual. Al guardar, el servidor lo deja en `Staff` como `LIDER` de ese stand (nombre completado desde el directorio de Google o el correo) y el mensaje temporal dice quién quedó. Vacío quita al líder. Los rechazos (correo de un admin, de alguien que ya lidera otro stand, stand inactivo) salen como mensaje temporal y el formulario sigue abierto.
- **Pestaña Permisos:** una tarjeta por rol que se despliega y muestra sus vistas como fichas, con "Añadir vista".
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

### Ranking

Vista `RANKING`, solo del admin (una persona), para proyectar. Usa todo el ancho de la pantalla, con el contenido centrado hasta 1.400 px.

- **Cabecera:** título "Ranking", la hora de la última actualización, el botón de ajustes y el de actualizar.
- **Podio** con los cuatro primeros, uno por premio, en oro, plata, bronce y azul: el avatar con las iniciales toma el metal y lleva una corona encima, y la base del podio se pinta del mismo metal. De izquierda a derecha van el 2.º, el 1.º (el más alto), el 3.º y el 4.º.
- **Cuadrícula** del quinto en adelante: cada celda lleva puesto, nombre y puntos. Muestra las personas que caben en pantalla, o menos si los ajustes fijan una cantidad.
- **Pie:** hasta qué puesto se está mostrando, de cuántos, y la regla de desempate.
- **Menos de cuatro personas:** el podio muestra solo a quienes hay: con una, el 1.º; con dos, el 2.º y el 1.º; con tres, el 2.º, el 1.º y el 3.º. Sin nadie con puntaje, "Esperando los primeros puntajes".
- **Cambios:** quien sumó puntos desde la última actualización destella en verde y muestra un "+N" que se desvanece.
- **Actualización:** se trae del servidor al entrar y luego sola cada `segundos_refresco_board` (mínimo 10 segundos). Se pausa con la app en segundo plano y, al volver, se actualiza de inmediato. El botón de actualizar recalcula el ranking en ese momento.
- **Ajustes:** hoja con deslizadores para personas por pantalla, columnas, alto de fila, espacio entre filas, tamaño de nombres, tamaño de puntos, y tamaño y ancho del podio; dos interruptores, "Ocultar menú de navegación" y "Modo oscuro"; y "Restablecer valores". Cada cambio se ve al momento y se guarda en `Config` (claves `rp_*`); las demás pantallas abiertas lo toman en su siguiente actualización.
- **Pantalla angosta:** por debajo de 900 px la cuadrícula pasa a una columna y el podio ocupa todo el ancho.

## Patrones compartidos

- **Marca y rol:** la cabecera de cada vista del staff lleva "Explore Fair · Rol" (Líder, Admin, Validador), para saber con qué rol se entró. El usuario ve solo "Explore Fair".
- **Hoja inferior:** sube desde abajo sobre un velo oscuro, con un asa y un botón de cerrar. Se cierra tocando el velo, con ese botón o con Escape.
- **Hoja de confirmación:** toda acción que anula o borra algo se confirma en una hoja inferior con título en forma de pregunta, la consecuencia en una frase, el botón de acción y "Cancelar" como botón de solo texto.
- **Confirmación reforzada:** si la acción afecta a todos y no se puede deshacer desde la app, además hay que escribir una palabra.
- **Mensaje guía:** franja con ícono, título y una línea, siempre debajo del saludo. Azul suave para orientar; verde suave para confirmar una operación terminada.
- **Estado sin datos:** ícono en un círculo gris, título de 20 px y una línea de apoyo.
- **Cargando y error:** mientras llegan los datos se ve un indicador giratorio con "Cargando…". Si fallan, "No pudimos cargar" con un botón "Reintentar".
- **Acceso cambiado:** si a la persona le cambian el rol o las vistas mientras tiene la app abierta, sale la hoja "Tu acceso cambió" y la app se vuelve a abrir.

## Navegación

- **Botón de actualizar:** ícono circular al final de la cabecera de cada vista, salvo el quiz. Solo lo ven el líder y el admin: el `USUARIO` no lo tiene, porque la sala de espera y el mapa ya se actualizan solos y, si algo cambió, la app se vuelve a abrir. Vuelve a pedir los datos de esa vista sin recargar la página y, a la vez, comprueba si a la persona le cambiaron el rol o las vistas. Mientras carga, el ícono gira y el botón no responde.

- **Barra inferior:** un destino por cada vista del rol, en este orden: Mapa, Código, Preguntas, Panel, Ranking, Espera. El activo se marca con una píldora de color detrás del ícono. Si el rol tiene un solo destino, la barra no se muestra.

  Con las filas de referencia de `Permisos`:

  | Rol | Destinos |
  |---|---|
  | `USUARIO` | Solo Mapa: sin barra |
  | `LIDER` | Solo Código: sin barra. Con `PREGUNTAS`: Código y Preguntas |
  | `VALIDADOR` | Mapa y Preguntas (y Espera mientras la sala está activa) |
  | `ADMIN` | Mapa, Código, Panel y Ranking |

- **La barra se oculta** en todo el quiz (código, preguntas, resultado y tiempo agotado), para no ofrecer salidas a mitad, y en la pantalla de ranking cuando se activa "Ocultar menú de navegación".
- **Flecha de volver** arriba a la izquierda en código, resultado y tiempo agotado; siempre lleva al mapa. Durante las preguntas no hay flecha.

## Mensajes y textos

- **Trato de tú**, frases cortas, sin tecnicismos.
- **Lenguaje neutro en género:** "Te damos la bienvenida" en lugar de "Bienvenido".
- **Los errores dicen qué hacer**, no solo qué falló.
- **Mensajes temporales (toast):** barra oscura sobre la navegación, unos 3 segundos. Se usan para acciones que no abren pantalla, como tocar el quiz de entrada ya respondido.
- **Aviso con cierre (toast largo):** tarjeta oscura pegada abajo, con ícono de información, título, texto, botón de cerrar y una barra que se vacía durante 8 segundos, tiempo tras el cual se cierra sola. Un toque en cualquier parte la cierra antes. Con la barra de navegación a la vista, va encima de ella; se cierra sola al cambiar de vista o abrir una hoja. Hoy solo la ve el validador (`mostrarAviso` en `comun-script.html`): en el quiz de un stand, para decir cuántas preguntas responde un usuario en el evento, y en Preguntas, para decir que los líderes de cada stand las actualizarán según su presentación.
- **Puntos:** "pts" en espacios chicos, "puntos" cuando hay lugar.

## Estados de un stand

| Estado | Dónde se ve | Cómo se ve |
|---|---|---|
| Pendiente | Hoja de stands | Fila tocable con flecha |
| En curso | Hoja de stands | Fila tocable con "En curso · toca para continuar" |
| Respondido | Hoja de stands, mapa | Check verde, aciertos y puntos; suma al arco y a los puntos del pabellón |
| Vencido | Hoja de stands | Fila atenuada con 0 pts; no suma al arco ni permite reintento |

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
