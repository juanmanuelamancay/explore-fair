# Reglas de UX y UI

Última actualización: 2026-10-05

Reglas de diseño de la aplicación, extraídas de los tres prototipos:

| Prototipo | Rol | Vistas |
|---|---|---|
| [prototipo/usuario.html](../../prototipo/usuario.html) | `USUARIO` | `MAPA`, `QUIZ`, `RANKING` |
| [prototipo/lider.html](../../prototipo/lider.html) | `LIDER` | `GENERAR_CODIGO`, `RANKING` |
| [prototipo/admin.html](../../prototipo/admin.html) | `ADMIN` | `PANEL_ADMIN`, `RANKING` |

La vista `BOARD` (pantalla gigante) aún no tiene prototipo; cuando se diseñe, sigue las mismas reglas base y agrega aquí las suyas.

## Principios

1. **Primero el celular.** El usuario usa la app de pie, en una feria, con una mano. Todo se diseña para 375 px de ancho y se centra con un máximo de 480 px en pantallas más grandes.
2. **Estilo Google, minimalista.** Fondo blanco, bordes finos, mucho espacio y color solo donde aporta significado.
3. **Nadie está obligado a visitarlo todo.** La interfaz muestra lo ganado, nunca lo que falta. No se muestran contadores como "3 de 19 stands" ni barras de avance global.
4. **Una acción principal por pantalla.** Un solo botón relleno; lo demás es secundario.
5. **El servidor decide.** La interfaz nunca recibe la respuesta correcta ni calcula el puntaje. En el prototipo esos puntos están marcados con `SERVIDOR`.

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

Una franja fija de 4 px con los cuatro colores de Google (`#4285f4`, `#ea4335`, `#fbbc04`, `#34a853`) corona todas las pantallas.

### Color por pabellón

Cada pabellón tiene un color y un tinte claro del mismo tono. El color identifica al pabellón en el mapa, en su hoja de stands y en la etiqueta de las pantallas de quiz.

| Pabellón | Color | Tinte |
|---|---|---|
| Backend | `#1a73e8` | `#e8f0fe` |
| Frontend | `#d93025` | `#fce8e6` |
| Quality | `#188038` | `#e6f4ea` |
| Seguridad | `#e37400` | `#fef7e0` |
| Data | `#9334e6` | `#f3e8fd` |
| Host | `#c2185b` | `#fce4ec` |

Un pabellón nuevo necesita un color propio de la misma familia (tono saturado más tinte claro) que no se confunda con los existentes. Hoy los colores están en el código del prototipo; si los pabellones se administran desde el panel, el color debe pasar a ser un campo de `Pabellones`.

### Tipografía

- **Fuente:** Roboto, cargada desde Google Fonts, con la fuente del sistema como respaldo.
- **Pesos:** 400 para texto y títulos grandes, 500 para énfasis. No se usa negrita pesada salvo en abreviaturas de stand.
- **Códigos:** Roboto Mono, para que cada carácter se distinga. Se usa en el campo donde el usuario escribe el código, en el código que muestra el líder y en la palabra de confirmación del admin.
- **Tamaños:** 16 px de base; 20–24 px en títulos y enunciados; 12–14 px en texto de apoyo. Nunca menos de 11 px.
- **Cifras protagonistas:** el dato principal de una pantalla puede ser más grande: 28–32 px en el resultado del quiz y 64 px en el código del líder, que debe leerse a distancia.
- **Números que cambian** (puntaje, puesto, reloj) usan cifras tabulares para que no salten.

### Formas

- **Botones:** píldora de 52 px de alto mínimo. Principal en azul relleno con texto blanco; secundario con borde y texto azul; de solo texto para cancelar; deshabilitado en gris.
- **Botones destructivos:** con borde y texto rojo para abrir la confirmación, y rojo relleno solo para el paso final que ejecuta el borrado.
- **Tarjetas:** borde de 1 px, radio de 24 px, sin sombra.
- **Listas y opciones:** radio de 16 px.
- **Círculos:** para todo lo que representa a una persona, un pabellón o un stand.
- **Sombra:** solo en elementos que flotan sobre el contenido (el círculo del usuario y la fila propia fija del ranking).

### Medallas de puesto

Los tres primeros puestos se muestran siempre igual, en cualquier vista:

| Puesto | Metal | Fondo | Borde | Texto | Corona |
|---|---|---|---|---|---|
| 1 | Oro | `#fef7e0` | `#f9ab00` | `#b06000` | `#fbbc04` |
| 2 | Plata | `#f1f3f4` | `#9aa0a6` | `#5f6368` | `#bdc1c6` |
| 3 | Bronce | `#fbe9e0` | `#c5733a` | `#8a4720` | `#d98e5a` |

- **Forma:** el mismo círculo de siempre, con borde de 2 px del metal, un anillo blanco fino por dentro y una corona pequeña y plana encima, sin brillos ni degradados.
- **Del cuarto puesto en adelante:** círculo neutro, sin corona.
- **Dónde se usa:** lista de premios de la sala de espera, podio y lista del ranking, y el indicador de puesto del mapa, que lleva la corona sobre su recuadro cuando la persona va entre los tres primeros.
- **En el código:** clases `oro`, `plata` y `bronce`, y las funciones `medalla` y `avatarDePuesto` de `comun-script.html`.

### Iconos

Iconos de línea de 2 px, sin relleno, dibujados en SVG dentro del archivo. No se usan emojis ni librerías de iconos externas.

## Reglas para celular

- **Área táctil mínima:** 44 × 44 px en todo lo que se pueda tocar.
- **Campos de texto con 16 px o más**, para que el celular no haga zoom al enfocarlos.
- **Sin desplazamiento horizontal** en ninguna pantalla.
- **Zonas seguras:** la navegación inferior y las hojas respetan `env(safe-area-inset-bottom)`.
- **Movimiento reducido:** animaciones y transiciones se desactivan con `prefers-reduced-motion`.
- **Accesibilidad:** cada botón sin texto lleva `aria-label`; los mensajes temporales usan `aria-live`; las opciones del quiz se anuncian como grupo de radio.

## Pantallas del usuario

El usuario tiene tres vistas, que corresponden a los valores de `vista` en la hoja `Permisos`:

| `vista` | Pantallas que incluye |
|---|---|
| `MAPA` | Mapa (inicio) y hoja de stands |
| `QUIZ` | Ingreso de código, preguntas, resultado y tiempo agotado |
| `RANKING` | Ranking |

### Mapa (inicio)

De arriba hacia abajo:

1. **Cabecera:** saludo con el nombre a la izquierda y un recuadro compacto con dos KPI a la derecha: puntos y puesto. Tocar el puesto lleva al ranking. Si la persona va entre los tres primeros, el puesto lleva la corona de su metal.
2. **Mensaje guía:** franja azul suave con un ícono, un título y una línea de instrucción. Cambia según el momento:
   - Sin quiz de entrada: da la bienvenida e indica pulsar el círculo propio para abrir los pabellones.
   - Con quiz de entrada hecho: indica escuchar la charla y pulsar el pabellón.
3. **Ayuda "Cómo se juega":** botón secundario debajo del mensaje guía que abre una hoja con cuatro pasos: entrar a un pabellón, escuchar al líder y pedir el código, responder el quiz y revisar puntos/ranking.
4. **Mapa radial:** el usuario en el centro y los pabellones repartidos alrededor en un círculo.

Reglas del mapa:

- **El círculo central es el usuario y también el botón del quiz de entrada.** Muestra sus iniciales. Mientras el quiz está pendiente, tiene un anillo que late y la etiqueta "Empieza aquí". Una vez respondido, muestra un check verde y los puntos obtenidos.
- **El quiz de entrada va primero.** Mientras no esté terminado (respondido o con el tiempo vencido), los pabellones se muestran en gris con un candado y no se abren: al tocarlos sale un aviso que indica pulsar el círculo propio. El servidor aplica la misma regla, así que tampoco se puede empezar un stand por otra vía.
- **Apertura animada.** Al volver al mapa tras terminar el quiz de entrada, los pabellones se abren uno tras otro en el sentido del reloj: cada uno recupera su color, su candado salta y desaparece, y una onda de su color se expande. Dura alrededor de 1,6 segundos en total y la acompaña el mensaje "Ya puedes visitar los pabellones". Con movimiento reducido activado, aparecen abiertos sin animación.
- **El resultado se ve al instante.** Al volver de cualquier quiz, el mapa ya muestra el puntaje, el puesto y el estado del stand con lo que el navegador sabe, sin esperar al servidor. Cuando el servidor responde, sus datos reemplazan a los anteriores.
- **Alrededor van los pabellones, no los stands.** Los stands se ven al tocar el pabellón.
- **Cada pabellón muestra** su ícono, su nombre, los puntos ganados ahí (solo si hay) y un arco de su color que crece con los stands respondidos.
- **Pabellón completo:** cuando todos sus stands están respondidos a tiempo, lleva el mismo check verde que el círculo central.
- **Las posiciones se calculan** según la cantidad de pabellones, empezando arriba. Agregar un pabellón no requiere rediseñar.

### Hoja de stands

Al tocar un pabellón sube una hoja desde abajo, sobre un velo oscuro. Se cierra tocando el velo o con Escape.

- **Encabezado:** ícono y nombre del pabellón; dice "Pabellón completo" cuando corresponde.
- **Stand pendiente:** fila tocable con abreviatura, nombre, cantidad de preguntas y puntos posibles. Lleva a la pantalla del código.
- **Stand respondido:** fila no tocable con aciertos, check verde y puntos.
- **Stand vencido:** fila atenuada, no tocable, con "Se venció el tiempo" y 0 pts.
- **Pie:** recordatorio de que se necesita el código del líder.

### Ingreso de código

- Muestra el stand, cuántas preguntas tiene, el tiempo disponible y los puntos posibles antes de pedir nada.
- **Campo de código:** 4 caracteres, se convierte a mayúsculas y solo acepta letras y números. El botón "Empezar" se habilita al completar los 4.
- **Código inválido o vencido:** el campo se marca en rojo, tiembla una vez y muestra un mensaje que dice qué hacer ("Pídele uno nuevo al líder").
- **Aviso fijo:** el tiempo corre desde que se empieza y hay un solo intento.
- **El quiz de entrada** usa esta misma pantalla sin el campo de código.

### Preguntas

- **Una pregunta por pantalla.**
- **Cabecera fija al desplazar:** pabellón, stand, reloj y una barra de pasos.
- **Reloj:** cuenta regresiva siempre visible. En los últimos 30 segundos pasa a rojo.
- **Opciones:** botones de ancho completo con letra A–D. La elegida se marca con borde y fondo azul. Se puede cambiar antes de avanzar.
- **Solo se avanza.** No hay botón para volver a la pregunta anterior ni para salir del quiz.
- **Botón:** "Siguiente", y "Enviar respuestas" en la última. Deshabilitado hasta elegir una opción.
- **No se indica si acertó** hasta enviar todo.

### Resultado

- Anillo verde con los aciertos sobre el total, puntos ganados y el cambio de puesto.
- Lista de las preguntas con check o equis. **No se muestra cuál era la respuesta correcta**, para que no se pase entre usuarios.
- Acción principal "Volver al mapa"; secundaria "Ver ranking".

### Tiempo agotado

Pantalla propia, en tono neutro (gris, sin rojo): explica que ese stand no suma y recuerda que puede seguir sumando en los demás.

### Ranking

- **Podio** con los tres primeros en oro, plata y bronce: el avatar con las iniciales toma el metal y lleva una corona encima, y la base del podio se pinta del mismo metal.
- **Lista** del cuarto en adelante: puesto, iniciales, nombre, stands respondidos y puntos.
- **Con menos de tres personas no hay podio:** todos van en la lista, y sus avatares llevan igualmente el metal y la corona de su puesto.
- **La fila propia** va resaltada en azul suave y con "(tú)".
- **Fila propia fija:** si la fila del usuario no está a la vista, una copia flota sobre la navegación inferior.
- Nota al pie con la regla de desempate.
- **Actualización:** se trae del servidor cada vez que se entra a la vista y luego sola cada `segundos_refresco_board` (mínimo 15 segundos). Se pausa con el celular bloqueado o la app en segundo plano, y al volver se actualiza de inmediato.

## Sala de espera

Es lo que ve un usuario antes del evento, mientras `espera_activa` está en TRUE. No tiene barra inferior: es su única vista. De arriba hacia abajo:

- **Cuenta regresiva:** cuatro recuadros (días, horas, minutos, segundos) que avanzan cada segundo según la hora del servidor, con la fecha, el lugar y un mensaje opcional debajo. Sin fecha configurada dice "Muy pronto".
- **Llegada la hora:** la cuenta se reemplaza por "Llegó el día" y la app pregunta al servidor una vez por minuto si ya se abrió; cuando `espera_activa` pasa a FALSE, la pantalla cambia sola al mapa. El botón de actualizar hace lo mismo al instante.
- **Carrusel:** debajo de la cuenta va una fila de láminas que empieza en Premios, sigue con Cómo se juega y continúa con una tarjeta por cada pabellón. Se pasa de una a otra deslizando con el dedo.
- **Puntos:** bajo el carrusel hay un punto por lámina; el de la lámina a la vista se alarga y se pinta de azul. Tocar un punto lleva a esa lámina.
- **Avance solo:** cambia de lámina cada 6 segundos y al llegar a la última vuelve a Premios. Se detiene 12 segundos cuando la persona lo toca, y no avanza con la app en segundo plano, con movimiento reducido activado, ni cuando la persona ya bajó y dejó el inicio del carrusel fuera de la pantalla.
- **Alto variable:** el carrusel toma el alto de la lámina a la vista.
- **Premios:** lista con la medalla de cada puesto (ver "Medallas de puesto"). Si no hay premios cargados, esa lámina no aparece y el carrusel empieza en Cómo se juega.
- **Cómo se juega:** tres pasos fijos.
- **Tarjeta de pabellón:** ícono y nombre en su color, cantidad de stands y la lista de sus stands con su abreviatura. Es solo informativa, no se puede tocar. Un pabellón nuevo en el Sheet agrega su tarjeta sin tocar código.

## Pantallas del líder

El líder no compite: no tiene mapa ni quiz. Su inicio es la pantalla de generar código.

### Generar código

De arriba hacia abajo: saludo, mensaje guía, stand y tarjeta del código. No lleva KPI, contador de personas ni historial de códigos.

- **Mensaje guía:** sin código activo indica generarlo al terminar la charla; con código activo indica compartirlo en voz alta o mostrando la pantalla.
- **Stand:** si el líder tiene un solo stand, se muestra fijo con su abreviatura y pabellón. Si lidera todo el pabellón, elige el stand con fichas horizontales; un punto verde marca los que tienen código activo.
- **Tarjeta sin código:** ícono neutro, "Sin código activo", cuánto dura y para qué stand sirve, y el botón principal "Generar código".
- **Tarjeta con código activo:** el código en 64 px, una barra que se vacía, el tiempo restante para ingresarlo y el botón secundario "Generar uno nuevo". En el último minuto la barra y el tiempo pasan a rojo.
- **Tarjeta con código vencido:** el código tachado en gris y el botón principal "Generar código nuevo".
- **Reemplazar un código activo** pide confirmación en una hoja inferior: avisa que el código actual deja de funcionar y que quienes ya entraron pueden terminar su quiz.
- **Caracteres del código:** 4, sin `0`, `O`, `1`, `I` ni `L`, para que no se confundan al dictarlos.
- **No hay acción de anular** sin generar otro: un código se reemplaza o se deja vencer.

## Pantallas del admin

### Panel

Tiene un editor relacional del catálogo, además de actualizar el catálogo y reiniciar los datos. De arriba hacia abajo: saludo, mensaje guía, lista de datos generados, pestañas del catálogo, búsqueda, filtros, editor y tarjeta de reinicio.

- **Secciones editables:** `Pabellones`, `Stands`, `Preguntas`, `Staff`, `Permisos`, `Config` y `Premios`. Cada fila permite editar o iniciar una baja; los formularios muestran selectores para las referencias a otras hojas.
- **Integridad:** el servidor valida claves únicas, roles y vistas válidos, relaciones activas y dependencias antes de escribir. El árbol de pabellones permite crear stands y preguntas en contexto. Eliminar un pabellón muestra los conteos, elimina sus stands y preguntas, anula sus códigos activos y conserva los intentos históricos.
- **Búsqueda y estado:** por defecto se muestran solo registros activos. El filtro permite consultar también los inactivos sin mezclarlos visualmente con los activos.

- **Tarjeta "Actualizar desde el Sheet":** botón secundario "Actualizar ahora". Hace que la app relea las hojas de catálogo en el momento y confirma con un mensaje temporal cuántos pabellones, stands y preguntas activas encontró.

- **Datos generados durante la feria:** lista con `Intentos`, `Codigos` y `Usuarios` y su cantidad de filas. Una cantidad en cero se muestra en gris.
- **Tarjeta "Reiniciar la feria":** explica el efecto y separa en dos listas lo que se borra (equis roja) y lo que se conserva (check verde).
- **Botón "Reiniciar datos":** destructivo con borde. Si no hay nada que borrar, queda deshabilitado y dice "No hay datos que borrar".
- **Confirmación:** hoja inferior con el número exacto de filas a borrar sobre fondo rojo suave, el aviso de que se guarda una copia y un campo donde hay que escribir `REINICIAR`. El botón rojo relleno se habilita solo cuando la palabra coincide.
- **Durante la ejecución:** el botón muestra un indicador giratorio y "Reiniciando…", y no se puede volver a tocar.
- **Resultado:** el mensaje guía pasa a verde con lo borrado y el nombre de la copia; los contadores quedan en cero y se muestra la hora del último reinicio.

## Patrones compartidos

- **Ranking sin fila propia:** el líder y el admin ven el mismo podio y lista que el usuario, sin fila resaltada ni fila fija, porque no compiten.
- **Ranking vacío:** cuando no hay puntajes se muestra una tarjeta con ícono neutro, "Aún no hay puntajes" y una línea que explica cuándo se llena.
- **Hoja de confirmación:** toda acción que anula o borra algo se confirma en una hoja inferior con título en forma de pregunta, la consecuencia en una frase, el botón de acción y "Cancelar" como botón de solo texto. Se cierra tocando el velo o con Escape.
- **Confirmación reforzada:** si la acción afecta a todos y no se puede deshacer desde la app, además hay que escribir una palabra.
- **Mensaje guía:** franja con ícono, título y una línea, siempre debajo del saludo. Azul suave para orientar; verde suave para confirmar una operación terminada.
- **Estado sin datos:** ícono en un círculo gris, título de 20 px y una línea de apoyo.

## Navegación

- **Botón de actualizar:** ícono circular al final de la cabecera en Mapa, Ranking, Código y Panel. Vuelve a pedir los datos de esa vista sin recargar la página. Mientras carga, el ícono gira y el botón no responde. No aparece dentro del quiz.

- **Barra inferior** con dos destinos según el rol. El activo se marca con una píldora de color detrás del ícono.

  | Rol | Destinos |
  |---|---|
  | `USUARIO` | Mapa, Ranking |
  | `LIDER` | Código, Ranking |
  | `ADMIN` | Panel, Ranking |

- **La barra se oculta** en las pantallas de código, preguntas, resultado y tiempo agotado del usuario, para no ofrecer salidas a mitad del quiz.
- **Flecha de volver** arriba a la izquierda en código, resultado y tiempo agotado; siempre lleva al mapa.

## Mensajes y textos

- **Trato de tú**, frases cortas, sin tecnicismos.
- **Lenguaje neutro en género:** "Te damos la bienvenida" en lugar de "Bienvenido".
- **Los errores dicen qué hacer**, no solo qué falló.
- **Mensajes temporales (toast):** barra oscura sobre la navegación, unos 3 segundos. Se usan para acciones que no abren pantalla, como tocar el quiz de entrada ya respondido.
- **Puntos:** "pts" en espacios chicos, "puntos" cuando hay lugar.

## Estados de un stand

| Estado | Dónde se ve | Cómo se ve |
|---|---|---|
| Pendiente | Hoja de stands | Fila tocable con flecha y puntos posibles |
| Respondido | Hoja de stands, mapa | Check verde y puntos; suma al arco y a los puntos del pabellón |
| Vencido | Hoja de stands | Fila atenuada con 0 pts; no suma al arco ni permite reintento |

## Elementos solo del prototipo

No deben pasar a la versión real:

- **Usuario:** el enlace "Prototipo: ver como usuario nuevo", la nota bajo el campo de código y los códigos de prueba `0000` y `9999`.
- **Líder:** los enlaces "Prototipo: hacer que venza en 10 segundos" y "Prototipo: ver como líder de todo el pabellón".
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
8. **Admin sin mapa ni quiz en su prototipo:** `Permisos` le da `MAPA`, `QUIZ`, `GENERAR_CODIGO` y `BOARD`, pero su prototipo solo tiene Panel y Ranking. Falta definir cómo llega a las demás vistas.
