/**
 * Vista PANEL_ADMIN. Por ahora solo reinicia los datos que se generan durante la feria.
 */

const PALABRA_DE_REINICIO = 'REINICIAR';
// Hojas que la app escribe durante la feria. Las de catálogo nunca se tocan.
// Van como texto y no como HOJA.X porque el orden en que Apps Script carga los archivos no está garantizado.
const HOJAS_A_REINICIAR = ['Intentos', 'Codigos', 'Usuarios'];
const SEGUNDOS_BLOQUEO_REINICIO = 30000;

function conteos_() {
  const conteos = {};
  HOJAS_A_REINICIAR.forEach(nombre => { conteos[nombre] = Math.max(0, hoja_(nombre).getLastRow() - 1); });
  return conteos;
}

function ultimoReinicio_() {
  const guardado = PropertiesService.getScriptProperties().getProperty('ULTIMO_REINICIO');
  return guardado ? JSON.parse(guardado) : null;
}

function obtenerPanel() {
  exigirVista_('PANEL_ADMIN');
  return { conteos: conteos_(), ultimo: ultimoReinicio_() };
}

/** Descarta la caché para que la app relea ahora las hojas de catálogo, y devuelve qué encontró. */
function actualizarCatalogo() {
  exigirVista_('PANEL_ADMIN');
  limpiarCache();
  const catalogo = catalogo_();
  return {
    pabellones: catalogo.pabellones.length,
    stands: catalogo.stands.length,
    preguntas: leerHoja_(HOJA.PREGUNTAS).filter(p => esVerdadero_(p.activo)).length,
  };
}

/**
 * Copia Intentos, Codigos y Usuarios a hojas de respaldo ocultas y luego borra sus filas.
 * Los encabezados se conservan.
 */
function reiniciarDatos(palabra) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede reiniciar los datos.');
  if (texto_(palabra).toUpperCase() !== PALABRA_DE_REINICIO) throw new Error('La palabra de confirmación no coincide.');

  const libro = libro_();
  const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
  const borradas = {};

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO_REINICIO);
  try {
    HOJAS_A_REINICIAR.forEach(nombre => {
      const hoja = hoja_(nombre);
      const filas = Math.max(0, hoja.getLastRow() - 1);
      borradas[nombre] = filas;
      if (!filas) return;
      hoja.copyTo(libro).setName('respaldo_' + nombre + '_' + sello).hideSheet();
      hoja.getRange(2, 1, filas, hoja.getLastColumn()).clearContent();
    });
    const ultimo = { cuando: Date.now(), por: sesion.email };
    PropertiesService.getScriptProperties().setProperty('ULTIMO_REINICIO', JSON.stringify(ultimo));
    // Invalida ranking, usuarios registrados y catálogo en caché.
    limpiarCache();
    return { borradas: borradas, respaldo: 'respaldo_' + sello, conteos: conteos_(), ultimo: ultimo };
  } finally {
    bloqueo.releaseLock();
  }
}
