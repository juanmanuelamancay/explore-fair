/** Configuración del dashboard. Cambiar SHEET_ID si se lee otro Sheet; vacío = el Sheet activo del script. */
const DASH_CONFIG = {
  SHEET_ID: '15dUACK9DdXYXGpNSEihFqT_TdFJt2GcM43RAtLqJhVM',
  ZONA: 'America/Lima',
  // Correos de simulación o de prueba que no entran en las cifras.
  EXCLUIR_EMAIL: /^(prueba-|sim-)/i,
  MIN_RESPUESTAS_PREGUNTA: 5,
};

function dashLibro_() {
  return DASH_CONFIG.SHEET_ID ? SpreadsheetApp.openById(DASH_CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function dashNormal_(texto) {
  return String(texto).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
}

/** Filas de una hoja como objetos, con los encabezados normalizados. La columna A debe tener dato. */
function dashLeer_(nombre) {
  const hoja = dashLibro_().getSheetByName(nombre);
  if (!hoja || hoja.getLastRow() < 2) return [];
  const valores = hoja.getDataRange().getValues();
  const encabezados = valores[0].map(dashNormal_);
  return valores.slice(1).filter(f => String(f[0]).trim() !== '').map(f => {
    const fila = {};
    encabezados.forEach((e, i) => { fila[e] = f[i]; });
    return fila;
  });
}

function dashSi_(valor) { return valor === true || String(valor).toUpperCase() === 'TRUE'; }

function dashTexto_(valor) { return String(valor === undefined || valor === null ? '' : valor).trim(); }

function dashMs_(valor) {
  if (valor instanceof Date) return valor.getTime();
  const ms = Date.parse(valor);
  return isNaN(ms) ? 0 : ms;
}

function dashJson_(texto) {
  try {
    const valor = JSON.parse(texto);
    return Array.isArray(valor) ? valor : [];
  } catch (e) {
    return [];
  }
}
