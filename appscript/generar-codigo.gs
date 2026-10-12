/**
 * Vista GENERAR_CODIGO: el líder genera el código temporal de su stand al terminar la charla.
 */

// Solo consonantes y dígitos, sin 0/O, 1/I/L. Sin vocales no se forman palabras ni valores
// que Sheets convierta solo (TRUE, fechas, notación científica como 2E45).
const LETRAS_DE_CODIGO = 'BCDFGHJKMNPQRSTVWXYZ';
const CARACTERES_DE_CODIGO = LETRAS_DE_CODIGO + '23456789';
const LARGO_DE_CODIGO = 4;

/** Stands para los que esta persona puede generar código, según su fila en Staff. */
function standsALiderar_(sesion, catalogo) {
  const pabellones = pabellonesDelMapa_(catalogo);
  const todos = [];
  pabellones.forEach(p => p.stands.forEach(s => todos.push({ id: s.id, nombre: s.nombre, pabellon: p.nombre, pabellonId: p.id, indice: p.indice })));
  if (sesion.rol === 'ADMIN' || sesion.rol === 'VALIDADOR') return todos;
  if (!sesion.staff) return [];
  if (sesion.staff.standId) return todos.filter(s => s.id === sesion.staff.standId);
  return todos.filter(s => s.pabellonId === sesion.staff.pabellonId);
}

function estaVigente_(codigo, ahoraMs) {
  return texto_(codigo.estado).toUpperCase() === 'ACTIVO' && ms_(codigo.expira_en) > ahoraMs;
}

function obtenerCodigos() {
  return obtenerCodigosDe_(exigirVista_('GENERAR_CODIGO'));
}

/** Lo que hace obtenerCodigos, para una sesión ya comprobada. La prueba de líderes la usa con sesiones armadas en memoria. */
function obtenerCodigosDe_(sesion) {
  const ahora = Date.now();
  const vigentes = {};
  leerHoja_(HOJA.CODIGOS).forEach(c => {
    if (estaVigente_(c, ahora)) vigentes[id_(c.stand_id)] = { codigo: texto_(c.codigo), expiraEn: ms_(c.expira_en) };
  });
  return {
    ahora: ahora,
    stands: standsALiderar_(sesion, catalogo_()).map(s => ({
      id: s.id, nombre: s.nombre, pabellon: s.pabellon, indice: s.indice, activo: vigentes[s.id] || null,
    })),
  };
}

/** Crea un código nuevo para el stand. El que estuviera activo deja de funcionar. */
function generarCodigo(standId) {
  return generarCodigoDe_(exigirVista_('GENERAR_CODIGO'), standId);
}

let ULTIMA_MEDIDA_CODIGO_ = null;

/** Lo que hace generarCodigo, para una sesión ya comprobada. La prueba de líderes la usa con sesiones armadas en memoria. */
function generarCodigoDe_(sesion, standId) {
  const catalogo = catalogo_();
  const stand = standsALiderar_(sesion, catalogo).find(s => s.id === id_(standId));
  if (!stand) throw new Error('No puedes generar códigos para este stand.');

  // Cada stand tiene su fila en Codigos y el código nuevo la reemplaza: no se agrega nada al final de la hoja,
  // así que no hace falta el turno global y dos stands nunca se esperan. Solo si la fila no existe todavía se
  // toma el turno, una vez, para crear las filas de todos los stands (ver asegurarFilasDeCodigos_).
  const t0 = Date.now();
  let leida = leerCodigos_(stand.id);
  if (leida.fila < 0) {
    asegurarFilasDeCodigos_(catalogo, stand.id);
    leida = leerCodigos_(stand.id);
    if (leida.fila < 0) throw new Error('No pudimos reservar la fila del código de este stand. Inténtalo de nuevo.');
  }
  const { hoja, tabla, encabezados, col } = leida;
  const t1 = Date.now();
  const ahora = new Date();

  // Lo que decide se calcula en memoria con la tabla ya leída (una fila por stand: unas 20 filas).
  const enUso = {};
  const anteriorDelStand = texto_(tabla[leida.fila][col.codigo]).toUpperCase();
  if (anteriorDelStand) enUso[anteriorDelStand] = true;
  tabla.forEach((fila, i) => {
    if (i === 0 || i === leida.fila) return;
    const activo = texto_(fila[col.estado]).toUpperCase() === 'ACTIVO';
    if (id_(fila[col.stand]) !== stand.id) {
      if (activo) enUso[texto_(fila[col.codigo]).toUpperCase()] = true;
    } else if (activo) {
      // Fila repetida de este mismo stand (datos de antes de este diseño o de una simulación): ya no vale.
      hoja.getRange(i + 1, col.estado + 1).setValue(ms_(fila[col.expira]) > ahora.getTime() ? 'ANULADO' : 'EXPIRADO');
    }
  });

  let codigo;
  do { codigo = codigoAlAzar_(); } while (enUso[codigo]);

  const expiraEn = new Date(ahora.getTime() + catalogo.config.minutos_vigencia_codigo * 60000);
  const nueva = {
    codigo: codigo, stand_id: stand.id, generado_por: sesion.email,
    creado_en: ahora, expira_en: expiraEn, estado: 'ACTIVO',
  };
  // Una sola escritura sobre la fila del stand. Si dos personas generan para el mismo stand a la vez, queda la última.
  hoja.getRange(leida.fila + 1, 1, 1, encabezados.length).setValues([encabezados.map(e => (nueva[e] === undefined ? '' : nueva[e]))]);
  const t2 = Date.now();
  // Se confirma antes de seguir: si la caché se pierde, validar el código lee la hoja y tiene que ver esta fila.
  SpreadsheetApp.flush();
  const t3 = Date.now();
  // El código vigente queda en caché: validarlo al empezar un quiz no tiene que leer la hoja.
  cachePoner_('codigo:' + stand.id, { codigo: codigo, expiraEn: expiraEn.getTime() }, catalogo.config.minutos_vigencia_codigo * 60);
  // Medición para la prueba de líderes (pruebas-lideres.gs): ms de cada fase de esta generación.
  ULTIMA_MEDIDA_CODIGO_ = { leer: t1 - t0, escribir: t2 - t1, confirmar: t3 - t2, cache: Date.now() - t3 };
  return { codigo: codigo, expiraEn: expiraEn.getTime(), ahora: Date.now() };
}

/**
 * Lee la hoja Codigos completa (con una fila por stand son unas 20) y ubica la fila del stand.
 * `fila` es su posición en `tabla` (0 es el encabezado), o -1 si el stand todavía no tiene fila.
 */
function leerCodigos_(standId) {
  const hoja = hoja_(HOJA.CODIGOS);
  const tabla = hoja.getDataRange().getValues();
  const encabezados = tabla[0].map(normal_);
  const columna = nombre => {
    const i = encabezados.indexOf(nombre);
    if (i < 0) throw new Error('Falta la columna "' + nombre + '" en Codigos.');
    return i;
  };
  const col = { codigo: columna('codigo'), stand: columna('stand_id'), estado: columna('estado'), expira: columna('expira_en') };
  let fila = -1;
  for (let i = 1; i < tabla.length; i++) if (id_(tabla[i][col.stand]) === standId) { fila = i; break; }
  return { hoja: hoja, tabla: tabla, encabezados: encabezados, col: col, fila: fila };
}

/**
 * Agrega a Codigos una fila por cada stand con código que no la tenga (con solo el stand_id; el código se escribe
 * al generarlo). Es lo único de este archivo que usa el turno global, y solo hace falta cuando falta alguna fila:
 * la primera generación tras limpiar la hoja, o un stand nuevo. Crea las de todos los stands de una vez, así que
 * los demás líderes que lleguen en ese momento esperan un instante y ya encuentran la suya.
 */
function asegurarFilasDeCodigos_(catalogo, standId) {
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    crearFilasDeCodigos_(catalogo, standId);
  } finally {
    bloqueo.releaseLock();
  }
}

/** Lo que hace asegurarFilasDeCodigos_, para quien ya tiene el turno global. Devuelve cuántas filas agregó. */
function crearFilasDeCodigos_(catalogo, standId) {
  const hoja = hoja_(HOJA.CODIGOS);
  const columna = encabezados_(HOJA.CODIGOS).indexOf('stand_id');
  if (columna < 0) throw new Error('Falta la columna "stand_id" en Codigos.');
  const ultima = hoja.getLastRow();
  const tienen = {};
  if (ultima > 1) hoja.getRange(2, columna + 1, ultima - 1, 1).getValues().forEach(v => { tienen[id_(v[0])] = true; });
  const ids = catalogo.stands.filter(s => s.requiereCodigo).map(s => s.id);
  if (standId) ids.push(standId);
  const faltan = ids.filter((id, i) => ids.indexOf(id) === i && !tienen[id]);
  if (!faltan.length) return 0;
  agregarFilas_(HOJA.CODIGOS, faltan.map(id => ({ stand_id: id })));
  SpreadsheetApp.flush();
  return faltan.length;
}

/**
 * Para ejecutar a mano desde el editor antes de la feria: deja en Codigos una fila por stand con código, así ningún
 * líder tiene que crearla al generar. Se puede repetir sin problema; también se hace dentro de prepararFeria.
 */
function prepararCodigos() {
  exigirAdmin_();
  refrescarCatalogo_();
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const agregadas = crearFilasDeCodigos_(catalogo_());
    console.log('Codigos: ' + agregadas + ' filas agregadas. Hay una por cada stand con código.');
  } finally {
    bloqueo.releaseLock();
  }
}

/** Empieza siempre con letra, así Sheets nunca lo guarda como número. */
function codigoAlAzar_() {
  const alAzar = caracteres => caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  let codigo = alAzar(LETRAS_DE_CODIGO);
  while (codigo.length < LARGO_DE_CODIGO) codigo += alAzar(CARACTERES_DE_CODIGO);
  return codigo;
}
