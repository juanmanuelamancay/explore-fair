# Plan: quiz por pabellón, líder de pabellón y expositor

Estado: **implementado en el código local** (versión `2026-10-13.1`), probado en el simulador y **sin desplegar** (sin `clasp push`). Fecha del plan: 2026-10-12. Feria: 2026-10-22.

Pasos del sheet que faltan por hacer a mano: ver "Edición de los Sheets" al final.

## Qué cambia

| Antes | Ahora |
|---|---|
| Un quiz por stand: banco de 16, se responden 4 | Un quiz por **pabellón**: cada stand aporta 2 preguntas de su banco de 12. Pabellón de 4 stands = 8 preguntas |
| Un código por stand | Un código por **pabellón** |
| Un intento por persona y stand | Un intento por persona y **pabellón** |
| Rol `LIDER` genera códigos y edita preguntas de su stand | `LIDER` = líder de pabellón: solo genera el código del pabellón. `EXPOSITOR`: solo edita las preguntas de su stand (máximo 12) |
| Un rol por persona en `Staff` | Varios roles en la celda `rol`, por ejemplo `LIDER\|EXPOSITOR` |

Lo que **no** exige código (lo gestiona el admin desde el panel y la `Config`):

- Puntaje: cada pregunta ya tiene `puntos`; `puntos_por_defecto` está en `Config`. Un pabellón con más stands vale más y es decisión del admin.
- Tiempo: `minutos_para_responder` ya está en `Config`.
- Que cada stand tenga sus 12 preguntas: lo asegura el admin antes de abrir. El servidor conserva un rechazo claro ("el stand X tiene n de 12") por si algo falla, pero no hay lógica de espera ni vista de avance para el líder.

## Varias filas por correo (implementado 2026-10-13)

Se resolvió con **varias filas activas en `Staff` para el mismo correo** (una por función: LIDER, EXPOSITOR, PONENTE), no con varios roles en una celda. `sesion_()` une las vistas de todas sus filas y `sesion.staffFilas` suma los alcances en `unidadesParaCodigo_` y `bancosParaPreguntas_`. `ADMIN` y `VALIDADOR` van solos: si su primera fila es una de ellas, las demás se ignoran, y el panel rechaza mezclarlas. Un correo no puede repetir rol (un líder en dos pabellones no cabe). Prueba: `simulador/pruebas/doble-rol.js`. El texto de abajo es el diseño anterior, con varios roles en una celda, que ya no se usa.

## Varios roles en una celda: descartado

Decisión del 2026-10-12: el líder de pabellón y los expositores son **personas distintas**. Un correo, una fila, un rol. Todo lo de esta sección queda **fuera del camino crítico**; se deja escrito por si alguien llega a necesitar dos funciones.

### Diseño (si se retoma)

Dónde se usa hoy el rol (`sesion.rol` es un texto único):

| Uso | Efecto del cambio |
|---|---|
| `sesion_()` ([sesion.gs:19](../appscript/sesion.gs)) filtra `Permisos` por un rol | Debe unir las vistas de todos los roles de la persona |
| `rol === 'ADMIN'`, `'VALIDADOR'`, `'USUARIO'` (quiz, mapa, panel, registro, preguntas) | Siguen valiendo si `ADMIN` y `VALIDADOR` van **solos** (regla de abajo) |
| Etiqueta de cabecera y comparación de acceso en [comun-script.html](../appscript/comun-script.html) | La etiqueta muestra los roles unidos; `obtenerAcceso` ya compara el texto |
| Panel admin: validaciones de `Staff` ([panel-admin.gs:292-310, 333, 381-392](../appscript/panel-admin.gs)) | Hay que validar cada rol de la celda |
| `datos-test.gs`, `main.gs` (diagnóstico) | Solo muestran el rol; basta que acepten la lista |

**Formato de la celda.** Se aceptan `|`, `,`, `;`, `/`, `+` y `-` como separador, con o sin espacios, en cualquier orden y en mayúsculas o minúsculas. Ningún rol lleva esos caracteres. Se guarda y se muestra con `|`.

**Reglas:**

1. `ADMIN` y `VALIDADOR` van solos. Mezclarlos rompería la regla del validador (solo lectura) y la del admin (todo).
2. Solo se combinan `LIDER` y `EXPOSITOR`.
3. Cada rol de la celda debe tener al menos un permiso activo en `Permisos`.
4. Las vistas de la persona son la unión de las de sus roles.
5. El alcance sale del rol, no de la vista. `GENERAR_CODIGO` mira solo `pabellon_id` y exige `LIDER`. `PREGUNTAS` mira solo `stand_id` y exige `EXPOSITOR`. Si `Permisos` le diera `PREGUNTAS` a un `LIDER` sin `EXPOSITOR`, su alcance sería vacío.

**Límite de una fila.** Una fila de `Staff` tiene un solo `pabellon_id` y un solo `stand_id`. `LIDER|EXPOSITOR` funciona cuando la persona lidera un pabellón y es expositora de **un stand de ese mismo pabellón**. El panel rechaza que el `stand_id` no pertenezca al `pabellon_id`.

Líder de un pabellón y expositor en otro no cabe en una fila. Se resolvería permitiendo varias filas por correo (`sesion_` pasaría de `find` a `filter`). Es más trabajo y no lo recomiendo salvo que el caso exista de verdad.

## Cambios en las tablas

| Hoja | Cambio |
|---|---|
| `Staff` | `rol` admite lista (`LIDER\|EXPOSITOR`). `LIDER`: `pabellon_id` obligatorio. `EXPOSITOR`: `pabellon_id` y `stand_id` obligatorios, con el stand dentro del pabellón. `stand_id` se ignora para `LIDER` |
| `Permisos` | `LIDER` → `GENERAR_CODIGO`. `EXPOSITOR` → `PREGUNTAS`. Se desactiva `LIDER` → `PREGUNTAS`. `VALIDADOR` y `ADMIN` igual |
| `Codigos` | Columna `stand_id` pasa a `pabellon_id`. Una fila por pabellón con código |
| `Intentos` | Un intento por persona y pabellón. `pabellon_id` es la clave. `stand_id` queda vacío. `preguntas_json` lleva IDs de varios stands. Reinicio de datos obligatorio |
| `Pabellones` | Columnas nuevas (ver decisiones pendientes): `requiere_codigo` y `preguntas_por_stand` |
| `Stands` | `requiere_codigo` y `num_preguntas` dejan de usarse (se pueden dejar en la hoja sin efecto) |
| `Preguntas` | Sin cambio de estructura. El banco de cada stand baja de 16 a 12 |
| `Config` | Claves nuevas: `preguntas_por_stand` (2) y `preguntas_banco_stand` (12), para no dejarlas fijas en el código |
| `Usuarios` | Sin cambio |

## Filas reservadas por persona en `Intentos`

El bloque de cada persona (`2 + (orden − 1) × FILAS_POR_PERSONA`) y el `orden` del registro por lotes no dependen de stands ni de pabellones: la fórmula, `filaLibreDe_` y `registro.gs` no cambian.

- La clave del índice por persona pasa de `i:STD-xxx` a `i:PAB-xxx`, y `reconstruirIndice_` lee `pabellon_id` de la fila en lugar de `stand_id`.
- Un intento por persona y pabellón sale de esa clave: `iniciarQuiz` ya busca el intento existente antes de crear otro.
- `FILAS_POR_PERSONA` (hoy 25, pensado para un intento por stand) baja a **10** (confirmado: la feria tiene 6 pabellones; el peor caso son 7 intentos con la entrada aparte, y quedan 3 filas de margen). Con 2.500 personas, `Intentos` pasa de unas 65.000 filas a unas 26.000.
- Cambiar ese valor exige `Intentos` vacía (`prepararFeria`); el reinicio ya es obligatorio por este plan.
- Si una persona agota el bloque no puede abrir más quizzes, así que el valor no debe quedarse corto.
- En la fase 4 se revisan `auditarPuntajes` y los contadores de filas de `registro.gs` y `datos-test.gs` por si leen `stand_id`.

## Charlas previas al evento (versión 2, 2026-10-12)

Antes de la feria hay **5 charlas o talleres** a lo largo de una semana. Quienes asisten ya ingresan, completan un quiz y suman puntos al mismo ranking; después van al evento y siguen sumando. Las charlas no cruzan con el evento.

**Decisión de diseño:** vista y catálogo nuevos; `Intentos`, `Usuarios`, `Preguntas` y `Codigos` compartidos.

- `Charlas` (hoja nueva): `charla_id` (`CHA-001`), `titulo`, `ponente`, `inicio`, `fin`, `descripcion`, `preguntas_banco` (15), `preguntas_quiz` (5), `orden`, `activo`.
- Vista `CHARLAS`: ruta de la semana con estados próxima, abierta, completada y perdida. La apertura sigue la fecha de `inicio`; `fin` es informativo. El admin alterna `USUARIO` entre `CHARLAS` (semana de charlas) y `MAPA`+`QUIZ` (evento) con `Permisos`; `espera_activa` debe estar en FALSE esa semana.
- Rol `PONENTE` con columna `charla_id` en `Staff`: genera el código de su charla al terminar el Meet y edita su banco de 15 desde la app; el admin también puede cargarlo con JSON, como en los stands. El código dura `minutos_vigencia_codigo` (5): quien no lo ingresa en ese plazo no responde después.
- **`unidad_id`** reemplaza a `stand_id`/`pabellon_id` como clave en `Intentos` y `Codigos`. Vale `PAB-xxx` o `CHA-xxx`. La clave del índice por persona es `i:<unidad_id>`. El motor del quiz es genérico: una unidad tiene una lista de bancos y cuántas preguntas sortear de cada uno (pabellón: 2 por stand; charla: 5 de 15).
- `Preguntas` sigue igual: para una charla, `stand_id` lleva el id de la charla.
- Sin quiz de entrada para las charlas.
- **Filas:** máximo por persona = entrada 1 + pabellones 6 + charlas 5 = **12**. `FILAS_POR_PERSONA` pasa a **16** (propuesta). `Intentos` para 2.500 personas: unas 40.000 filas.
- **Congelar datos:** apenas entre la primera persona a una charla, `prepararFeria` ya no se puede usar sin perder esos puntos. Antes de la primera charla deben quedar fijos `unidad_id`, `FILAS_POR_PERSONA` y el motor genérico. Lo específico de pabellones (`EXPOSITOR`, panel, mapa) no toca `Intentos` ni `Usuarios` y puede ir después.
- **Pruebas de carga:** las simulaciones escriben usuarios falsos; con datos reales se corren en una **copia del Sheet** (`SPREADSHEET_ID` del script).

Orden propuesto: 1) copia del Sheet de pruebas; 2) `unidad_id`, motor genérico y `FILAS_POR_PERSONA`, probado y congelado; 3) `Charlas`, `PONENTE`, vista `CHARLAS` y panel; 4) parte de pabellones, sin reinicio.

Confirmado: las fechas y horas de cada charla, los puntos de cada pregunta y la duración del código se guardan en las tablas (`Charlas`, `Preguntas`, `Config`); el código no conoce ninguna fecha. Pendiente solo como dato de planificación: cuándo cae la primera charla, para ordenar el trabajo.

### Versión 1 (reemplazada)

Planteaba cada charla como un pabellón de un solo stand.

- **Modelo (v1):** cada charla es un pabellón de un solo stand, como el quiz de entrada: banco de 12, `preguntas_por_stand`, código generado por quien la dicta (`LIDER` de ese pabellón).
- **Filas:** máximo por persona = entrada 1 + pabellones 6 + charlas 5 = **12**. Con 10 filas no alcanza: `FILAS_POR_PERSONA` pasa a **16** (propuesta, sin confirmar). `Intentos` para 2.500 personas: unas 40.000 filas.
- **Disponibilidad por pabellón:** `feria_abierta` y `espera_activa` son globales y con la sala de espera activa el usuario no puede abrir quizzes. Hace falta una columna en `Pabellones` (propuesta: `abierto`, controlada por el admin) para tener charlas abiertas y pabellones cerrados al mismo tiempo.
- **Congelar datos:** una vez que empiece la primera charla no se puede reiniciar (`prepararFeria` exige `Intentos` vacía y renumera a todos). El cambio de modelo y las pruebas de carga deben estar terminados **antes de la primera charla**, y después el código no puede cambiar la forma de `Intentos` ni del índice.

Pendiente de confirmar: fecha de la primera charla, si las charlas exigen el quiz de entrada, preguntas y puntos por charla, y si el mapa las muestra aparte.

## Calendario (fechas confirmadas 2026-10-12)

Charlas: lunes 19 a miércoles 21. Feria: jueves 22.

| Cuándo | Qué |
|---|---|
| Lun 12 – mar 13 | Pasos 1 y 2: `unidad_id`, motor genérico, `FILAS_POR_PERSONA = 16`, probado en local |
| Mié 14 | Pruebas en la copia del Sheet (proyecto de Apps Script de pruebas) |
| Jue 15 – vie 16 | Paso 3: `Charlas`, `PONENTE`, vista `CHARLAS`, pestaña del panel |
| Vie 16 | Paso 4: `EXPOSITOR`, código y mapa por pabellón, panel; desplegado apagado con `Permisos` |
| Sáb 17 | Pruebas de carga finales en la copia; cargar `Staff`, `Charlas`, preguntas y `Permisos` |
| Sáb 17 – dom 18 | Último `prepararFeria` en el Sheet real |
| Lun 19 – mié 21 | Charlas; sin cambios de código |
| Mié 21, noche | El admin pasa `USUARIO` de `CHARLAS` a `MAPA`+`QUIZ` con `Permisos` |

Plan B: el paso 4 puede desplegarse el martes 20 por la noche, porque no toca `Intentos` ni `Usuarios`.

Antes del reinicio: comprobar cuántas filas tiene `Usuarios` (la sala de espera ya registra gente), revisar `timeZone` en `appsscript.json`, y tener cargadas las preguntas (5 charlas × 15; pabellones × stands × 12).

## Fases

Cada fase se prueba antes de pasar a la siguiente. La app corre en Apps Script, así que las pruebas reales las corre el usuario en el editor. En local se corren los `.gs` con `simulador/servidor.js`.

### Fase 1: rol `EXPOSITOR` (roles múltiples aplazados)

Solo se crea el rol `EXPOSITOR` y se separan los alcances. Lo que sigue de esta fase aplica solo si se retoma la celda con varios roles.

- `datos.gs`: `leerStaff_` entrega `roles` (lista) y `rol` (texto unido). `leerPermisos_` sin cambio.
- `sesion.gs`: `sesion_()` une las vistas de todos los roles. Se agrega `sesion.roles`. La regla de `VISTAS_DEL_VALIDADOR` aplica solo si el rol es `VALIDADOR`.
- `panel-admin.gs`: normalización de `rol` con la lista y las reglas 1 a 3. En `panel-admin-script.html` el campo rol pasa de lista simple a casillas.
- `comun-script.html`: etiqueta de cabecera.
- Pruebas: `datos-test.gs` y `pruebas-lideres.gs` con una sesión `LIDER|EXPOSITOR`.

### Fase 2: alcance por rol

- `generar-codigo.gs`: `standsALiderar_` se divide en `pabellonesALiderar_(sesion)`, que exige `LIDER` y usa `pabellon_id`.
- `preguntas.gs`: `standsDelExpositor_(sesion)`, que exige `EXPOSITOR` y usa `stand_id`. Admin y validador ven todo.
- Tope de 12 activas: una pregunta nueva que pasa de 12 se **rechaza con mensaje**, en lugar de crearse inactiva sin aviso.
- Panel admin: el formulario del stand asigna un **expositor**. El pabellón pasa a tener un campo de líder (regla 19 reescrita, sin degradar a un `ADMIN` ni quitar un rol que ya tiene).

### Fase 3: código por pabellón

- `generar-codigo.gs`: `leerCodigos_`, `crearFilasDeCodigos_`, `generarCodigoDe_`, `prepararCodigos` por `pabellon_id`.
- `quiz.gs`: `codigoValido_` y la caché `codigo:PAB-xxx`.
- Panel admin: al eliminar un pabellón se anula su única fila de códigos.
- Pruebas: `pruebas-lideres.gs` (concurrencia de generación), ahora con menos filas.

### Fase 4: quiz por pabellón (la más grande)

- `datos.gs`: `catalogo_` agrega a cada pabellón sus stands activos y su `preguntas_por_stand`. `pabellonesDelMapa_` filtra por el `requiere_codigo` del pabellón.
- `quiz.gs`:
  - `iniciarQuiz(pabellonId, codigo)`: carga el banco de cada stand, exige `preguntas_banco_stand` en cada uno, sortea `preguntas_por_stand` de cada uno y arma el intento.
  - `enviarQuiz`: corrige con el banco de cada stand del intento.
  - `retomarIndice_`: busca cada pregunta en los bancos del pabellón.
- `indice.gs`: clave `i:PAB-xxx`. `reconstruirIndice_` lee `pabellon_id`. `filaLibreDe_` sin cambio.
- `mapa.gs`: el elemento abrible es el pabellón. `numPreguntas` y `puntosMax` salen de las preguntas reales del pabellón.
- `quiz-script.html`, `mapa-script.html`: tarjeta de pabellón; los stands pasan a ser informativos.
- `ranking.gs`: clave de duplicados `email|pabellon_id`.
- `quiz.gs` `verQuiz`: el validador recorre el pabellón o el stand; se actualiza el aviso de las "4 al azar".
- Panel admin: en la pestaña Pabellones, cada pabellón muestra cuántas preguntas activas tiene cada stand (por ejemplo `8/12`). Así el admin ve qué falta sin que el líder tenga que intervenir.

### Fase 5: datos, pruebas y documentación

- `preguntas_demo_stands.tsv`: 12 preguntas activas por stand. `intentos_demo.tsv`: una fila por pabellón.
- `prueba-feria.gs`, `simulacion.gs`, `simulacion-puntajes.gs`, `datos-test.gs`, `simulador/servidor.js`: modelo nuevo.
- Documentos: `modelo-de-datos.md` (reglas 1, 6 a 11, 19 y las tablas `Staff`, `Permisos`, `Codigos`, `Intentos`), `producto-funcional.md`, `ux-ui.md`, `apps-script.md`, `formato-preguntas-json.md` (12 en lugar de 16), `README.md`. `VERSION_DEL_CODIGO` sube.
- Reinicio con `prepararFeria`, con `Intentos` vacía. Después, `iniciarPruebaCarga` y `revisarPruebaCarga` otra vez; las conclusiones de capacidad salen de esos registros.

## Orden y plazo

Las fases 1 a 3 son relativamente pequeñas (roles, alcance y códigos). La 4 es el grueso del riesgo. Con la feria el 22/10 conviene tener la fase 4 lista alrededor del 16/10 y dejar el 17 al 20 para pruebas de carga y ensayo con datos reales. Nada de `clasp push` sin que el usuario lo pida: reemplaza el proyecto remoto completo.

## Decisiones confirmadas (2026-10-12)

1. **Quiz de entrada.** Sigue siendo un pabellón con un stand (`PAB-000`, `STD-000`), sin código y con 4 preguntas: `Pabellones.preguntas_por_stand = 4`.
2. **`requiere_codigo` vive en `Pabellones`.** El código desbloquea el pabellón completo; el usuario ya no elige stands sueltos.
3. **Las 12 preguntas** son el tope para el expositor y el mínimo por stand para que el pabellón abra su quiz.

## Pendiente

Ninguna. "Personas con dos pabellones o dos funciones" quedó resuelto: son personas distintas.

## Cuidados antes de la feria

- **Migrar `Staff`.** Hoy los `LIDER` tienen `stand_id`. Con el modelo nuevo un `LIDER` lidera el pabellón entero. Las filas actuales con `stand_id` pasan a `EXPOSITOR` y se agrega un `LIDER` por pabellón.
- **Pabellón sin líder.** Solo el `ADMIN` puede generar su código. El panel debe mostrar qué pabellones no tienen líder, junto al avance de preguntas por stand.

## Edición de los Sheets (hacer en la copia de pruebas y, después, en el Sheet real)

Antes de subir el código y de ejecutar `prepararFeria`:

1. **`Intentos`**: renombrar la cabecera `stand_id` a `unidad_id` (misma columna).
2. **`Codigos`**: renombrar la cabecera `stand_id` a `unidad_id`.
3. **`Pabellones`**: agregar las columnas `requiere_codigo` (TRUE en todos, FALSE en el pabellón del quiz de entrada) y `preguntas_por_stand` (4 en el de entrada; vacío en los demás, que usan 2).
4. **`Staff`**: agregar la columna `charla_id`. Las filas `LIDER` que tienen `stand_id` pasan a `EXPOSITOR` (con su `pabellon_id` y su `stand_id`). Cada pabellón con código necesita un `LIDER` (con `pabellon_id` y `stand_id` vacío): se puede asignar desde el panel.
5. **`Permisos`**: `LIDER` solo con `GENERAR_CODIGO`; agregar `EXPOSITOR` → `PREGUNTAS`, `PONENTE` → `GENERAR_CODIGO` y `PREGUNTAS`, `CHARLAS` para `VALIDADOR` y `ADMIN`, y para `USUARIO` según la fecha (`CHARLAS` y `QUIZ` en la semana de charlas; `MAPA` y `QUIZ` en el evento).
6. **`Charlas`** (hoja nueva): pegar `charlas_demo.tsv` y corregir títulos, ponentes y horarios.
7. **`Preguntas`**: cada stand con 12 preguntas activas y cada charla con 15 (`stand_id` lleva `CHA-001`, etc.). `preguntas_demo_stands.tsv` ya trae 12 activas por stand.
8. **Config** (opcional): las claves nuevas (`preguntas_por_stand`, `preguntas_banco_stand`, `preguntas_quiz_charla`, `preguntas_banco_charla`) ya tienen valor por defecto.

Después: subir el código con `clasp push` (reemplaza el proyecto remoto completo), ejecutar `probarTodo` y revisar que todo salga OK, ejecutar `prepararFeria` con `Intentos` vacía y, en la copia, las pruebas de carga (`iniciarPruebaCarga`, `iniciarPruebaLideres`).
