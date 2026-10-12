/**
 * Entrada de la web app. Arma una sola página con las vistas que el rol puede abrir.
 * Cada vista vive en cuatro archivos: <vista>.gs, <vista>-view.html, <vista>-style.html y <vista>-script.html.
 */

// Se muestra en la página de error y en el diagnóstico, para saber qué código está corriendo de verdad.
// Cambiarla en cada entrega: si la app publicada muestra otra, falta crear una nueva versión de la implementación.
const VERSION_DEL_CODIGO = '2026-10-12.5';

// Vista de la hoja Permisos -> prefijo de sus archivos. Una vista que no esté aquí aún no está programada.
const ARCHIVO_DE_VISTA = {
  MAPA: 'mapa',
  QUIZ: 'quiz',
  RANKING: 'ranking',
  GENERAR_CODIGO: 'generar-codigo',
  PREGUNTAS: 'preguntas',
  PANEL_ADMIN: 'panel-admin',
  ESPERA: 'espera',   // no va en Permisos: la decide espera_activa en Config
};

function doGet() {
  try {
    sincronizarRoles_();
    let sesion = sesion_();
    let vistas = sesion.vistas.filter(v => ARCHIVO_DE_VISTA[v]);
    if (!vistas.length) {
      // Puede ser la caché con datos anteriores a una corrección en el Sheet: se relee una vez antes de fallar.
      refrescarCatalogo_();
      sesion = sesion_();
      vistas = sesion.vistas.filter(v => ARCHIVO_DE_VISTA[v]);
    }
    if (!vistas.length) throw new Error('Tu rol no tiene vistas asignadas. Avisa a un administrador.');

    // Abrir la app no lee ni escribe Usuarios: el registro lo pide el navegador en segundo plano (registro.gs).
    const nombre = nombreDe_(sesion);

    const config = catalogo_().config;
    const plantilla = HtmlService.createTemplateFromFile('index');
    plantilla.archivos = vistas.map(v => ARCHIVO_DE_VISTA[v]);
    plantilla.inicio = JSON.stringify({
      nombre: nombre,
      rol: sesion.rol,
      vistas: vistas,
      minutosParaResponder: config.minutos_para_responder,
      minutosVigenciaCodigo: config.minutos_vigencia_codigo,
      segundosRefresco: config.segundos_refresco_board,
      fallosDeCodigo: FALLOS_DE_CODIGO_MAX,
      segundosBloqueoCodigo: SEGUNDOS_BLOQUEO_CODIGO,
      registrar: debeRegistrarse_(sesion) && !registroConfirmado_(),
    }).replace(/</g, '\\u003c');

    return plantilla.evaluate()
      .setTitle('Explore Fair')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    // El recuadro de diagnóstico debe mostrar lo que hay en el Sheet ahora, no una copia guardada.
    try { CATALOGO_ = leerCatalogo_(); } catch (ignorado) { /* sin acceso al Sheet: se muestra lo que se pueda */ }
    return paginaDeError_(error.message, quienEntra_());
  }
}

/**
 * Lo que la app logró saber de quien entra, para mostrarlo en la página de error.
 * Cada dato se averigua por separado: si uno falla, los demás igual se muestran.
 */
function quienEntra_() {
  const datos = [];
  const anotar = (etiqueta, obtener) => {
    try { datos.push([etiqueta, obtener() || '(vacío)']); } catch (error) { datos.push([etiqueta, 'no se pudo leer: ' + error.message]); }
  };
  let email = '';
  anotar('Correo detectado', () => (email = texto_(Session.getActiveUser().getEmail()).toLowerCase()));
  anotar('Nombre', () => {
    if (!email) return '';
    const staff = catalogo_().staff.find(s => s.email === email);
    return (staff && staff.nombre) || nombreDeDirectorio_(email) || nombreDesdeEmail_(email);
  });
  anotar('Rol asignado', () => {
    if (!email) return '';
    const staff = catalogo_().staff.find(s => s.email === email);
    return staff ? staff.rol + ' (está en la hoja Staff)' : 'USUARIO (no está en la hoja Staff)';
  });
  anotar('Vistas de ese rol en Permisos', () => (email ? sesion_().vistas.join(', ') : ''));
  anotar('Roles que sí tienen vistas en Permisos', () => {
    const roles = {};
    catalogo_().permisos.forEach(p => { roles[p.rol] = true; });
    return Object.keys(roles).join(', ');
  });
  // Lectura directa de la hoja, sin caché, para ver por qué no se reconocen sus filas.
  anotar('Hoja Permisos tal como está en el Sheet', () => {
    const filas = leerHoja_(HOJA.PERMISOS);
    const primera = filas[0] || {};
    return filas.length + ' filas con dato en la columna A · encabezados: ' + encabezados_(HOJA.PERMISOS).join(' | ') +
      ' · filas con activo en TRUE: ' + filas.filter(f => esVerdadero_(f.activo)).length +
      ' · primera fila: rol=' + primera.rol + ', vista=' + primera.vista + ', activo=' + primera.activo;
  });
  return datos;
}

/** Inserta el contenido de otro archivo HTML del proyecto. Se usa desde index.html. */
function incluir_(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

function paginaDeError_(mensaje, datos) {
  const seguro = texto => String(texto).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const filas = (datos || []).map(d =>
    '<p style="margin:10px 0 0;font-size:14px"><span style="display:block;color:#5f6368;font-size:12px">' + seguro(d[0]) + '</span>' + seguro(d[1]) + '</p>').join('');
  return HtmlService.createHtmlOutput(
    '<div style="font:16px/1.5 Roboto,system-ui,sans-serif;max-width:420px;margin:10vh auto;padding:0 24px;text-align:center;color:#1f1f1f">' +
    '<h1 style="font-size:22px;font-weight:400">No pudimos abrir la app</h1>' +
    '<p style="color:#5f6368">' + seguro(mensaje) + '</p>' +
    (filas ? '<div style="margin-top:24px;padding:6px 16px 16px;border:1px solid #dadce0;border-radius:16px;text-align:left;overflow-wrap:anywhere">' + filas + '</div>' : '') +
    '<p style="color:#9aa0a6;font-size:12px;margin-top:24px">Versión ' + VERSION_DEL_CODIGO + '</p></div>'
  ).setTitle('Explore Fair').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
