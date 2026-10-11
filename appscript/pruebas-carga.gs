/**
 * Pruebas de carga para ejecutar a mano desde el editor de Apps Script. No forman parte de la app:
 * ninguna función se llama desde el navegador (todas exigen admin o terminan en "_").
 *
 * 1. Filas simultáneas (punto 0.4 del plan de concurrencia): comprueba que no se pierden filas cuando varias
 *    ejecuciones escriben a la vez. Sin turno se perdían; hoy la prueba escribe con agregarFilaConTurno_.
 * 2. Llenar Intentos y medir cuánto tardan las lecturas y las peticiones (puntos 0.3 y 5.1).
 * 3. Auditar los puntajes antes de premiar (punto 5.4).
 *
 * La prueba del registro por lotes está aparte, en prueba-registro.gs.
 */

const PRUEBA_HOJA = 'PruebaFilas';
const PRUEBA_EJECUCIONES = 10;    // el límite es 20 disparadores por usuario
const PRUEBA_FILAS = 20;          // filas que agrega cada ejecución (con turno cada escritura tarda; 20 cabe en el límite de 6 minutos)
const PRUEBA_ESPERA_MS = 240000;  // todas arrancan a la misma hora, 4 minutos después

/** 1. Crea la hoja de prueba y programa las ejecuciones. */
function iniciarPruebaFilas() {
  exigirAdmin_();
  const libro = libro_();
  const vieja = libro.getSheetByName(PRUEBA_HOJA);
  if (vieja) libro.deleteSheet(vieja);
  libro.insertSheet(PRUEBA_HOJA).appendRow(['ejecucion', 'n', 'cuando']);
  PropertiesService.getScriptProperties().setProperty('PRUEBA_SALIDA', String(Date.now() + PRUEBA_ESPERA_MS));
  for (let i = 0; i < PRUEBA_EJECUCIONES; i++) ScriptApp.newTrigger('pasoPruebaFilas_').timeBased().after(10000).create();
}

/** Lo que corre cada disparador: espera la hora común y agrega sus filas, cada una con el turno global. */
function pasoPruebaFilas_() {
  const salida = Number(PropertiesService.getScriptProperties().getProperty('PRUEBA_SALIDA'));
  if (!salida) return;
  const yo = Utilities.getUuid().slice(0, 8);
  const espera = salida - Date.now();
  if (espera > 0) Utilities.sleep(espera);
  for (let n = 1; n <= PRUEBA_FILAS; n++) agregarFilaConTurno_(PRUEBA_HOJA, { ejecucion: yo, n: n, cuando: new Date() });
}

/** 2. Ejecutar unos 6 minutos después de iniciar. Deben salir todas las filas: PRUEBA_FILAS por cada ejecución. */
function revisarPruebaFilas() {
  exigirAdmin_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pasoPruebaFilas_').forEach(t => ScriptApp.deleteTrigger(t));
  PropertiesService.getScriptProperties().deleteProperty('PRUEBA_SALIDA');
  const filas = libro_().getSheetByName(PRUEBA_HOJA).getDataRange().getValues().slice(1);
  const porEjecucion = {};
  filas.forEach(f => { porEjecucion[f[0]] = (porEjecucion[f[0]] || 0) + 1; });
  console.log('Filas: ' + filas.length + ' de ' + PRUEBA_EJECUCIONES * PRUEBA_FILAS);
  console.log('Por ejecución: ' + JSON.stringify(porEjecucion));
}

/**
 * Agrega filas de relleno a Intentos, con el tamaño del final de la feria. Se borran con limpiarSimulacion(),
 * porque usan el dominio de correo de la simulación.
 * El relleno va debajo de los bloques de filas ya entregados (indice.gs), y al terminar el contador de orden
 * salta por encima de él: así el bloque de la siguiente persona empieza después del relleno y no lo pisa.
 */
function llenarIntentosDePrueba(cuantas) {
  exigirAdmin_();
  const turno = LockService.getScriptLock();
  turno.waitLock(SEGUNDOS_BLOQUEO);
  try {
    llenarIntentosDePrueba_(cuantas || 20000);
  } finally {
    turno.releaseLock();
  }
}

function llenarIntentosDePrueba_(total) {
  const POR_TANDA = 5000;
  const encabezados = encabezados_(HOJA.INTENTOS);
  const hoja = hoja_(HOJA.INTENTOS);
  const preguntas = JSON.stringify(['PRG-001', 'PRG-002', 'PRG-003', 'PRG-004']);
  const respuestas = JSON.stringify(['PRG-001', 'PRG-002', 'PRG-003', 'PRG-004'].map(p => ({ p: p, r: 'A', ok: true })));
  const primeraLibre = primeraFilaDe_(ultimoOrden_() + 1);
  for (let hechas = 0; hechas < total; hechas += POR_TANDA) {
    const filas = [];
    for (let i = hechas; i < Math.min(total, hechas + POR_TANDA); i++) {
      const fila = {
        intento_id: 'RELLENO-' + i, email: 'relleno' + (i % 1000) + SIM_DOMINIO,
        stand_id: 'STD-' + String(i % 20).padStart(3, '0'), preguntas_json: preguntas,
        iniciado_en: new Date(), vence_en: new Date(), estado: 'COMPLETADO',
        respuestas_json: respuestas, correctas: 4, puntaje: 40, completado_en: new Date(),
      };
      filas.push(encabezados.map(e => (fila[e] === undefined ? '' : fila[e])));
    }
    const desde = Math.max(hoja.getLastRow() + 1, primeraLibre);
    const faltan = desde + filas.length - 1 - hoja.getMaxRows();
    if (faltan > 0) hoja.insertRowsAfter(hoja.getMaxRows(), faltan);
    hoja.getRange(desde, 1, filas.length, encabezados.length).setValues(filas);
  }
  SpreadsheetApp.flush();
  const saltaHasta = Math.max(ultimoOrden_(), ordenDeFila_(hoja.getLastRow()));
  buzon_().setProperty(CLAVE_ULTIMO_ORDEN, String(saltaHasta));
  console.log('Intentos ahora: ' + filasConDato_(HOJA.INTENTOS) + ' filas con dato. El siguiente número de orden será el ' + (saltaHasta + 1) + '.');
}

/** Cuánto tarda leer cada hoja completa, tres veces, para no decidir con una sola medición. */
function medirLecturas() {
  exigirAdmin_();
  [HOJA.INTENTOS, HOJA.USUARIOS, HOJA.CODIGOS, HOJA.PREGUNTAS].forEach(nombre => {
    const tiempos = [];
    let filas = 0;
    for (let vez = 0; vez < 3; vez++) {
      const inicio = Date.now();
      filas = leerHoja_(nombre).length;
      tiempos.push(Date.now() - inicio);
    }
    console.log(nombre + ': ' + filas + ' filas · ms por lectura: ' + tiempos.join(', '));
  });

  // Lo que lee el ranking (4.1): mismas filas, pero solo las columnas que usa.
  const tiemposRanking = [];
  for (let vez = 0; vez < 3; vez++) {
    const inicio = Date.now();
    leerHoja_(HOJA.INTENTOS, ['email', 'stand_id', 'estado', 'puntaje', 'completado_en']);
    tiemposRanking.push(Date.now() - inicio);
  }
  console.log('Intentos, solo columnas del ranking · ms por lectura: ' + tiemposRanking.join(', '));
}

/**
 * Cuánto tardan las peticiones que más se repiten, con la hoja tal como está. Se ejecuta desde el editor,
 * con la cuenta de admin: el índice de esa cuenta se usa igual que el de cualquier persona.
 */
function medirPeticiones() {
  exigirAdmin_();
  const medir = (nombre, accion) => {
    const tiempos = [];
    for (let vez = 0; vez < 3; vez++) {
      const inicio = Date.now();
      accion();
      tiempos.push(Date.now() - inicio);
    }
    console.log(nombre + ': ms por llamada · ' + tiempos.join(', '));
  };
  medir('obtenerMapa (índice ya armado)', () => obtenerMapa());
  medir('reconstruir índice desde la hoja', () => reconstruirIndice_(sesion_()));
  medir('ranking completo (lee Intentos)', () => rankingCompleto_());
}

/**
 * Antes de premiar: recalcula cada intento COMPLETADO desde sus respuestas guardadas y el banco de Preguntas,
 * y lista los que no coinciden con lo guardado (puntaje editado a mano) y las filas repetidas por persona y stand.
 * Si una pregunta cambió de puntos o de respuesta después de que alguien la respondió, también aparece aquí.
 */
function auditarPuntajes() {
  exigirAdmin_();
  const preguntas = {};
  leerHoja_(HOJA.PREGUNTAS).forEach(p => {
    preguntas[id_(p.pregunta_id)] = { correcta: texto_(p.correcta).toUpperCase(), puntos: Number(p.puntos) || 0 };
  });

  const vistos = {};
  const repetidos = [];
  const noCoinciden = [];
  let revisados = 0;
  leerHoja_(HOJA.INTENTOS).forEach(i => {
    if (texto_(i.estado).toUpperCase() !== 'COMPLETADO') return;
    revisados++;
    const clave = texto_(i.email).toLowerCase() + '|' + id_(i.stand_id);
    if (vistos[clave]) repetidos.push(id_(i.intento_id) + ' (' + clave + ')');
    vistos[clave] = true;

    let detalle;
    try { detalle = JSON.parse(i.respuestas_json || '[]'); } catch (error) { noCoinciden.push(id_(i.intento_id) + ': respuestas ilegibles'); return; }
    let correctas = 0, puntaje = 0;
    detalle.forEach(d => {
      const pregunta = preguntas[id_(d.p)];
      if (pregunta && texto_(d.r).toUpperCase() === pregunta.correcta) { correctas++; puntaje += pregunta.puntos; }
    });
    const guardadas = Number(i.correctas) || 0, guardado = Number(i.puntaje) || 0;
    if (correctas !== guardadas || puntaje !== guardado) {
      noCoinciden.push(id_(i.intento_id) + ': guardado ' + guardadas + ' correctas / ' + guardado + ' pts, recalculado ' + correctas + ' / ' + puntaje);
    }
  });

  console.log('Intentos completados revisados: ' + revisados);
  console.log('No coinciden: ' + (noCoinciden.length ? noCoinciden.join(' | ') : 'ninguno'));
  console.log('Repetidos por persona y stand: ' + (repetidos.length ? repetidos.join(' | ') : 'ninguno'));
}
