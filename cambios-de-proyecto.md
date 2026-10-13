# Cambios de proyecto: quiz por pabellón, charlas y nuevos roles

Fecha: 2026-10-13 · Versión del código: `2026-10-13.1` · Feria: jueves 22 de octubre de 2026

Este documento reúne **todo lo que hay que hacer** para pasar de la versión anterior (quiz por stand) a la nueva dinámica. El código ya está escrito y probado en el simulador local; falta subirlo y preparar los Sheets. El detalle técnico está en [docs/plan-quiz-por-pabellon.md](docs/plan-quiz-por-pabellon.md).

## La nueva dinámica en resumen

| Antes | Ahora |
|---|---|
| Un quiz por stand (banco de 16, se responden 4) | Un quiz por **pabellón**: cada stand aporta 2 preguntas de su banco de 12. Pabellón de 4 stands = 8 preguntas |
| Un código por stand | Un código por **pabellón** |
| `LIDER` genera códigos y edita preguntas | `LIDER` genera el código de su pabellón · `EXPOSITOR` edita su stand (hasta 12 preguntas) · `PONENTE` genera el código de su charla y edita sus preguntas (hasta 15) |
| Solo el evento | **Semana de charlas** (lun 19 a mié 21): agenda de charlas con horario, 5 preguntas de un banco de 15, código de 5 minutos. Los puntos suman al mismo ranking que el evento |
| 25 filas por persona en `Intentos` | **16 filas** por persona (entrada + 6 pabellones + 5 charlas = 12 intentos) |

Reglas que no cambian: un intento por persona y unidad, 5 minutos para responder, el quiz de entrada va primero (solo para pabellones, no para charlas), 3 códigos errados bloquean 2 minutos.

## Calendario

| Cuándo | Qué |
|---|---|
| Hasta el vie 16 | Preparar la copia de pruebas (parte 1), subir el código ahí y probar (parte 2) |
| Sáb 17 – dom 18 | Preparar el Sheet real (parte 3) y hacer el **último** `prepararFeria` |
| **Lun 19 – mié 21** | Charlas en vivo. `USUARIO` ve la agenda de charlas. **No reiniciar datos ni cambiar la forma de las hojas** |
| Mié 21, noche | Pasar `USUARIO` de `CHARLAS` a `MAPA` (parte 5) |
| **Jue 22** | Feria |

> Desde que la primera persona responda una charla, `prepararFeria` y "Reiniciar datos" borrarían esos puntos. Todo lo de las partes 1 a 3 tiene que estar hecho antes.

---

## Parte 1. Editar los Sheets

Hágalo **primero en una copia** del Sheet y, cuando todo pase, repita lo mismo en el Sheet real. La app busca hojas y columnas por su nombre, sin distinguir mayúsculas ni tildes; el orden de las columnas no importa (salvo que la columna A siempre debe tener dato).

### 1.1 `Intentos`: renombrar una cabecera

- [ ] Cambie el encabezado `stand_id` por **`unidad_id`** (misma columna, no mueva nada más).
- Si no lo hace, nadie puede empezar un quiz y el ranking se rompe. `probarTodo` lo marca con FALLA.

### 1.2 `Codigos`: renombrar una cabecera

- [ ] Cambie el encabezado `stand_id` por **`unidad_id`**.

### 1.3 `Pabellones`: dos columnas nuevas

- [ ] Agregue la columna **`requiere_codigo`**.
- [ ] Agregue la columna **`preguntas_por_stand`**.

| Pabellón | `requiere_codigo` | `preguntas_por_stand` |
|---|---|---|
| El del quiz de entrada (por ejemplo `PAB-000`) | `FALSE` | `4` |
| Los demás | `TRUE` | vacío (usa 2) |

- Solo puede haber **un** pabellón con `requiere_codigo = FALSE`: el del quiz de entrada.
- El código ahora desbloquea el pabellón completo, así que `requiere_codigo` ya no se usa en `Stands`.

### 1.4 `Stands`: nada obligatorio

- Las columnas `requiere_codigo` y `num_preguntas` ya no se leen; puede dejarlas o borrarlas.
- Cada pabellón con código necesita al menos un stand activo.

### 1.5 `Staff`: una columna nueva y migrar los líderes

- [ ] Agregue la columna **`charla_id`**.
- [ ] Migre las filas existentes:

| Fila actual | Qué hacer |
|---|---|
| `LIDER` con `stand_id` (líder de un stand) | Cambie `rol` a **`EXPOSITOR`**. Conserve su `pabellon_id` y su `stand_id` |
| `LIDER` solo con `pabellon_id` (líder de pabellón) | Déjela como `LIDER`; el `stand_id` debe quedar vacío |
| `ADMIN`, `VALIDADOR` | Sin cambios |

- [ ] Cada pabellón con código necesita **un `LIDER`**: fila con `rol = LIDER`, su `pabellon_id` y `stand_id` vacío. Se puede escribir a mano o, ya con el código subido, desde el panel (formulario del pabellón, campo "Correo del líder").
- [ ] Cada stand puede tener **un `EXPOSITOR`** (`rol = EXPOSITOR`, su `pabellon_id` y su `stand_id`). Desde el panel: formulario del stand, "Correo del expositor".
- [ ] Cada charla necesita **un `PONENTE`** (`rol = PONENTE`, `charla_id` = el de su charla; `pabellon_id` y `stand_id` vacíos). Desde el panel: formulario de la charla, "Correo del ponente".
- Una persona tiene **una sola fila y un solo rol**. Si alguien hace dos cosas (por ejemplo, lidera un pabellón y expone un stand), necesita otro correo.

### 1.5.1 Ejemplo de `Staff`

| email | nombre | rol | pabellon_id | stand_id | charla_id | activo |
|---|---|---|---|---|---|---|
| admin@empresa.com | … | ADMIN | | | | TRUE |
| lider.backend@empresa.com | … | LIDER | PAB-001 | | | TRUE |
| expositor.apx@empresa.com | … | EXPOSITOR | PAB-001 | STD-001 | | TRUE |
| ponente.uno@empresa.com | … | PONENTE | | | CHA-001 | TRUE |
| validador@empresa.com | … | VALIDADOR | | | | TRUE |

### 1.6 `Permisos`: roles y vistas nuevos

Una fila por rol y vista. Estas son las filas que debe tener (`activo = TRUE`):

| rol | vista |
|---|---|
| `LIDER` | `GENERAR_CODIGO` (quite `PREGUNTAS`) |
| `EXPOSITOR` | `PREGUNTAS` |
| `PONENTE` | `GENERAR_CODIGO`, `PREGUNTAS` |
| `VALIDADOR` | `MAPA`, `QUIZ`, `PREGUNTAS`, `CHARLAS` |
| `ADMIN` | todas las que ya tiene + `CHARLAS` |
| `USUARIO` | **según la fecha**, ver abajo |

`USUARIO` cambia según el momento (esto es lo que apaga y enciende cada etapa):

| Etapa | `USUARIO` → `MAPA` | `USUARIO` → `CHARLAS` | `USUARIO` → `QUIZ` |
|---|---|---|---|
| Semana de charlas (lun 19 a mié 21) | FALSE | **TRUE** | TRUE |
| Evento (jue 22) | **TRUE** | FALSE | TRUE |

- `espera_activa` (en `Config`) debe estar en `FALSE` durante la semana de charlas: con la sala de espera encendida el usuario solo ve la sala de espera y no puede responder.
- El panel no deja activar `QUIZ` para un rol sin `MAPA` o `CHARLAS`.

### 1.7 Hoja nueva `Charlas`

- [ ] Cree la hoja **`Charlas`** (nombre exacto) con estas columnas en la fila 1:

`charla_id` · `titulo` · `ponente` · `descripcion` · `inicio` · `fin` · `cierre` · `preguntas_banco` · `preguntas_quiz` · `orden` · `activo` · `creado_en`

- [ ] Pegue el contenido de [charlas_demo.tsv](charlas_demo.tsv) (las 5 charlas) y corrija títulos, ponentes y horarios.

| Columna | Qué poner |
|---|---|
| `charla_id` | `CHA-001` a `CHA-005` |
| `titulo` | Lo que verá la gente en la ruta |
| `ponente` | Nombre del ponente (el **correo** va en `Staff`) |
| `inicio` | Fecha y hora de inicio, por ejemplo `2026-10-19 10:00` (hora de Lima). Desde esa hora la charla se puede responder |
| `fin` | Opcional. Hora real en que termina la charla, **solo informativa**: no controla nada |
| `cierre` | **Hora límite para responder.** Hasta esta hora los asistentes pueden empezar el quiz y el ponente generar códigos; después desaparecen el botón de ingresar código y el de generar código. Con una charla de 16:00 a 17:00, ponga `cierre` 17:30. **Si queda vacía, la charla no se cierra nunca.** El admin puede seguir generando códigos después del cierre |
| `preguntas_banco` | `15` (o vacío: usa `Config`) |
| `preguntas_quiz` | `5` (o vacío: usa `Config`) |
| `orden` | Desempata charlas con la misma hora |
| `activo` | `TRUE` |

- Quien ya empezó su quiz puede terminarlo aunque pase la hora de cierre. Quien tiene la pantalla del código abierta y llega la hora de cierre, vuelve solo a la ruta con el aviso "La hora para responder esta charla se venció".
- Para alargar una charla que se pasó de hora, cambie `cierre` desde el panel (pestaña Charlas) o en el Sheet: rige de inmediato desde el panel y en unos 30 segundos desde el Sheet.
- Las fechas se manejan solo desde la hoja. Si una charla cambia de hora, edítela aquí o en el panel (pestaña Charlas).

### 1.8 `Preguntas`: bancos completos

- [ ] **Cada stand activo: 12 preguntas activas.** Si un stand tiene menos, **todo su pabellón** queda sin quiz (el mensaje dice cuál stand falta). El archivo [preguntas_demo_stands.tsv](preguntas_demo_stands.tsv) ya trae 12 activas por stand.
- [ ] **Cada charla: 15 preguntas activas.** En la columna `stand_id` de `Preguntas` se escribe el ID de la charla (`CHA-001`).
- Los **puntos** de cada pregunta (columna `puntos`) y `puntos_por_defecto` (en `Config`) los decide usted: un pabellón con más stands tendrá más preguntas y, por tanto, puede dar más puntos.
- Hasta el tope (12 en un stand, 15 en una charla), el expositor y el ponente pueden agregar preguntas desde la app; pasado el tope solo editan las que hay. El admin no tiene tope.

### 1.9 `Config`: opcional

Estas claves ya traen valor por defecto; escríbalas solo si quiere cambiarlas:

| clave | valor por defecto | Para qué |
|---|---|---|
| `preguntas_por_stand` | 2 | Preguntas que aporta cada stand al quiz de su pabellón |
| `preguntas_banco_stand` | 12 | Preguntas activas que necesita cada stand (y tope del expositor) |
| `preguntas_quiz_charla` | 5 | Preguntas que se sortean en una charla |
| `preguntas_banco_charla` | 15 | Preguntas activas que necesita una charla (y tope del ponente) |

Ya existentes y que usted decide: `minutos_para_responder` (hoy 5; con quizzes de 6 a 8 preguntas conviene revisarlo), `minutos_vigencia_codigo` (5, es lo pedido para las charlas), `puntos_por_defecto` (10).

### 1.10 Lo que no se toca

`Usuarios`, `Premios` y el resto de `Config`. No inserte ni borre filas de `Usuarios` ni de `Intentos`.

---

## Parte 2. Copia de pruebas

El `.clasp.json` del proyecto apunta al proyecto de Apps Script **real**. `clasp push` lo reemplaza completo, así que no se debe subir nada ahí hasta que la copia pase todas las pruebas.

- [ ] Haga una copia del Sheet (Archivo → Hacer una copia) y anote su ID.
- [ ] Copie la carpeta del proyecto a otra ubicación (por ejemplo `explore-fair-pruebas`) y, **en esa copia**, cree un proyecto de Apps Script nuevo con `clasp create --type standalone --title "Explore Fair pruebas" --rootDir appscript`. Así el `.clasp.json` del proyecto original no cambia.
- [ ] En el proyecto de pruebas: Configuración del proyecto → Propiedades del script → agregue `SPREADSHEET_ID` con el ID de la copia (tiene prioridad sobre el ID que está escrito en `datos.gs`).
- [ ] Suba el código a ese proyecto de pruebas con `clasp push` y despliegue la web app (ejecutar como "el usuario que accede", acceso dentro del dominio).
- [ ] En esa copia, haga la **Parte 1** completa.
- [ ] Desde el editor (cuenta ADMIN de `Staff`):

| Orden | Función | Qué debe pasar |
|---|---|---|
| 1 | `probarTodo` | Todas las líneas en `OK`: hojas con sus columnas, unidades, quiz de entrada, charlas, bancos de preguntas |
| 2 | `prepararFeria` | Numera a los usuarios desde 1 y deja `Intentos` lista (unas 41.600 filas). Exige `Intentos` vacía |
| 3 | `probarLimiteDeCodigos` | `CODIGO, CODIGO, BLOQUEADO, BLOQUEADO` |
| 4 | `iniciarPruebaCarga` → esperar la hora que indica → `revisarPruebaCarga` | `DATOS: OK` y sin errores. Pegue el registro en el chat para revisarlo |
| 5 | `iniciarPruebaLideres` → `revisarPruebaLideres` | Sin problemas: ahora imita a un líder por pabellón con código y a un ponente por charla |
| 6 | `limpiarPruebaCarga` y `limpiarPruebaLideres` | Dejan la copia limpia |

- [ ] Entre con cuentas reales a la web app de pruebas y recorra: usuario (con `CHARLAS` y con `MAPA`), líder, expositor, ponente, validador y admin.
- [ ] Después de las pruebas de carga, ejecute `prepararFeria` otra vez en la copia (renumera desde 1).

## Parte 3. Preparar el Sheet y el proyecto reales (sáb 17 – dom 18)

- [ ] Repita en el **Sheet real** los pasos de la Parte 1 (renombres, columnas, hoja `Charlas`, `Staff`, `Permisos`, preguntas).
- [ ] Si el Sheet tiene muchas hojas `respaldo_...` (de reinicios anteriores), bórrelas desde el panel: tarjeta **Respaldos de los reinicios** → "Borrar respaldos" (escribir `BORRAR`). Hágalo después de reiniciar y preparar la feria, cuando ya no necesite las copias.
- [ ] Revise cuántas filas tiene hoy `Usuarios` (la sala de espera ya registra gente): `prepararFeria` las renumera desde 1 sin quitar a nadie.
- [ ] Suba el código al proyecto real con `clasp push` (versión `2026-10-13.1`), cree una **nueva versión de la implementación** y confirme que la página de error muestra esa versión.
- [ ] Ejecute `probarTodo` en el proyecto real: todo `OK`.
- [ ] Con `Intentos` vacía, ejecute `prepararFeria`. **Es el último reinicio** (desde el lunes 19 ya no se hace).
- [ ] Ejecute `prepararCodigos()` (deja una fila por pabellón con código y por charla).
- [ ] Panel → "Actualizar desde el Sheet" (deja las preguntas en caché).
- [ ] En el panel, pestaña Pabellones: revise que cada stand muestre `12/12 preguntas` y que ningún pabellón diga "sin líder"; en Charlas, `15/15` y ningún "sin ponente".
- [ ] `espera_activa` en `FALSE`; `feria_abierta` en `TRUE`.
- [ ] Permisos de `USUARIO` en modo semana de charlas (Parte 1.6).

## Parte 4. Semana de charlas (lun 19 – mié 21)

Para cada charla:

1. La charla se dicta (por Meet). Su fila ya tiene `inicio`; desde esa hora aparece "Abierta" en la ruta.
2. Al terminar, el **ponente** abre la vista Código y toca "Generar código" y lo dice o lo muestra.
3. Los asistentes tocan "Ingresar código" en la ruta y responden las 5 preguntas (5 minutos). Quien no lo ingresa en los 5 minutos del código no responde después, salvo que el ponente genere otro.
4. Los puntos suman al ranking.

Durante estos días **no** se cambia código ni se reinicia nada. Sí se puede, desde el panel o el Sheet: corregir una pregunta, cambiar un horario, asignar un ponente.

## Parte 5. Pasar al evento (mié 21, noche)

- [ ] En `Permisos`, para `USUARIO`: `CHARLAS` → FALSE y `MAPA` → TRUE (`QUIZ` sigue TRUE). Los cambios llegan en menos de un minuto; quien tenga la app abierta verá "Tu acceso cambió".
- [ ] Revise que cada líder de pabellón entre a su vista Código y genere un código de prueba (el código vence solo en 5 minutos).
- [ ] **No** reinicie datos: las charlas ya sumaron puntos que deben seguir en el ranking.
- [ ] Si se usa sala de espera para la mañana del jueves: `espera_activa` en TRUE y su `fecha_feria`; al llegar la hora, ponerla en FALSE.

## Parte 6. El día de la feria (jue 22)

- [ ] Cada líder de pabellón genera el código de su pabellón cuando termina la charla del pabellón (un código para todo el pabellón, no uno por stand).
- [ ] El ranking se proyecta desde la vista Ranking del admin.
- [ ] Antes de premiar, ejecute `auditarPuntajes` desde el editor.

## Qué revisar si algo falla

| Síntoma | Causa probable |
|---|---|
| "Falta la columna `unidad_id` en la hoja Intentos" | No se renombró la cabecera (1.1) |
| "Falta la columna `unidad_id` en Codigos" | No se renombró la cabecera (1.2) |
| Un pabellón dice "tiene K activas y necesita 12" | A un stand de ese pabellón le faltan preguntas (1.8) |
| "Agrega la columna `requiere_codigo` en la hoja Pabellones" (al guardar desde el panel) | Falta la columna (1.3) |
| "Agrega la columna `charla_id` en la hoja Staff" | Falta la columna (1.5) |
| "Crea primero la hoja Charlas" | Falta la hoja (1.7) |
| La agenda de charlas sale vacía | `Charlas` sin filas activas, o `USUARIO` sin la vista `CHARLAS` |
| El usuario ve el mapa en la semana de charlas | `Permisos` de `USUARIO` sigue en modo evento (1.6) |
| Un líder dice "No tienes nada asignado" | Falta su `pabellon_id` en `Staff`, o el pabellón no tiene stands activos |
| "Esta charla todavía no empieza" | Aún no llega su `inicio` (hora de Lima) |
| "Ya usaste las 16 filas reservadas" | Una persona superó 16 intentos: no debería pasar (12 como máximo) |

## Qué ya está hecho en el código (para su información)

- Quiz por pabellón con sorteo de 2 preguntas por stand, corrección y un intento por persona y pabellón.
- Hoja y vista de charlas con apertura por fecha, código de 5 minutos y sin quiz de entrada.
- Roles `LIDER`, `EXPOSITOR` y `PONENTE`, con tope de 12 y 15 preguntas activas.
- Panel: pestaña Charlas, asignación de líder, expositor y ponente por correo, avance de preguntas por stand y charla, y aviso de lo que no tiene responsable.
- Pruebas del editor adaptadas (`probarTodo`, `prueba-feria.gs`, `pruebas-lideres.gs`, simulaciones) y pruebas del simulador local en `simulador/pruebas/`.
- Documentación actualizada en `docs/`.

No está hecho (depende de usted): editar los Sheets, subir el código con `clasp`, correr las pruebas de carga en Apps Script y cargar las preguntas reales de cada stand y charla.
