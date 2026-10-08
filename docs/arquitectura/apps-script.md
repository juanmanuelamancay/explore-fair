# Arquitectura del proyecto Apps Script

Última actualización: 2026-10-05

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
| `RANKING` | `ranking` | `obtenerRanking` |
| `GENERAR_CODIGO` | `generar-codigo` | `obtenerCodigos`, `generarCodigo` |
| `PANEL_ADMIN` | `panel-admin` | `obtenerPanel`, `obtenerAdminCatalogo`, `guardarAdminRegistro`, `importarPreguntasAdmin`, `borrarAdminRegistro`, `eliminarAdminPabellon`, `actualizarCatalogo`, `reiniciarDatos` |
| `ESPERA` (no va en `Permisos`) | `espera` | `obtenerEspera` |

La vista `BOARD` todavía no está programada. Puede estar en `Permisos` sin causar error: la app ignora las vistas que no conoce.

Archivos compartidos:

| Archivo | Contenido |
|---|---|
| `appsscript.json` | Manifiesto: zona horaria y configuración de la web app |
| `main.gs` | `doGet`, que arma la página, y la tabla que relaciona cada vista con su prefijo |
| `datos.gs` | Lectura y escritura de hojas, caché y catálogo |
| `sesion.gs` | Quién llama, qué rol tiene, qué vistas puede abrir y registro en `Usuarios` |
| `datos-test.gs` | Diagnóstico: `probarTodo` se ejecuta desde el editor y registra si el Sheet, las hojas, el catálogo, las preguntas y la sesión están bien |
| `index.html` | Página única: incluye los archivos de las vistas permitidas |
| `comun-style.html` | Colores, tipografía y componentes compartidos |
| `comun-script.html` | Navegación entre vistas, llamadas al servidor, iconos y utilidades |

## Cómo se arma la página

1. `doGet` identifica a la persona por su cuenta de Google y busca su rol en `Staff`. Quien no está ahí es `USUARIO`.
2. Lee en `Permisos` las vistas de ese rol y arma `index.html` incluyendo solo los archivos de esas vistas. Un usuario nunca recibe el HTML ni el código del panel admin.
3. En el navegador, cada `<vista>-script.html` se registra con `App.registrar(nombre, { alMostrar, alOcultar })`.
4. `App.iniciar()` construye la barra inferior con las vistas disponibles y abre la primera. Cambiar de vista no recarga la página.

El orden de la barra inferior es Mapa, Código, Panel, Ranking. `QUIZ` no aparece en la barra: se abre desde el mapa.

## Reglas del servidor

- **Permisos en cada función:** toda función pública empieza con `exigirVista_('<VISTA>')`. Ocultar una vista en el navegador no es seguridad.
- **Funciones privadas:** las que terminan en `_` no se pueden llamar desde el navegador.
- **La respuesta correcta no sale del servidor:** `iniciarQuiz` devuelve solo enunciado y opciones; `enviarQuiz` corrige contra el banco.
- **Fallas esperadas como dato:** un código inválido o un stand ya respondido devuelven `{ ok: false, motivo, mensaje }`. Las excepciones quedan para permisos y errores reales.
- **Tiempo del servidor:** las horas viajan en milisegundos junto con `ahora`, y el navegador calcula su reloj a partir de esa diferencia. La hora del celular no cuenta.
- **Columnas por nombre:** las hojas se leen y escriben según el encabezado, no según la posición de la columna.
- **Sin distinguir mayúsculas:** nada de lo que se escribe a mano en el Sheet se compara tal cual. Nombres de pestaña, encabezados y claves de `Config` se comparan en minúsculas y sin tildes (`normal_`); los identificadores como `STD-001`, en mayúsculas (`id_`); roles, vistas, estados, códigos y la letra correcta, en mayúsculas; los correos, en minúsculas. También se ignoran los espacios al inicio y al final. `admin`, `Admin` y `ADMIN` valen lo mismo.

## Caché

El botón de actualizar de cada vista vuelve a pedir los datos al servidor, pero no borra la caché. La caché es una sola para todos: si cada usuario la borrara al actualizar, cada petición volvería a leer las hojas completas y la app se pondría lenta justo cuando más gente la usa. Los datos propios de cada persona (su puntaje, sus intentos, los códigos activos) no pasan por la caché, así que siempre llegan al día. Solo el admin puede descartarla, con "Actualizar ahora" en el panel.

| Qué | Duración | Se invalida cuando |
|---|---|---|
| Catálogo (pabellones, stands, staff, permisos, config) | `segundos_cache_catalogo` (60 por defecto) | El admin pulsa "Actualizar ahora", se ejecuta `limpiarCache` o hay un reinicio |
| Preguntas de cada stand | `segundos_cache_catalogo` | Igual; además se relee sola si a un stand le faltan preguntas |
| Ranking | `segundos_refresco_board` | Alguien completa un quiz o hay un reinicio |
| Usuario ya registrado | 6 horas | Hay un reinicio |

Un cambio hecho a mano en `Pabellones`, `Stands`, `Preguntas`, `Staff`, `Permisos` o `Config` tarda hasta un minuto en verse en la app. Para verlo al instante, el admin pulsa "Actualizar ahora" en el panel (o se ejecuta `limpiarCache` desde el editor). Nada de esto está fijo en el código: lo que muestra la app, como la cantidad de preguntas de un stand, sale siempre de las hojas.

La excepción es lo que decide qué ve cada persona: cada vez que alguien abre la app, la recarga o pulsa actualizar, se comparan `Staff`, `Permisos` y `Config` del Sheet con lo guardado y, si cambiaron, se descarta la caché. Así, a quien se acaba de nombrar líder le basta con recargar, y encender o apagar la sala de espera se nota de inmediato. Quien ya tenía la app abierta y pierde una vista es llevado solo a la que le corresponde en cuanto el servidor le rechaza un pedido. La página de error también lee siempre el Sheet actual, no la copia guardada.

## Bloqueos

Se usa `LockService` solo donde dos personas podrían pisarse:

- Registrar un usuario nuevo.
- Crear un intento (se vuelve a comprobar el duplicado dentro del bloqueo).
- Guardar las respuestas de un quiz.
- Generar un código.
- Reiniciar los datos.

Las validaciones lentas, como comprobar el código, se hacen antes de tomar el bloqueo.

## Decisiones tomadas al programar

Estas no estaban definidas en los prototipos:

1. **Nombre del usuario:** `Session` solo entrega el correo. El nombre se busca, en este orden, en `Staff`, en el directorio de la organización (servicio avanzado Admin SDK, perfil público del dominio) y, si nada de eso responde, se deduce del correo (`jose.perez@…` pasa a "Jose Perez"). Se guarda en `Usuarios` al registrar a la persona y se puede corregir a mano ahí. La función `probarNombre`, ejecutada desde el editor, muestra si el directorio está disponible. No sirve crear un archivo en Drive y leer su dueño: como la app corre con la cuenta de quien la desplegó, el dueño sería siempre esa persona.
2. **Color e ícono del pabellón:** salen de una paleta de seis, según la posición del pabellón en el mapa. Con el catálogo actual coinciden con el prototipo. Un séptimo pabellón repetiría el primer color.
3. **Abreviatura del stand:** se deduce del nombre ("Code Review" pasa a "CR", "Katalyst" a "KATA").
4. **Caracteres del código:** solo consonantes y dígitos del 2 al 9, empezando siempre por letra. Además de evitar confusiones al dictarlo, impide que Sheets convierta el código en otra cosa (por ejemplo `TRUE` o `2E45`).
5. **Quién aparece en el ranking:** solo quienes tienen al menos un quiz completado. Un usuario sin puntaje ve "–" en su puesto.
6. **Stands contados en el ranking:** el quiz de entrada suma puntos pero no cuenta como stand.
7. **Retomar un quiz:** si alguien cierra la app a mitad del quiz y vuelve dentro de su tiempo, el stand aparece "En curso" y continúa con las mismas preguntas sin pedir el código.
8. **Envío repetido:** si el envío se repite por mala señal, el servidor devuelve el resultado ya guardado en lugar de un error.
9. **Margen de envío:** se aceptan respuestas hasta 10 segundos después del límite.
10. **Feria cerrada:** con `feria_abierta = FALSE` nadie puede empezar un quiz, salvo el `ADMIN`, para poder probar.
11. **Admin con todas sus vistas:** el admin ve en la barra Mapa, Código, Panel y Ranking, y puede generar códigos de cualquier stand.
12. **Respaldos del reinicio:** quedan como hojas ocultas `respaldo_<Hoja>_AAAA-MM-DD_HHMM` en el mismo archivo. No se borran solas.

## Subir cambios con clasp

`appscript/.clasp.json` apunta al proyecto de Apps Script. Para subir la carpeta completa:

```bash
cd appscript
clasp push
```

`clasp push` reemplaza todo el proyecto remoto por lo que hay en la carpeta: un archivo creado solo en el editor web se borraría. Requiere haber hecho `clasp login` una vez y tener activada la API de Apps Script en la cuenta. Subir no publica: la URL `/exec` sigue en su versión hasta crear una nueva en Administrar implementaciones; la URL `/dev` sí toma el cambio al instante.

El manifiesto tiene hoy `executeAs: USER_ACCESSING` y `access: ANYONE`, que es como quedó desplegado para pruebas desde una cuenta personal. Para la feria, en una cuenta de Workspace, debe volver a `USER_DEPLOYING` y `DOMAIN` (ver más abajo).

## Despliegue manual

1. Abrir el Sheet de la feria y entrar a Extensiones, Apps Script. Así el script queda ligado al archivo.
2. Crear en el editor cada archivo de `appscript/` con el mismo nombre, sin la extensión, y pegar su contenido. Los `.gs` son archivos de secuencia de comandos y los `.html` son archivos HTML.
3. En la configuración del proyecto, activar "Mostrar el archivo de manifiesto appsscript.json" y reemplazar su contenido. El manifiesto ya declara los permisos (hojas de cálculo, correo de quien entra y lectura del directorio) y activa el servicio avanzado Admin SDK API.
4. Implementar como aplicación web, con "Ejecutar como: yo" y acceso para la organización.
5. Escribir a mano en `Staff` la fila del primer `ADMIN`.

La app identifica a cada persona con `Session.getActiveUser().getEmail()`. Eso solo funciona si quien despliega y quienes entran pertenecen al mismo dominio de Google Workspace. Desplegada desde una cuenta personal de Gmail, la app no puede saber quién entra y muestra un error.

El script es independiente del Sheet, así que lo abre por su ID. El ID está en la constante `ID_DEL_SHEET` de `datos.gs`; es lo que va entre `/d/` y `/edit` en la dirección del archivo. Para apuntar a otro Sheet sin tocar el código (por ejemplo, uno de pruebas), se guarda su ID en la propiedad del script `SPREADSHEET_ID`, que tiene prioridad. La cuenta que despliega debe tener permiso de edición sobre ese Sheet.

La zona horaria del manifiesto es `America/Lima`; solo afecta al nombre de las hojas de respaldo.

## Diagnóstico

Cuando la app muestra "No pudimos abrir la app":

1. **Mirar la versión** al pie de esa página. Debe coincidir con `VERSION_DEL_CODIGO` de `main.gs`. Si no aparece o es otra, la URL publicada sigue con código anterior: hay que crear una nueva versión de la implementación.
2. **Ejecutar `probarTodo`** desde el editor y abrir el registro de ejecución. Cada línea empieza con `OK` o `FALLA` y dice qué encontró. No modifica ninguna hoja.

Mientras se hacen cambios conviene abrir la URL de prueba (Implementar, Probar implementaciones), que termina en `/dev` y siempre usa el último código guardado. La URL `/exec` solo cambia al publicar una nueva versión.

## Simulador local

[simulador/servidor.js](../../simulador/servidor.js) ejecuta los `.gs` reales con hojas en memoria, para probar sin desplegar:

```bash
node simulador/servidor.js
```

Abre `http://localhost:8123`. Para entrar con otro rol se agrega `?como=` con una de las cuentas de ejemplo: `ana.torres@demo.com` (usuario), `lider.apx@demo.com` (líder de un stand), `lider.backend@demo.com` (líder de pabellón) o `admin@demo.com`. `/hoja?nombre=Intentos` muestra el contenido de una hoja.

El simulador no reproduce los límites de Apps Script (tiempo de ejecución, ejecuciones simultáneas) ni la conversión automática de valores que hace Sheets. Esa parte solo se comprueba en el despliegue real.
