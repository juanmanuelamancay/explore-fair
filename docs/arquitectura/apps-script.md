# Arquitectura del proyecto Apps Script

Última actualización: 2026-10-12 (versión del código `2026-10-12.6`)

El código de la web app está en la carpeta [appscript/](../../appscript/). Todos los archivos van en un solo nivel, porque Apps Script no tiene carpetas.

## Convención de archivos

Cada vista tiene cuatro archivos con el mismo prefijo:

| Archivo | Contenido |
|---|---|
| `<vista>.gs` | Funciones del servidor de esa vista |
| `<vista>-view.html` | El HTML de la vista: una `<section id="vista-<vista>" class="vista">` |
| `<vista>-style.html` | Sus estilos, dentro de `<style>` |
| `<vista>-script.html` | Su lógica en el navegador, dentro de `<script>` |

| Vista en `Permisos` | Prefijo | Funciones que el navegador puede llamar |
|---|---|---|
| `MAPA` | `mapa` | `obtenerMapa` |
| `QUIZ` | `quiz` | `iniciarQuiz`, `enviarQuiz` |
| `RANKING` | `ranking` | `obtenerRanking`, `guardarAjustesPantalla` |
| `GENERAR_CODIGO` | `generar-codigo` | `obtenerCodigos`, `generarCodigo` |
| `PREGUNTAS` | `preguntas` | `obtenerBancoPreguntas`, `guardarPreguntaLider` |
| `PANEL_ADMIN` | `panel-admin` | `obtenerPanel`, `obtenerAdminCatalogo`, `guardarAdminRegistro`, `importarPreguntasAdmin`, `borrarAdminRegistro`, `eliminarAdminPabellon`, `actualizarCatalogo`, `registrarPendientes`, `reiniciarDatos` |
| `ESPERA` (no va en `Permisos`) | `espera` | `obtenerEspera` |

La tabla que relaciona cada vista con su prefijo es `ARCHIVO_DE_VISTA`, en `main.gs`. Una vista que no esté ahí no existe para la app.

Además, cualquier rol puede llamar a `obtenerAcceso` (`sesion.gs`), que devuelve su propio rol, sus vistas y la dirección de la app, y a `registrarme` (`registro.gs`), que registra a quien llama en `Usuarios` si le corresponde.

La pantalla gigante es la vista `RANKING`; `RANKING_PANTALLA` ya no existe y, si queda escrita en `Permisos`, se ignora. `BOARD` no existe en el código: si está escrita a mano en `Permisos` no causa error, porque la app ignora las vistas que no conoce, pero el panel admin no deja crearla.

Archivos compartidos:

| Archivo | Contenido |
|---|---|
| `appsscript.json` | Manifiesto: zona horaria, permisos de Google, servicio avanzado Admin SDK y configuración de la web app |
| `main.gs` | `doGet`, que arma la página; `ARCHIVO_DE_VISTA`; `VERSION_DEL_CODIGO`, y la página de error |
| `datos.gs` | Nombres de las hojas, valores por defecto de `Config`, lectura y escritura de hojas, caché y catálogo |
| `sesion.gs` | Quién llama, qué rol tiene, qué vistas puede abrir, `exigirVista_`, `exigirAdmin_` y `obtenerAcceso` |
| `registro.gs` | Registro en `Usuarios` por lotes: el buzón de cartas, `registrarme`, el cartero (`repartir_`), el número de orden de cada persona, `completarUsuarios` y `prepararFeria` |
| `indice.gs` | Índice de intentos de cada persona en `UserProperties`, el bloqueo por persona y el bloque de filas de cada persona en `Intentos` |
| `datos-test.gs` | Diagnóstico: `probarTodo` se ejecuta desde el editor y registra si el Sheet, las hojas, el catálogo, las preguntas, la sesión y la caché están bien. `probarLimiteDeCodigos` comprueba, con la caché y el bloqueo reales, que 3 códigos incorrectos bloqueen la cuenta que la ejecuta |
| `pruebas-carga.gs` | Pruebas de carga y auditoría de puntajes, para ejecutar desde el editor |
| `prueba-registro.gs` | Prueba del registro por lotes, con bitácora de lo que hace el cartero, para ejecutar desde el editor |
| `prueba-feria.gs` | Prueba de carga de la feria completa: hasta 20 ejecuciones a la vez por cuenta registran personas y responden quizzes; revisa que no se pierda ni se repita nada y mide tiempos |
| `simulacion.gs`, `simulacion-puntajes.gs` | Simulaciones que escriben personas e intentos de mentira en las hojas reales |
| `index.html` | Página única: incluye los archivos de las vistas permitidas |
| `comun-style.html` | Colores, tipografía y componentes compartidos |
| `comun-script.html` | Navegación entre vistas, llamadas al servidor, iconos, paleta de pabellones y utilidades |

## Cómo se arma la página

1. `doGet` identifica a la persona por su cuenta de Google y busca su rol en `Staff`. Quien no está ahí es `USUARIO`.
2. Lee en `Permisos` las vistas de ese rol, se queda con las que existen en `ARCHIVO_DE_VISTA` y arma `index.html` incluyendo solo los archivos de esas vistas. Un usuario nunca recibe el HTML ni el código del panel admin.
3. Si el rol no tiene ninguna vista, relee el catálogo una vez. Si sigue sin vistas, muestra la página de error.
4. Averigua el nombre de la persona sin leer `Usuarios` (ver "Decisiones tomadas al programar", punto 1). Abrir la app no escribe en ninguna hoja.
5. Entrega a la página el objeto `INICIO`: nombre, rol, vistas, `minutos_para_responder`, `minutos_vigencia_codigo`, `segundos_refresco_board` y `registrar`, que indica si el navegador debe pedir el registro de la persona.
6. En el navegador, cada `<vista>-script.html` se registra con `App.registrar(nombre, { alMostrar, alOcultar, alRefrescar, sinNav })`.
7. `App.iniciar()` construye la barra inferior con las vistas disponibles y abre la primera. Cambiar de vista no recarga la página.
8. Si `INICIO.registrar` es verdadero, `App.iniciar()` llama en segundo plano a `registrarme` (ver "Registro por lotes").

El orden de la barra inferior es Mapa, Código, Preguntas, Panel, Ranking, Espera. `QUIZ` no aparece en la barra: se abre desde el mapa. Si el rol tiene un solo destino, la barra no se muestra.

Con la sala de espera activa (`espera_activa` en `Config`), quien tiene rol `USUARIO` recibe solo la vista `ESPERA`, y el `ADMIN` y el `VALIDADOR` la reciben como una pestaña más.

El `VALIDADOR` es un rol de solo lectura: `VISTAS_DEL_VALIDADOR` (`sesion.gs`) limita sus vistas a `MAPA`, `QUIZ` y `PREGUNTAS` aunque `Permisos` diga otra cosa. Para ver las preguntas de un quiz usa `verQuiz` (`quiz.gs`), que no pide código y no escribe nada; `iniciarQuiz` y `enviarQuiz` le responden "Tu rol no responde quizzes" y `guardarPreguntaLider` lo rechaza.

## Reglas del servidor

- **Permisos en cada función:** toda función de una vista empieza con `exigirVista_('<VISTA>')`. Ocultar una vista en el navegador no es seguridad. Las del panel que escriben comprueban además que el rol sea `ADMIN`.
- **Funciones del editor:** las que se ejecutan a mano (diagnóstico, pruebas de carga, prueba del registro, prueba de carga de la feria, simulaciones, `limpiarCache`, `releerIndiceDe`, `completarUsuarios`, `auditarRegistro`, `reconstruirRegistro`, `prepararFeria`) empiezan con `exigirAdmin_()`. Quien las ejecute tiene que estar en `Staff` como `ADMIN`. Las únicas funciones públicas sin comprobación de rol son `obtenerAcceso` y `probarNombre`, que solo informan sobre la propia cuenta, `registrarme`, que solo registra a la propia cuenta, y `diagnosticarAccesoPrueba`, que no puede pedir admin porque sirve justo cuando esa comprobación falla: solo corre si el script tiene la propiedad `DIAGNOSTICO = 1` (ver "Diagnóstico").
- **Funciones privadas:** las que terminan en `_` no se pueden llamar desde el navegador. Por eso los pasos que ejecutan los disparadores se llaman `pasoSimulacion_`, `pasoPuntajes_`, `pasoPruebaFilas_`, `pasoPruebaRegistro_` y `pasoPruebaCarga_`.
- **La respuesta correcta no llega al participante:** `iniciarQuiz` devuelve solo enunciado y opciones; `enviarQuiz` corrige contra el banco y devuelve solo cuántas acertó y los puntos: ni cuál era la correcta ni qué preguntas acertó, porque eso se pasaría entre personas. El detalle por pregunta queda en el índice y en `respuestas_json`, para la auditoría. Las vistas `PREGUNTAS` y `PANEL_ADMIN` sí la reciben, porque sirven para editarla.
- **Fallas esperadas como dato:** un código inválido o un stand ya respondido devuelven `{ ok: false, motivo, mensaje }`. Los motivos son `STAND`, `CERRADA`, `ENTRADA`, `CODIGO`, `BLOQUEADO`, `SIN_PREGUNTAS`, `YA_RESPONDIDO`, `VENCIDO` y `NO_EXISTE`. Las excepciones quedan para permisos y errores reales.
- **Límite de intentos de código:** 3 códigos incorrectos de una misma persona la bloquean 120 segundos (`FALLOS_DE_CODIGO_MAX` y `SEGUNDOS_BLOQUEO_CODIGO`, en `quiz.gs`). Se cuentan en su caché propia (`getUserCache`), dentro de su bloqueo por persona, para que varias llamadas en paralelo no se salten la cuenta. Durante el bloqueo, `iniciarQuiz` responde `BLOQUEADO` con `esperaSegundos` sin mirar el código (ni siquiera el correcto) y sin alargar la espera. Acertar borra la cuenta; los fallos también se olvidan 120 segundos después del último. Un campo vacío no cuenta. Solo aplica a quien intenta abrir un stand con código: retomar un quiz en curso no pasa por aquí. La caché es de mejor esfuerzo: si el sistema la vaciara antes de tiempo, la cuenta empezaría de cero.
- **Tiempo del servidor:** las horas viajan en milisegundos junto con `ahora`, y el navegador calcula su reloj a partir de esa diferencia. La hora del celular no cuenta.
- **Columnas por nombre:** las hojas se leen y escriben según el encabezado, no según la posición de la columna. La única posición que importa es la columna A: `leerHoja_` ignora las filas que la tienen vacía.
- **Sin distinguir mayúsculas:** nada de lo que se escribe a mano en el Sheet se compara tal cual. Nombres de pestaña, encabezados y claves de `Config` se comparan en minúsculas y sin tildes (`normal_`); los identificadores como `STD-001`, en mayúsculas (`id_`); roles, vistas, estados, códigos y la letra correcta, en mayúsculas; los correos, en minúsculas. También se ignoran los espacios al inicio y al final. `admin`, `Admin` y `ADMIN` valen lo mismo.

## Caché

El botón de actualizar de cada vista vuelve a pedir los datos al servidor, pero no borra la caché compartida. Si cada usuario la borrara al actualizar, cada petición volvería a leer las hojas completas y la app se pondría lenta justo cuando más gente la usa. Los intentos y el puntaje de cada persona no pasan por la caché compartida: salen de su índice (ver "Índice por persona").

Hay dos cachés: la compartida (`CacheService.getScriptCache`) y la propia de cada persona (`getUserCache`).

| Qué | Dónde | Duración | Se renueva o se descarta cuando |
|---|---|---|---|
| Catálogo (pabellones, stands, staff, permisos, config) | Compartida | `segundos_cache_catalogo`, entre 5 y 21.600 | Cambian `Staff`, `Permisos` o `Config`; se guardan los ajustes de la pantalla de ranking; hay una limpieza completa |
| Preguntas de cada stand | Compartida | `segundos_cache_catalogo` | Un líder guarda una pregunta de ese stand; hay una limpieza completa. Al empezar un quiz se relee sola, una vez, si la copia tiene menos de las 16 preguntas que hacen falta |
| Premios de la sala de espera | Compartida | `segundos_cache_catalogo` | Hay una limpieza completa |
| Ranking | Compartida | `segundos_cache_ranking`, mínimo 5 | Se pulsa actualizar en `RANKING`; hay una limpieza completa |
| Código vigente de cada stand | Compartida | `minutos_vigencia_codigo` | Se genera otro código para ese stand |
| Marca "roles al día" | Compartida | 30 segundos | Vence sola |
| Marca de pasada reciente del registro | Compartida | 5 segundos (`SEGUNDOS_ENTRE_REPARTOS`) | Vence sola |
| Pedido de releer el índice de alguien | Compartida | 6 horas | Esa persona entra y su índice se rearma |
| Nombre de la persona | Propia | 6 horas | Su fila se confirma en `Usuarios` (toma el nombre de la hoja); hay una limpieza completa |
| Marca "mi fila ya está en `Usuarios`" | Propia | 6 horas | Hay una limpieza completa |
| Hora de la primera llegada de un envío | Propia | 15 minutos | Vence sola |
| Fallos de código y fin del bloqueo | Propia | 120 segundos desde el último fallo | Acierta un código, o vence sola |

Una **limpieza completa** (`limpiarCache_`) cambia el prefijo de todas las claves, así que descarta todo de una vez. Ocurre cuando el admin pulsa "Actualizar ahora" en el panel, guarda, importa, desactiva o elimina algo desde el panel, o reinicia los datos; también al ejecutar `limpiarCache` o `limpiarSimulacion` desde el editor. Los usuarios y los líderes nunca la provocan.

Un valor de más de 90.000 caracteres no se guarda en caché. Con cerca de 1.000 personas el ranking puede superar ese tamaño, y entonces se recalcula en cada pedido; lo pide solo la pantalla del admin.

Un cambio hecho a mano en `Pabellones`, `Stands` o `Preguntas` tarda hasta `segundos_cache_catalogo` en verse en la app. El valor por defecto es 60 segundos; el plan de concurrencia (punto 1.8) pide ponerlo en 1800 en la hoja `Config` para la feria. Para verlo al instante, el admin pulsa "Actualizar ahora" en el panel: además de releer el catálogo, deja en caché las preguntas de todos los stands (con una sola lectura de `Preguntas`) y los premios, así que conviene pulsarlo antes de abrir la feria y no con mucha gente dentro. Nada de esto está fijo en el código: lo que muestra la app sale siempre de las hojas.

Lo que decide qué ve cada persona se revisa aparte. Al abrir la app y al pulsar actualizar, `sincronizarRoles_` compara `Staff`, `Permisos` y `Config` del Sheet con lo guardado y, si cambiaron, relee solo el catálogo. Lo hace como mucho una vez cada 30 segundos para toda la feria, así que un cambio hecho a mano en esas tres hojas tarda hasta 30 segundos en notarse. Quien ya tenía la app abierta y pierde una vista ve el aviso "Tu acceso cambió" en cuanto el servidor le rechaza un pedido, y la app se vuelve a abrir con lo que le corresponde. La página de error lee siempre el Sheet actual, no la copia guardada.

## Bloqueos

- **Por persona** (`getUserLock`): al validar un código, crear un intento, enviarlo y escribir un resultado pendiente. Dos personas distintas no se esperan entre sí. Al tomar el bloqueo se descarta lo que la petición había leído del índice y se lee de nuevo: otra petición de la misma persona pudo escribir mientras esta esperaba. Cada bloqueo confirma sus escrituras (`SpreadsheetApp.flush`) antes de soltarse.
- **Empezar y enviar un quiz no usan el turno global.** El turno hace falta para agregar una fila al final de una hoja, porque dos ejecuciones pueden ver la misma última fila y caer en el mismo lugar (en la prueba del punto 0.4 del plan sobrevivieron 286 de 1.000). Los intentos ya no se agregan al final: cada persona escribe en su propio bloque de filas (ver "Filas propias"). Antes, cada inicio de quiz pedía el turno, y la prueba de carga midió un techo de unos 50 inicios por minuto y de unas 15 personas empezando en el mismo instante.
- **Turno global para el registro** (`repartir_`, con `getScriptLock`): las filas nuevas de `Usuarios` se escriben por lotes, y en la misma pasada cada persona recibe su número de orden. Quien encuentra el turno ocupado no hace fila (ver "Registro por lotes").
- **Generar un código no usa el turno global.** Cada stand tiene su propia fila en `Codigos` y el código nuevo la reemplaza: la generación lee la hoja (unas 20 filas), escribe esa fila y deja el código en caché, sin esperar a otros líderes ni al registro. Las filas de los stands las deja puestas `prepararFeria` (o `prepararCodigos()` desde el editor), y el reinicio del panel las conserva. Solo cuando a un stand le falta la fila (un stand nuevo, o una fila borrada a mano) se toma el turno una vez, en `asegurarFilasDeCodigos_`, para crear las filas de todos los stands de golpe. Antes cada generación tomaba el turno unos 0,9 s y el sistema aguantaba unas 20 en cola antes de fallar. Si dos personas generan para el mismo stand a la vez, queda el código de la última escritura.
- **Global** (`getScriptLock`): guardar los ajustes de la pantalla de ranking, guardar una pregunta como líder, guardar, importar, desactivar o eliminar desde el panel, reiniciar los datos, `prepararFeria` y las simulaciones. Son pocas y necesitan orden entre ellas.

Un bloqueo espera hasta 20 segundos (`SEGUNDOS_BLOQUEO`); el del reinicio, hasta 30.

Al empezar un quiz, las validaciones (stand, feria abierta, quiz de entrada, código, preguntas suficientes) se hacen antes de tomar el bloqueo de la persona. Dentro se vuelve a comprobar que no exista ya un intento, se reserva la fila y se escribe.

## Registro por lotes

Se registra en `Usuarios` solo el `USUARIO` (quien no está en `Staff`), con la feria abierta, cerrada o en la sala de espera. `ADMIN` y `LIDER` ya están en `Staff` y no se registran ni reciben número. El código está en [registro.gs](../../appscript/registro.gs).

El registro no ocurre al abrir la app sino después, en segundo plano, y no escribe una fila por persona:

1. **La carta.** El navegador llama a `registrarme`. Si la persona todavía no tiene número de orden, se guarda una carta en las propiedades del script: la clave es `reg:` más el correo y el valor lleva el nombre y la hora de ingreso. Dejar la carta no toma ningún bloqueo.
2. **La pasada.** Esa misma ejecución intenta tomar el turno global sin esperar (`tryLock` de 200 ms). Si lo consigue, lee las propiedades del script de una vez, se queda con las cartas que todavía no tienen su número confirmado y les da número (`entregarNumeros_`). Ahí suelta el turno. Después, ya sin turno, escribe sus filas en `Usuarios` en una sola operación y confirma los marcadores (`escribirYConfirmar_`). Si el turno está ocupado, o hubo una pasada hace menos de 5 segundos (`SEGUNDOS_ENTRE_REPARTOS`), termina sin escribir.
3. **El borrado.** Al final se borran las cartas cuya fila quedó escrita y confirmada. Si la escritura en `Usuarios` falla, la pasada no da error: esas personas ya tienen su número, sus cartas quedan en el buzón y la siguiente pasada vuelve a escribir sus filas.
4. **La confirmación.** En cuanto la persona tiene número, `registrarme` lo copia a su índice: desde ahí ya puede empezar quizzes. Devuelve `listo: true` cuando además su fila está en `Usuarios`. Mientras no esté listo, el navegador vuelve a llamar a los 5, 10, 20, 40 y 60 segundos, cada vez con hasta 5 segundos más al azar. Cada llamada puede provocar otra pasada, así que nadie depende de que entre otra persona después.

El número de orden:

- Empieza en 1 y sube de uno en uno, en el orden en que la pasada atiende a cada persona.
- **Quién tiene qué número se anota en las propiedades del script**, con un marcador por correo (`ord:` más el correo) y un contador (`ULTIMO_ORDEN`). Ese marcador es el dato que manda. La columna `orden` de `Usuarios` es su copia a la vista.
- Se entrega con el turno global tomado, así que dos personas nunca reciben el mismo, y no se reutiliza. El turno cubre solo esa entrega, que no toca el Sheet: dura lo que tardan dos operaciones sobre las propiedades y no depende de lo que tarde la hoja.
- Una pasada va en tres pasos: entrega los números en las propiedades (marcador con `?` al final, que significa "fila todavía sin confirmar"), escribe las filas en `Usuarios` y confirma los marcadores. Solo el primero lleva turno. Si la hoja falla en el medio, la persona ya tiene su número y puede jugar; la siguiente pasada vuelve a escribir su fila.
- En `Usuarios`, cada persona va en la fila de su número: la persona 1 en la fila 2, la 2 en la fila 3. Así volver a escribir a alguien cae en el mismo lugar y no lo repite, y dos pasadas pueden escribir a la vez sin turno. Si esa fila tiene a otra persona (alguien insertó filas a mano), no se escribe: la persona conserva su número y su fila queda pendiente hasta ejecutar `prepararFeria`.
- Antes de entregar un número, la pasada comprueba que `Intentos` tenga las filas de ese bloque y, si faltan, la agranda (para esa persona y 100 más). Hasta dónde llega cada hoja se recuerda en una propiedad (`FILAS:` más la hoja y el ID del Sheet).
- La primera vez que se entrega un número se comprueba que `Usuarios` tenga la columna `orden`; si falta, la pasada falla con un mensaje que lo dice y nadie puede empezar un quiz. Si la columna desaparece después, los números se siguen entregando y las filas quedan pendientes, con un aviso en el registro de ejecuciones.
- Si `Usuarios` ya tiene números y el registro no tiene contador (hoja numerada por una versión anterior, o script apuntando a otro Sheet), la pasada se niega y pide ejecutar `prepararFeria`, que rehace los marcadores a partir de la hoja.

Por qué el número no se decide leyendo la hoja: dentro de una misma ejecución, una segunda lectura de `Usuarios` puede no mostrar lo que otra ejecución acaba de escribir. En la prueba de carga del 2026-10-10 (versión `2026-10-10.1`, que deduplicaba releyendo la hoja) eso dejó 72 personas en 133 filas, y 21 inicios de quiz esperaron 20 segundos sin ver su propia fila. Las propiedades del script sí devuelven siempre lo último escrito. Los intentos no tuvieron ese problema: cada persona lee solo su bloque.

Consecuencias:

- Con muchas personas a la vez el turno se usa una vez por pasada, no una vez por persona.
- La fila aparece en `Usuarios` unos segundos después del ingreso. `registrado_en` guarda la hora de la carta, no la de la pasada.
- Para empezar un quiz hace falta el número de orden. Quien pulsa "Empezar" antes de tenerlo pide una pasada urgente (`ordenUrgente_`): no respeta el descanso de 5 segundos y espera el turno un segundo como mucho. Si lo encuentra ocupado no hace fila, porque la pasada que lo tiene probablemente ya lleva su carta: vuelve a mirar su marcador y repite, hasta 20 segundos.
- Quien ya confirmó su registro lo recuerda en su caché propia durante 6 horas y no vuelve a llamar a `registrarme`. Esa marca solo ahorra trabajo: lo que decide si alguien está registrado es su marcador.
- Cambiar a mano la columna `orden` no tiene efecto en la app. Tampoco hay que agregar personas a mano en `Usuarios`: la app no las reconoce y les daría otra fila al entrar.
- El panel admin muestra cuántas personas están en `Usuarios` y cuántas cartas siguen pendientes, y el botón "Registrar ahora" fuerza una pasada (`registrarPendientes`).
- `completarUsuarios`, para ejecutar desde el editor antes de premiar, fuerza una pasada y deja en `Usuarios` una fila por cada persona con número que no la tenga, con su mismo número. No debería encontrar a nadie; sirve si alguien borró una fila de `Usuarios` a mano, o si una escritura falló y la carta ya no está.

Cuándo se reintenta una fila que no se pudo escribir: en la siguiente pasada del registro, la provoque quien la provoque. Eso es el propio navegador de la persona (vuelve a llamar a los 5, 10, 20, 40 y 60 segundos, y otra vez cada vez que abre la app, porque sin fila no queda marcada como confirmada), cualquier otra persona que se registre, o el botón "Registrar ahora". La carta, que lleva su nombre y su hora, no se borra hasta que la fila queda escrita. Probado en local con la escritura de `Usuarios` fallando; en Apps Script real todavía no falló ninguna, así que ese camino no se ha visto allí.

Cómo ve el admin los números, que no están en la hoja sino en las propiedades del script:

- **Panel admin:** personas en `Usuarios` y cartas pendientes. Una fila sin escribir aparece como pendiente.
- **`auditarRegistro`** (editor): compara los números entregados con `Usuarios` y con el buzón, y termina en `REGISTRO: OK`, `OK, con filas pendientes de escribir` o `REVISAR`. Lista, con correos: números entregados a más de una persona, personas con número y sin fila, filas sin número entregado, correos repetidos en la hoja, personas con otro número en la hoja que el entregado y cartas pendientes. No cambia nada.
- **`probarTodo`** incluye un resumen de lo mismo en la línea "Filas propias en Intentos".
- **`reconstruirRegistro`** (editor): si se pierden las propiedades del script, vuelve a crear los marcadores que falten a partir de la columna `orden` de `Usuarios`, sin cambiar el número de nadie. Por eso la columna importa aunque la app no la lea para decidir: es el respaldo. Sin marcadores ni contador, y con números en la hoja, el registro se niega a entregar números nuevos hasta que se ejecute.

Límites: las propiedades del script admiten 9 KB por valor y 500 KB en total. Una carta ocupa alrededor de 100 bytes y se borra al escribirse. Un marcador ocupa unos 45 bytes y no se borra: 800 personas son unos 36 KB y 2.500, unos 112 KB.

Google no documenta si escribir propiedades en paralelo es seguro. La prueba `iniciarPruebaRegistro` lo comprueba en el Apps Script real (ver "Pruebas de carga, simulaciones y auditoría") y hay que ejecutarla antes de usar esto en la feria.

## Índice por persona

Cada persona guarda sus propios intentos en `UserProperties` ([indice.gs](../../appscript/indice.gs)). El mapa, empezar un quiz y enviarlo leen ese índice y no recorren la hoja `Intentos`. La hoja sigue siendo el registro oficial y la fuente del ranking:

- Hay una propiedad por stand (`i:STD-001`), una propiedad `epoca` y una propiedad `orden` con la copia del número de orden de la persona.
- El índice se arma desde las hojas la primera vez: los intentos, buscando solo las filas de esa persona por su correo en `Intentos`; el número de orden, de su marcador en el registro.
- Cada reinicio de datos cambia la época (`ULTIMO_REINICIO`) y obliga a volver a armarlo. `prepararFeria` también abre una época nueva.
- Al crear o corregir un intento se escribe primero el índice y después la hoja. Si la hoja falla, el reintento del celular encuentra el mismo intento, con su fila ya reservada.
- El índice se marca como "ya está en la hoja" (`s = 1`) solo después de que la escritura se confirmó (`SpreadsheetApp.flush` dentro de `registrarResultado_` y de `escribirInicio_`). Si la confirmación falla, el celular recibe el error y el reintento vuelve a escribir.
- Un resultado corregido que todavía no llegó a la hoja queda marcado en el índice y se escribe en la siguiente visita al mapa o en el siguiente reintento del envío.
- Un intento al que se le acabó el tiempo se marca `VENCIDO` solo en el índice. En la hoja queda `EN_CURSO` con su hora de vencimiento ya pasada.
- Si el admin corrige a mano un intento en la hoja, ejecuta `releerIndiceDe(email)` para que el celular lo vuelva a leer.
- Depende de `executeAs: USER_ACCESSING`. Con `USER_DEPLOYING` todas las personas compartirían un solo índice, y la app lo rechaza con el mensaje "La app debe ejecutarse con la cuenta de quien accede."

Forma de cada intento en el índice:

| Clave | Contenido |
|---|---|
| `id` | `intento_id` |
| `e` | `EN_CURSO`, `COMPLETADO` o `VENCIDO` |
| `i`, `v` | Inicio y vencimiento, en milisegundos |
| `q` | Identificadores de las preguntas sorteadas |
| `r`, `a` | Letras elegidas y aciertos, tras corregir |
| `c`, `p`, `t` | Correctas, puntaje y hora de corrección |
| `s` | `1` cuando lo guardado ya está en la hoja |
| `f` | Número de fila del intento en la hoja `Intentos` |
| `k` | Código con el que se abrió el quiz; vacío en el quiz de entrada |

Consecuencia para la operación: borrar filas de `Intentos` a mano no basta para dejar la app como al inicio, porque cada celular seguiría viendo sus quizzes como respondidos. Se usa "Reiniciar datos" del panel.

El almacén de cada persona es de su cuenta y de este proyecto de Apps Script: no vence, otro proyecto no lo ve y ningún participante tiene una pantalla para editarlo. Admite 9 KB por valor y 500 KB en total, por persona; un índice con 20 intentos ocupa unos 5 KB.

## Filas propias

Cada persona tiene en `Intentos` un bloque de 25 filas (`FILAS_POR_PERSONA`, en `datos.gs`) que es solo suyo. Su número de orden dice cuál: la persona 1 tiene las filas 2 a 26, la persona 2 las filas 27 a 51, y así. La primera fila del bloque es `2 + (orden − 1) × 25`. Como nadie más escribe en ese bloque, empezar y enviar un quiz no esperan a nadie.

- **Empezar un quiz** (`iniciarQuiz_`): con el bloqueo de la persona, lee su bloque (`filaLibreDe_`), comprueba que todo lo escrito ahí lleve su correo y elige la primera fila que está vacía en la hoja y que tampoco tiene reservada en su índice. Guarda el intento en el índice con esa fila y después escribe la fila `EN_CURSO` (`escribirInicio_`).
- **Enviar un quiz** (`registrarResultado_`): va directo a la fila guardada, comprueba que tenga su `intento_id` y la completa. Si la fila está vacía porque la de inicio no llegó a escribirse, la escribe completa ahí mismo.
- **Si la fila guardada no tiene su intento**, antes de escribir se busca el intento por su identificador en toda la columna. Así una fila movida a mano se completa donde esté, y un mismo intento no queda en dos filas.
- **Si en el bloque aparece el correo de otra persona**, no se escribe y la persona ve un error. Significa que alguien movió filas a mano o que dos personas tienen el mismo número de orden.
- **De dónde sale el número** (`miOrden_`): del índice de la persona. Si no está ahí, de su marcador en el registro; y si la persona todavía no tiene número, de una pasada urgente. Sin número no se escribe nada en `Intentos`.

El tamaño del bloque es una constante del código y no un parámetro de `Config`: cambiarlo con intentos en la hoja movería a todos de bloque. Con 19 stands, 25 filas dejan lugar para seis más.

Reglas de operación que salen de esto:

- **Nadie ordena ni borra filas en `Intentos` durante la feria**, ni inserta o borra filas en `Usuarios`. Un filtro de vista no afecta.
- **`Intentos` tiene filas vacías** entre el bloque de una persona y el de la siguiente. La app ignora las filas con la columna A vacía. Para contar intentos se usa `filasConDato_`, no la última fila.
- **Nada agrega filas al final de `Intentos`.** Las simulaciones y la prueba de carga también escriben en bloques, y `limpiarSimulacion` y `limpiarPruebaCarga` vacían las filas en su lugar en vez de subir las demás, tanto en `Intentos` como en `Usuarios`, y borran los marcadores de orden de las personas de mentira.

`prepararFeria`, para ejecutar desde el editor antes de abrir la feria y con `Intentos` vacía: deja `Usuarios` con una fila por correo, seguidas y numeradas desde 1; rehace los marcadores de orden y el contador a partir de la hoja; abre una época nueva para que cada celular vuelva a pedir su número, y agranda `Intentos` y `Usuarios` para 2.500 personas (`PERSONAS_PREVISTAS`). Hay que ejecutarla después de las pruebas, que gastan números de orden; al pasar de una versión anterior a esta, y cuando el script pasa a apuntar a otro Sheet. Si `Intentos` tiene filas, no hace nada y lo dice.

## Decisiones tomadas al programar

Estas no estaban definidas en los prototipos:

1. **Nombre del usuario:** `Session` solo entrega el correo. El nombre se busca, en este orden, en la caché propia de la persona, en `Staff`, en el directorio de la organización (servicio avanzado Admin SDK, perfil público del dominio) y, si nada de eso responde, se deduce del correo (`jose.perez2@…` pasa a "Jose Perez"). Se guarda en `Usuarios` al registrar a la persona y se puede corregir a mano ahí: cuando la persona confirma su fila, su caché toma el nombre de la hoja. El ranking siempre usa el de la hoja. La función `probarNombre`, ejecutada desde el editor, muestra si el directorio está disponible. El panel usa la misma cadena (primero lo que ya diga `Staff`) para el nombre del líder que el admin asigna desde el formulario de un stand; esa consulta va antes del turno global para no tenerlo ocupado mientras el directorio responde.
2. **Color e ícono del pabellón:** salen de una paleta de seis (`PALETA` en `comun-script.html`), según la posición del pabellón en el mapa. Un séptimo pabellón repetiría el primer color.
3. **Abreviatura del stand:** se deduce del nombre ("Code Review" pasa a "CR", "Katalyst" a "KATA").
4. **Caracteres del código:** cuatro, solo consonantes y dígitos del 2 al 9, empezando siempre por letra. Además de evitar confusiones al dictarlo, impide que Sheets convierta el código en otra cosa (por ejemplo `TRUE` o `2E45`). Un código nuevo no repite ninguno que esté activo en otro stand.
5. **Quién aparece en el ranking:** solo quienes tienen al menos un quiz completado. Cada persona cuenta un solo intento completado por stand, aunque en la hoja hubiera una fila repetida. El ranking lleva nombre y puntos; el quiz de entrada suma como cualquier otro.
6. **El celular no muestra el puesto:** el mapa y el resultado del quiz muestran puntos. El ranking lo ve quien tenga la vista `RANKING`.
7. **Retomar un quiz:** si alguien cierra la app a mitad del quiz y vuelve dentro de su tiempo, el stand aparece "En curso" y continúa con las mismas preguntas sin pedir el código.
8. **Envío repetido:** si el envío se repite por mala señal, el servidor devuelve el resultado ya guardado en lugar de un error. Al empezar un quiz, al enviarlo y al cargar el mapa, el celular reintenta solo hasta tres veces, con esperas de 1,5, 3 y 6 segundos.
9. **Margen de envío:** se aceptan respuestas hasta 10 segundos después del límite. Se cuenta desde la primera vez que el envío llegó al servidor, para que un reintento no haga vencer un quiz respondido a tiempo.
10. **Identificador del intento:** `INT-` y 12 caracteres al azar. No sale del número de filas, porque dos personas en paralelo recibirían el mismo.
11. **Feria cerrada:** con `feria_abierta = FALSE` nadie puede empezar un quiz. Solo el `USUARIO` tiene número y puede empezar un quiz; `ADMIN` y `LIDER` reciben el rechazo "Tu rol no responde quizzes" antes de cualquier otra comprobación.
12. **Alcance del admin:** el admin ve en la barra todas las vistas que `Permisos` le dé. En `GENERAR_CODIGO` y `PREGUNTAS` alcanza todos los stands del mapa; el quiz de entrada no lleva código y sus preguntas se editan desde el panel.
13. **Respaldos del reinicio:** quedan como hojas ocultas `respaldo_<Hoja>_AAAA-MM-DD_HHMM` en el mismo archivo. No se borran solas.

## Subir cambios con clasp

Hay dos archivos `.clasp.json` que apuntan al mismo proyecto de Apps Script: uno en la raíz, con `rootDir: appscript`, y otro dentro de `appscript/`. Por eso `clasp push` sube la misma carpeta desde cualquiera de los dos lugares:

```bash
clasp push
```

`clasp push` reemplaza todo el proyecto remoto por lo que hay en la carpeta: un archivo creado solo en el editor web se borraría. Requiere haber hecho `clasp login` una vez y tener activada la API de Apps Script en la cuenta. Subir no publica: la URL `/exec` sigue en su versión hasta crear una nueva en Administrar implementaciones; la URL `/dev` sí toma el cambio al instante.

El manifiesto usa `executeAs: USER_ACCESSING` y `access: DOMAIN`. La app corre con la cuenta de cada persona, así que el índice por persona de `UserProperties` funciona. La contrapartida: cada asistente necesita permiso para abrir el Sheet, y por eso puede leer la columna `correcta` de `Preguntas` y editar las hojas. Es un riesgo aceptado; `auditarPuntajes` lo detecta después, pero no lo impide.

## Despliegue manual

1. Crear un proyecto de Apps Script independiente. El script no está ligado al Sheet: lo abre por su ID.
2. Crear en el editor cada archivo de `appscript/` con el mismo nombre, sin la extensión, y pegar su contenido. Los `.gs` son archivos de secuencia de comandos y los `.html` son archivos HTML.
3. En la configuración del proyecto, activar "Mostrar el archivo de manifiesto appsscript.json" y reemplazar su contenido. El manifiesto ya declara los permisos (hojas de cálculo, correo de quien entra, lectura del directorio y disparadores del script) y activa el servicio avanzado Admin SDK API.
4. Poner el ID del Sheet en la constante `ID_DEL_SHEET` de `datos.gs`; es lo que va entre `/d/` y `/edit` en la dirección del archivo. Para apuntar a otro Sheet sin tocar el código (por ejemplo, uno de pruebas), se guarda su ID en la propiedad del script `SPREADSHEET_ID`, que tiene prioridad.
5. Implementar como aplicación web, con "Ejecutar como: usuario que accede a la aplicación" y acceso para la organización.
6. Compartir el Sheet con la organización con permiso de editor. Sin eso, cada persona vería un error de permisos al entrar.
7. Escribir a mano en `Staff` la fila del primer `ADMIN`.
8. Antes de abrir la feria, con `Intentos` vacía, ejecutar `prepararFeria` desde el editor: deja la numeración de `Usuarios` desde 1 y la hoja `Intentos` con filas para 2.500 personas (ver "Filas propias").

La app identifica a cada persona con `Session.getActiveUser().getEmail()`. Si no obtiene un correo, muestra "No pudimos identificar tu cuenta. Entra con tu cuenta de la empresa."

La zona horaria del manifiesto es `America/Lima`. Afecta al nombre de las hojas de respaldo, a cómo se interpreta `fecha_feria` cuando está escrita como texto y a las fechas que muestra el panel admin.

## Diagnóstico

Cuando la app muestra "No pudimos abrir la app":

1. **Leer el recuadro** de esa página: muestra el correo detectado, el nombre, el rol asignado, las vistas de ese rol y cómo está la hoja `Permisos` en el Sheet en ese momento.
2. **Mirar la versión** al pie de esa página. Debe coincidir con `VERSION_DEL_CODIGO` de `main.gs`. Si no aparece o es otra, la URL publicada sigue con código anterior: hay que crear una nueva versión de la implementación.
3. **Ejecutar `probarTodo`** desde el editor y abrir el registro de ejecución. Cada línea empieza con `OK` o `FALLA` y dice qué encontró; por ejemplo, marca `FALLA` en cada stand con menos de 16 preguntas activas. No modifica ninguna hoja. Exige que quien lo ejecuta esté en `Staff` como `ADMIN`: si `Staff` es justamente lo que está mal, falla con "Solo un administrador puede hacer esto." y hay que corregir esa fila a mano primero. Para ver qué lee la app en `Staff` sin ser admin, agrega la propiedad del script `DIAGNOSTICO = 1` (Configuración del proyecto > Propiedades del script), ejecuta `diagnosticarAccesoPrueba` y **borra la propiedad al terminar**: mientras exista, cualquier participante podría ejecutarla.

Mientras se hacen cambios conviene abrir la URL de prueba (Implementar, Probar implementaciones), que termina en `/dev` y siempre usa el último código guardado. La URL `/exec` solo cambia al publicar una nueva versión.

## Pruebas de carga, simulaciones y auditoría

Son funciones para ejecutar a mano desde el editor, todas con `exigirAdmin_`. Usar siempre una copia del Sheet: escriben en las hojas reales.

[appscript/pruebas-carga.gs](../../appscript/pruebas-carga.gs):

- `llenarIntentosDePrueba(cuantas)`: agrega filas de relleno a `Intentos`, 20.000 si no se indica otra cantidad. Se borran con `limpiarSimulacion`. El relleno va debajo de los bloques ya entregados y el contador de orden salta por encima de él, así que el bloque de la siguiente persona empieza después. La prueba de carga midió los mismos tiempos con 20.000 y con 40.000 filas: el tamaño de la hoja no influye.
- `medirLecturas`: cuánto tarda leer cada hoja completa, y cuánto tarda leer solo las columnas que usa el ranking.
- `medirPeticiones`: cuánto tardan el mapa, la reconstrucción del índice y el ranking.
- `iniciarPruebaFilas` y `revisarPruebaFilas`: comprueban que varias ejecuciones simultáneas no pierdan filas al agregarlas al final de una hoja. Lanzan 10 ejecuciones de 20 filas cada una, escritas con el turno global (`agregarFilaConTurno_`). La app ya no agrega intentos así; la prueba queda como referencia de por qué.
- `auditarPuntajes`: antes de premiar, recalcula cada intento completado desde sus respuestas y el banco de `Preguntas`, y lista los que no coinciden o están repetidos por persona y stand.

[appscript/prueba-registro.gs](../../appscript/prueba-registro.gs) valida el registro por lotes y anota qué hizo el cartero en cada intento: si encontró la llave, si estaba ocupada, si estaba en descanso y cuántas cartas se llevó. Usa correos de simulación que empiezan con `prueba-reg-` y borra sus filas al terminar.

- `probarRegistroSolo`: una sola ejecución, tarda segundos. Recorre cinco pasos (pasada con tres cartas, descanso, pasada tras el descanso, carta repetida que no crea fila, buzón vacío) y termina con `RESULTADO: OK` o `FALLA`. No puede mostrar la llave ocupada.
- `iniciarPruebaRegistro` y `revisarPruebaRegistro`: 10 ejecuciones que arrancan a la misma hora, 3 minutos después de iniciar. Cada una deja 30 cartas, intenta repartir tras cada una y luego confirma sus filas hasta tres veces, como el navegador de cada persona. `revisarPruebaRegistro`, unos 6 minutos después de iniciar, da el veredicto: pasa con 300 filas, ninguna repetida, el buzón vacío y ningún error. Muestra además cuántas veces se encontró la llave, cuántas estaba ocupada o en descanso, cuántas pasadas escribieron filas, cuánto duró cada una y la lista de pasadas en orden.
- `limpiarPruebaRegistro`: borra filas, cartas e informes de prueba si algo quedó a medias. Si la prueba falla, `revisarPruebaRegistro` no borra nada, para poder revisarlo.

El detalle carta por carta de cada ejecución queda en su propio registro, en la sección "Ejecuciones" del editor.

[appscript/prueba-feria.gs](../../appscript/prueba-feria.gs) prueba el recorrido completo con varias ejecuciones a la vez. Cada ejecución imita a una persona tras otra, sin descanso: se registra y recibe su número de orden, arma su índice, responde el quiz de entrada y dos stands con código, cada intento en su bloque de filas. Usa las funciones reales en todo lo que las personas comparten (`repartir_`, `ordenUrgente_`, `filaLibreDe_`, `escribirInicio_`, `registrarResultado_`, `filasDeEmail_`, la caché del catálogo, de las preguntas y de los códigos). Lo que es de cada persona (índice, bloqueo y caché propios) se reemplaza por operaciones del mismo costo sobre la cuenta que ejecuta, porque todas las ejecuciones de una cuenta comparten esos tres. Sigue el mismo orden que la app, incluido lo que pasa cuando algo falla: si la fila de inicio no se puede escribir, el quiz sigue con el índice y la fila se escribe completa al enviar; si empezar o enviar fallan, reintenta a los 1,5, 3 y 6 segundos. La primera persona de cada ejecución pulsa "Empezar" sin esperar a su registro, para ejercitar la pasada urgente.

- `iniciarPruebaCarga` (20 ejecuciones), `iniciarPruebaCarga10` e `iniciarPruebaCarga5`: exigen la columna `orden` en `Usuarios` y que el registro tenga su contador (`prepararFeria`), borran los restos de una prueba anterior, releen el catálogo y las preguntas, dejan en la caché un código de prueba por stand, miden a dos personas sin competencia y programan las ejecuciones, que arrancan a la misma hora, 4 minutos después. Si esa medición tiene algún fallo, no programan nada. La carga dura 2 minutos.
- `revisarPruebaCarga`: a partir de la hora que indica el registro. Da el veredicto de datos (`DATOS: OK` o `FALLA`) comparando lo que cada persona dio por hecho con lo que quedó en `Intentos` y `Usuarios`: inicios y envíos confirmados sin su fila, filas con contenido distinto al enviado, `intento_id` repetidos, persona y stand repetidos, números de orden entregados a más de una persona, personas con otro número en `Usuarios` que el entregado, personas repetidas en `Usuarios`, filas fuera del bloque de su dueño y bloques con más de un correo. Muestra además los tiempos de cada operación (p50, p90, p95 y máximo), separando leer el bloque de escribir la fila y los inicios que tuvieron que pedir su número, los inicios y envíos logrados por minuto, cuánto estuvo ocupado el turno global (que ahora solo usa el registro), los errores por mensaje y una línea por cada 10 segundos. No borra nada y se puede ejecutar más de una vez.
- `sumarmeAPruebaCarga`: otro admin agrega sus propias 20 ejecuciones a una prueba ya iniciada, antes de la hora que indica el registro. Es la forma de pasar de 20 ejecuciones a la vez, que es el límite de disparadores de una cuenta. Al terminar, esa cuenta ejecuta `quitarMisDisparadoresDeCarga`.
- `limpiarPruebaCarga`: borra las filas, las cartas, los informes y los códigos de prueba. Los correos empiezan con `carga-` y usan el dominio de la simulación.

Límites de esta prueba: no abre la página (`doGet`), no pasa por la pantalla de permisos de Google y no reproduce cientos de cuentas distintas a la vez. Cada corrida de 20 ejecuciones gasta cerca de 70 de los 360 minutos diarios de disparadores de una cuenta de Workspace. Cada persona de mentira gasta un número de orden: después de las pruebas, `limpiarPruebaCarga` y `prepararFeria` dejan la numeración otra vez desde 1.

Mediciones del 2026-10-10 con el diseño anterior, en el que cada inicio de quiz agregaba su fila al final de `Intentos` con el turno global. Sirven para comparar:

| Ejecuciones a la vez | 5 | 10 | 5 | 20 |
|---|---|---|---|---|
| Filas en `Intentos` | 20.058 | 20.058 | 40.058 | 40.058 |
| Datos | OK | OK | OK | OK |
| Inicios logrados por minuto | 39 | 52 | 35 | 51 |
| Turno global ocupado | 66 % | 96 % | 60 % | 93 % |
| Iniciar un quiz: p50 / p95 | 1,8 / 4,5 s | 4,1 / 9,4 s | 2,0 / 5,0 s | 9,2 / 17,9 s |
| Inicios que agotaron los 20 s del turno | 0 | 0 | 0 | 19 de 123 |
| Enviar un quiz: p50 / p95 | 2,4 / 3,5 s | 2,5 / 5,6 s | 2,2 / 5,0 s | 2,9 / 11,7 s |

Primera medición con filas propias, el mismo día (versión `2026-10-10.1`, 20 ejecuciones a la vez, `Intentos` casi vacía):

| | Diseño anterior, 20 a la vez | Filas propias, 20 a la vez |
|---|---|---|
| Datos de `Intentos` | OK | OK: 196 quizzes, cada uno en el bloque de su dueño |
| Inicios logrados por minuto | 51 | 94 en promedio; entre 120 y 156 en el último minuto |
| Iniciar un quiz ya con número: p50 / p95 | 9,2 / 17,9 s | 2,0 / 4,9 s |
| Enviar un quiz: p50 / p95 | 2,9 / 11,7 s | 1,9 / 4,1 s |
| Esperas agotadas por el turno al iniciar o enviar | 19 y 2 | 0 y 0 |
| Registro en `Usuarios` | OK | FALLA: 72 personas en 133 filas, y 21 inicios sin número tras 20 s |

La falla del registro la corrigió la versión `2026-10-10.2` (ver "Registro por lotes"). Medida ese mismo día con 10 ejecuciones a la vez: datos OK, 56 personas en 56 filas de `Usuarios`, 154 quizzes en su bloque.

| | Diseño anterior, 10 a la vez | Filas propias `.2`, 10 a la vez |
|---|---|---|
| Inicios logrados por minuto | 52 | 73 |
| Iniciar un quiz ya con número: p50 / p95 | 4,1 / 9,4 s | 1,8 / 6,6 s |
| Iniciar pidiendo el número en ese momento: p50 / p95 | no existía | 3,9 / 10,5 s |
| Enviar un quiz: p50 / p95 | 2,5 / 5,6 s | 1,7 / 4,4 s |
| Inicios fallidos | 0 | 1 de 149, recuperado en el reintento |

Ese inicio fallido esperó su número más de 20 segundos, porque la pasada que tenía el turno estaba escribiendo en `Usuarios` y la hoja tardó 12 segundos en responder. En todas las corridas aparece alguna operación suelta que tarda entre 11 y 14 segundos; es de la plataforma. La versión `2026-10-10.3` sacó la escritura de `Usuarios` del turno, para que esas demoras no frenen la entrega de números.

Medición final del día, versión `2026-10-10.4`, 20 ejecuciones a la vez: datos OK, 313 quizzes en su bloque, 111 personas en 111 filas de `Usuarios`, ningún error y ningún inicio ni envío fallido.

| | Diseño anterior, 20 a la vez | Filas propias `.4`, 20 a la vez |
|---|---|---|
| Inicios logrados por minuto | 51 | 154 |
| Iniciar un quiz: p50 / p95 / máximo | 9,2 / 17,9 / 23,0 s | 2,4 / 5,7 / 9,0 s |
| Iniciar pidiendo el número en ese momento: p50 / p95 | no existía | 4,4 / 7,9 s |
| Enviar un quiz: p50 / p95 / máximo | 2,9 / 11,7 / 26,0 s | 2,1 / 4,6 / 11,1 s |
| Inicios y envíos que agotaron una espera | 21 | 0 |
| Turno global ocupado | 93 % | 11 % |
| Pasada del registro, con el turno: p50 / máximo | sin dato | 0,3 / 0,7 s |

Los 154 inicios por minuto no son un techo del sistema: es lo que producen 20 ejecuciones con sus pausas. Lo que sí crece con la carga es lo que tarda cada llamada a Sheets: leer el bloque de una persona tardó 0,3 s sin competencia, 0,6 s con 10 ejecuciones a la vez y 0,85 s con 20. Por encima de 20 operaciones simultáneas no hay medición.

Una diferencia entre la prueba y la app que conviene tener presente: cada ejecución de la prueba dura minutos y lee las hojas muchas veces, y dentro de una misma ejecución una segunda lectura puede no mostrar lo que otra ejecución escribió entretanto. Una petición real dura uno o dos segundos y lee cada cosa una vez. La revisión final se hace desde una ejecución nueva (`revisarPruebaCarga`).

[appscript/simulacion.gs](../../appscript/simulacion.gs): `iniciarSimulacion` crea 200 personas con correos `@simulacion.ejemplo` que responden quizzes durante 30 minutos, con un disparador por minuto. Cada una se registra con su número de orden y escribe en su bloque. `detenerSimulacion` la para y `limpiarSimulacion` borra todo lo simulado de `Usuarios`, `Intentos` y `Codigos`; en `Intentos` vacía las filas en su lugar, sin mover las demás.

[appscript/simulacion-puntajes.gs](../../appscript/simulacion-puntajes.gs): `iniciarPuntajes` escribe intentos ya completados de 50 personas simuladas durante 5 minutos, para ver moverse el ranking. Registra a esas personas en `Usuarios` si no están. `detenerPuntajes` la para; lo escrito también se borra con `limpiarSimulacion`.

Las simulaciones escriben desde una sola ejecución, así que no prueban concurrencia. Para eso está `prueba-feria.gs`.

## Simulador local

[simulador/servidor.js](../../simulador/servidor.js) ejecuta los `.gs` reales con hojas en memoria, para probar sin desplegar:

```bash
node simulador/servidor.js
```

Abre `http://localhost:8123`. Los datos se pierden al detener el servidor.

Para entrar con otro rol se agrega `?como=` con una de las cuentas de ejemplo:

| Cuenta | Qué es |
|---|---|
| `ana.torres@demo.com` | Usuario. Es la cuenta por defecto; cualquier correo que no esté en `Staff` también lo es |
| `lider.apx@demo.com` | Líder de un stand |
| `lider.backend@demo.com` | Líder de un pabellón completo |
| `validador@demo.com` | Validador: solo lectura de Mapa, Quiz y Preguntas |
| `admin@demo.com` | Admin |
| `sin.vistas@demo.com` | Rol sin filas en `Permisos`, para ver la página de error |

Variables de entorno:

| Variable | Efecto |
|---|---|
| `PORT` | Puerto del servidor. Por defecto 8123 |
| `ESPERA=1` | Enciende la sala de espera, con la fecha a tres días |
| `ESPERA=0` | Enciende la sala de espera con la fecha ya cumplida, para ver "Llegó el día" |
| `DESORDEN=1` | Carga los datos como escritos a mano: pestañas, encabezados, roles e identificadores con otras mayúsculas y espacios |

`.claude/launch.json` trae tres configuraciones listas: `simulador` (8123), `simulador-espera` (8130) y `simulador-espera-cumplida` (8131).

`GET /hoja?nombre=Intentos` muestra el contenido de una hoja. `POST /hoja?nombre=Staff` con una fila en JSON la agrega, como si se escribiera a mano en el Sheet.

En los datos de ejemplo ningún rol tiene la vista `PREGUNTAS`. Para probarla hay que agregar esa fila a `Permisos`, desde el panel admin o con `POST /hoja`.

El simulador no reproduce los límites de Apps Script (tiempo de ejecución, ejecuciones simultáneas) ni la conversión automática de valores que hace Sheets. Los bloqueos no hacen nada, porque todo corre en un solo proceso: en el registro por lotes el turno siempre está libre, y lo único que retrasa una pasada es el descanso de 5 segundos. Tampoco tiene directorio de la organización ni disparadores: los nombres salen de `Staff` o del correo, y las simulaciones y la prueba de filas no se pueden ejecutar. Esa parte solo se comprueba en el despliegue real.
