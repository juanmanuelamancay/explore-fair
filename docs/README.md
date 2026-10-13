# Documentación de Explore Fair

Aplicación transversal de la feria de custom agents: agenda de charlas previa al evento y quiz por pabellón en la feria, códigos temporales generados por líderes de pabellón y ponentes, y ranking en pantalla gigante. Corre en Google Apps Script y guarda sus datos en un único archivo de Google Sheets.

Esta carpeta describe la app tal como está en el código. Si un documento y el código no coinciden, manda el código y se corrige el documento. Última revisión contra el código: 2026-10-13, versión `2026-10-13.1` (`VERSION_DEL_CODIGO` en `appscript/main.gs`).

## Índice

| Documento | Contenido | Estado |
|---|---|---|
| [producto-funcional.md](producto-funcional.md) | Propósito del producto y funcionamiento del área de preguntas | Vigente |
| [datos/modelo-de-datos.md](datos/modelo-de-datos.md) | Hojas del Sheet, campos y relaciones entre tablas, y cómo se reparten las filas de `Intentos` por persona | Vigente |
| [datos/formato-preguntas-json.md](datos/formato-preguntas-json.md) | Formato del archivo JSON para cargar preguntas dentro de un stand | Vigente |
| [reglas/ux-ui.md](reglas/ux-ui.md) | Estilo visual, reglas para celular y comportamiento de las pantallas del usuario, el líder y el admin | Vigente |
| [arquitectura/apps-script.md](arquitectura/apps-script.md) | Archivos del proyecto Apps Script, reglas del servidor, caché, bloqueos, registro por lotes, índice por persona, filas propias en `Intentos`, pruebas de carga con sus mediciones, despliegue y simulador local | Vigente |
| [plan-concurrencia.md](plan-concurrencia.md) | Plan por puntos para soportar a menos de 1.000 personas a la vez: caché, bloqueos, ranking solo para el admin, índice por persona y ajustes de tablas | Fases 0 a 4 ya están en el código; el documento anota qué quedó distinto y qué falta |
| [plan-quiz-por-pabellon.md](plan-quiz-por-pabellon.md) | Cambio de modelo del 2026-10-12: quiz por pabellón, roles líder / expositor / ponente, charlas previas, filas reservadas y calendario | Implementado en el código; el documento conserva el calendario y las decisiones |

Carpetas del proyecto:

- `appscript/`: el código real de la web app. Se sube a Apps Script con `clasp`.
- `simulador/`: servidor local para probar `appscript/` sin desplegar.
- `prototipo/`: maquetas de UX y UI con datos de ejemplo.
- `docs/`: esta documentación.

En la raíz hay además tres archivos de datos de ejemplo para pegar en el Sheet: `preguntas_demo_stands.tsv` (12 preguntas activas por stand), `intentos_demo.tsv` (intentos ya respondidos, uno por persona y pabellón) y `charlas_demo.tsv` (las cinco charlas de la semana previa, con títulos y ponentes por cambiar).

Prototipos navegables, con datos de ejemplo. Son maquetas: la app real cambió después y no coincide en todo con ellos (ver [reglas/ux-ui.md](reglas/ux-ui.md)).

- [../prototipo/usuario.html](../prototipo/usuario.html): mapa, quiz y ranking. En la app real el usuario ya no tiene ranking ni ve su puesto.
- [../prototipo/lider.html](../prototipo/lider.html): generar código y ranking. En la app real el líder no tiene ranking.
- [../prototipo/admin.html](../prototipo/admin.html): reinicio de datos y ranking. La vista real `PANEL_ADMIN` además administra el catálogo.

Documentos previstos, se crean cuando tengan contenido:

- `reglas/negocio.md`: puntaje, expiración, desempate y permisos por rol.

## Convenciones de esta carpeta

- **Un tema por archivo**, en Markdown, con nombre en minúsculas y guiones.
- **Si el código cambia, se actualiza el documento en el mismo cambio.** Un documento desactualizado se considera un error.
- **Los nombres de hojas y campos se escriben exactamente como en el Sheet**, en formato `codigo`, para poder buscarlos.
- **Las decisiones aún no confirmadas van en una sección "Pendiente"** dentro del documento que afectan, no mezcladas con lo ya decidido.
- **Cada documento nuevo se agrega al índice** de este archivo.
