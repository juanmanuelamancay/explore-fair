/**
 * Diagnóstico del error "Se ha producido un error de servidor mientras se leía del almacenamiento. Código de error: INTERNAL".
 * Ese error lo dan PropertiesService y CacheService cuando Google no puede leer su almacén.
 * Solo lee: prueba cada almacén por separado, mide cuánto ocupan las propiedades del script (límite: 500 KB en total)
 * y cuenta las claves por prefijo, para ver si quedaron restos de pruebas de carga.
 */
function diagnosticarAlmacen() {
  const intentar = (nombre, accion) => {
    const inicio = Date.now();
    try {
      const resultado = accion();
      console.log('OK    ' + nombre + ' (' + (Date.now() - inicio) + ' ms)' + (resultado ? ': ' + resultado : ''));
      return true;
    } catch (error) {
      console.log('FALLA ' + nombre + ' (' + (Date.now() - inicio) + ' ms): ' + error.message);
      return false;
    }
  };

  console.log('===== Almacenes =====');
  intentar('ScriptProperties.getProperty(GEN)', () => PropertiesService.getScriptProperties().getProperty('GEN'));
  let todas = null;
  intentar('ScriptProperties.getProperties()', () => { todas = PropertiesService.getScriptProperties().getProperties(); return Object.keys(todas).length + ' claves'; });
  intentar('UserProperties.getProperties() (tu cuenta)', () => Object.keys(PropertiesService.getUserProperties().getProperties()).length + ' claves');
  intentar('ScriptCache.get', () => { CacheService.getScriptCache().get('diagnostico'); return ''; });
  intentar('UserCache.get', () => { CacheService.getUserCache().get('diagnostico'); return ''; });
  intentar('LockService.getScriptLock().tryLock', () => { const l = LockService.getScriptLock(); const ok = l.tryLock(1000); if (ok) l.releaseLock(); return ok ? 'libre' : 'ocupado'; });
  intentar('Abrir el Sheet', () => SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ID_DEL_SHEET).getName());

  if (!todas) { console.log('No se pudieron leer las propiedades del script: repite en unos minutos; si sigue, el fallo es de Google.'); return; }

  console.log('===== Propiedades del script =====');
  const porPrefijo = {};
  let bytes = 0;
  let mayor = { clave: '', bytes: 0 };
  Object.keys(todas).forEach(clave => {
    const tam = clave.length + String(todas[clave]).length;
    bytes += tam;
    if (tam > mayor.bytes) mayor = { clave: clave, bytes: tam };
    const prefijo = (clave.match(/^[^:]*:?/) || [clave])[0];
    porPrefijo[prefijo] = porPrefijo[prefijo] || { n: 0, bytes: 0 };
    porPrefijo[prefijo].n++;
    porPrefijo[prefijo].bytes += tam;
  });
  console.log('Total: ' + Object.keys(todas).length + ' claves, ~' + Math.round(bytes / 1024) + ' KB de 500 KB (' + Math.round(bytes / 5120) + '%)');
  console.log('Clave más grande: ' + mayor.clave + ' (~' + Math.round(mayor.bytes / 1024) + ' KB)');
  Object.keys(porPrefijo).sort((a, b) => porPrefijo[b].bytes - porPrefijo[a].bytes).forEach(p => {
    console.log('  ' + p + '  ' + porPrefijo[p].n + ' claves, ~' + Math.round(porPrefijo[p].bytes / 1024) + ' KB');
  });
  console.log('Cartas pendientes (reg:): ' + Object.keys(todas).filter(c => c.indexOf(PREFIJO_CARTA) === 0).length);
}
