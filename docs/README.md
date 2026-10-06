# Documentación de Explore Fair

Aplicación transversal de la feria de custom agents: quiz por stand, códigos temporales generados por los líderes y ranking en pantalla gigante. Corre en Google Apps Script y guarda sus datos en un único archivo de Google Sheets.

Esta carpeta es la fuente de verdad del diseño. Sirve para que una persona o una IA pueda validar que el Sheet y el código coinciden con lo acordado.

## Índice

| Documento | Contenido | Estado |
|---|---|---|
| [datos/modelo-de-datos.md](datos/modelo-de-datos.md) | Hojas del Sheet, campos y relaciones entre tablas | Vigente |
| [reglas/ux-ui.md](reglas/ux-ui.md) | Estilo visual, reglas para celular y comportamiento de las pantallas del usuario, el líder y el admin | Vigente |
| [arquitectura/apps-script.md](arquitectura/apps-script.md) | Archivos del proyecto Apps Script, reglas del servidor, caché, despliegue y simulador local | Vigente |

Carpetas del proyecto:

- `appscript/`: el código real de la web app, listo para copiar a Apps Script.
- `simulador/`: servidor local para probar `appscript/` sin desplegar.
- `prototipo/`: maquetas de UX y UI con datos de ejemplo.
- `docs/`: esta documentación.

Prototipos navegables, con datos de ejemplo:

- [../prototipo/usuario.html](../prototipo/usuario.html): vistas `MAPA`, `QUIZ` y `RANKING`.
- [../prototipo/lider.html](../prototipo/lider.html): vistas `GENERAR_CODIGO` y `RANKING`.
- [../prototipo/admin.html](../prototipo/admin.html): prototipo visual de `PANEL_ADMIN` y `RANKING`; la vista real administra el catálogo desde Apps Script.

Carpetas y documentos previstos, se crean cuando tengan contenido:

- `reglas/negocio.md`: puntaje, expiración, desempate y permisos por rol.

## Convenciones de esta carpeta

- **Un tema por archivo**, en Markdown, con nombre en minúsculas y guiones.
- **Si el diseño cambia, se actualiza el documento en el mismo cambio** que toca el Sheet o el código. Un documento desactualizado se considera un error.
- **Los nombres de hojas y campos se escriben exactamente como en el Sheet**, en formato `codigo`, para poder buscarlos.
- **Las decisiones aún no confirmadas van en una sección "Pendiente"** dentro del documento que afectan, no mezcladas con lo ya decidido.
- **Cada documento nuevo se agrega al índice** de este archivo.
