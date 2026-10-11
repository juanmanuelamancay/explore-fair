/**
 * Prueba del registro por lotes (registro.gs). Para ejecutar a mano desde el editor de Apps Script.
 * No forma parte de la app: todas las funciones exigen admin o terminan en "_".
 * Escribe en la hoja Usuarios real, con correos de simulación que empiezan con "prueba-reg-", y al final los borra.
 *
 * A. probarRegistroSolo(): una sola ejecución, tarda segundos. Recorre el camino completo y anota cada paso:
 *    que encontró la llave, cuántas cartas se llevó, el descanso entre pasadas y que no se repiten filas.
 *    No puede mostrar la llave ocupada: para eso hacen falta varias ejecuciones a la vez.
 *
 * B. Varias ejecuciones a la vez, que es lo que el simulador local no puede probar:
 *    1. iniciarPruebaRegistro()  -> programa 10 ejecuciones que arrancan a la misma hora, 3 minutos después.
 *    2. Esperar unos 6 minutos.
 *    3. revisarPruebaRegistro()  -> veredicto (OK o FALLA) y bitácora de todas las pasadas, en un solo registro.
 *    El detalle carta por carta de cada ejecución queda en su propio registro, en la sección "Ejecuciones".
 *
 * Si algo queda a medias: limpiarPruebaRegistro() borra las filas, las cartas y los informes de prueba.
 */

const PRUEBA_REG_PREFIJO = 'prueba-reg-';
const PRUEBA_REG_INFORME = 'prueba-reg-informe:';
const PRUEBA_REG_EJECUCIONES = 10;    // el límite es 20 disparadores por usuario
const PRUEBA_REG_CARTAS = 30;         // personas que imita cada ejecución
const PRUEBA_REG_ESPERA_MS = 180000;  // todas arrancan a la misma hora, 3 minutos después
const PRUEBA_REG_PAUSA_MS = 800;      // pausa al azar, como máximo, entre una persona y la siguiente
const PRUEBA_REG_RONDAS = 3;          // confirmaciones, como las que hace el navegador de cada persona

/* ---------- Piezas comunes ---------- */

function correoDePrueba_(yo, n) { return PRUEBA_REG_PREFIJO + yo + '-' + n + SIM_DOMINIO; }

/** ¿El correo es de esta prueba? Con "yo", solo los de esa ejecución. */
function esDePrueba_(email, yo) {
  return texto_(email).toLowerCase().indexOf(PRUEBA_REG_PREFIJO + (yo ? yo + '-' : '')) === 0;
}

/** Deja la carta de una persona de mentira, igual que dejarCarta_ con una real. */
function dejarCartaDePrueba_(email) {
  buzon_().setProperty(PREFIJO_CARTA + email, JSON.stringify({ n: 'Prueba ' + email.split('@')[0].slice(PRUEBA_REG_PREFIJO.length), t: Date.now() }));
}

function cartasDePrueba_(yo) { return leerBuzon_().filter(c => esDePrueba_(c.email, yo)).length; }

/** Correos de prueba tal como están en la hoja, uno por fila: si hay repetidos, salen repetidos. */
function filasDePrueba_(yo) {
  return leerHoja_(HOJA.USUARIOS, ['email']).map(u => texto_(u.email).toLowerCase()).filter(e => esDePrueba_(e, yo));
}

function distintos_(lista) {
  const vistos = {};
  lista.forEach(valor => { vistos[valor] = true; });
  return Object.keys(vistos).length;
}

/** "1 carta", "3 cartas". */
function cuantas_(n, palabra) { return n + ' ' + palabra + (n === 1 ? '' : 's'); }

/** Lo que avisa repartir_, en una frase. */
function frasePasada_(evento, datos) {
  if (evento === 'descanso') return 'no pasó: hubo una pasada hace menos de ' + SEGUNDOS_ENTRE_REPARTOS + ' s';
  if (evento === 'ocupada') return 'no encontró la llave: otra ejecución está escribiendo';
  return 'encontró la llave · se llevó ' + cuantas_(datos.cartas, 'carta') + ' · escribió ' + cuantas_(datos.escritas, 'fila') +
    ' · borró ' + cuantas_(datos.borradas, 'carta') + ' · ' + datos.msConTurno + ' ms con la llave, ' + datos.ms + ' ms en total';
}

/** Borra filas, cartas e informes de prueba. Con "yo", solo las filas y cartas de esa ejecución. Devuelve las filas borradas. */
function limpiarPruebaRegistro_(yo) {
  const props = PropertiesService.getScriptProperties();
  const todas = props.getProperties();
  Object.keys(todas).forEach(clave => {
    const esCarta = clave.indexOf(PREFIJO_CARTA) === 0 && esDePrueba_(clave.slice(PREFIJO_CARTA.length), yo);
    const esMarcador = clave.indexOf(PREFIJO_ORDEN) === 0 && esDePrueba_(clave.slice(PREFIJO_ORDEN.length), yo);
    const esInforme = !yo && clave.indexOf(PRUEBA_REG_INFORME) === 0;
    if (esCarta || esMarcador || esInforme) props.deleteProperty(clave);
  });
  const turno = LockService.getScriptLock();
  turno.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const borradas = borrarFilasSim_(HOJA.USUARIOS, fila => esDePrueba_(fila.email, yo));
    SpreadsheetApp.flush();
    return borradas;
  } finally {
    turno.releaseLock();
  }
}

function limpiarPruebaRegistro() {
  exigirAdmin_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pasoPruebaRegistro_').forEach(t => ScriptApp.deleteTrigger(t));
  PropertiesService.getScriptProperties().deleteProperty('PRUEBA_REG_SALIDA');
  console.log('Filas de prueba borradas de Usuarios: ' + limpiarPruebaRegistro_());
}

/* ---------- A. Una sola ejecución ---------- */

function probarRegistroSolo() {
  exigirAdmin_();
  console.log('===== Registro por lotes: prueba de una sola ejecución =====');
  const yo = Utilities.getUuid().slice(0, 6);
  let ultimo = null;
  const pasar = () => {
    ultimo = null;
    repartir_(false, (evento, datos) => {
      ultimo = { evento: evento, datos: datos || {} };
      console.log('       cartero: ' + frasePasada_(evento, datos));
    });
    return ultimo;
  };
  const exigir = (resultado, esperado) => {
    if (resultado.evento !== esperado) throw new Error('se esperaba "' + esperado + '" y el cartero dijo: ' + frasePasada_(resultado.evento, resultado.datos));
  };
  let todoBien = true;
  const paso = (titulo, accion) => { if (!paso_(titulo, accion)) todoBien = false; };

  try {
    paso('1. Tres personas dejan su carta y pasa el cartero', () => {
      cacheQuitar_('reparto');
      [1, 2, 3].forEach(n => dejarCartaDePrueba_(correoDePrueba_(yo, n)));
      const r = pasar();
      exigir(r, 'pasada');
      if (filasDePrueba_(yo).length !== 3) throw new Error('hay ' + filasDePrueba_(yo).length + ' filas de prueba en Usuarios y se esperaban 3');
      return 'las 3 filas están en Usuarios · ' + r.datos.msConTurno + ' ms con la llave';
    });
    paso('2. Otra persona entra enseguida: el cartero descansa y su carta queda en el buzón', () => {
      cachePoner_('reparto', 1, SEGUNDOS_ENTRE_REPARTOS);   // por si el paso 1 tardó más que el descanso
      dejarCartaDePrueba_(correoDePrueba_(yo, 4));
      exigir(pasar(), 'descanso');
      if (cartasDePrueba_(yo) !== 1) throw new Error('hay ' + cartasDePrueba_(yo) + ' cartas de prueba en el buzón y se esperaba 1');
      return 'queda 1 carta esperando; todavía no está en Usuarios';
    });
    paso('3. Pasado el descanso, el cartero se lleva la carta que esperaba', () => {
      cacheQuitar_('reparto');   // en la app los 5 segundos pasan solos; aquí se quita la marca para no esperar
      exigir(pasar(), 'pasada');
      if (filasDePrueba_(yo).length !== 4) throw new Error('hay ' + filasDePrueba_(yo).length + ' filas de prueba y se esperaban 4');
      return 'ya son 4 filas en Usuarios';
    });
    paso('4. Una carta de alguien que ya está en la hoja no crea otra fila', () => {
      cacheQuitar_('reparto');
      dejarCartaDePrueba_(correoDePrueba_(yo, 1));
      const r = pasar();
      exigir(r, 'pasada');
      const filas = filasDePrueba_(yo);
      if (filas.length !== 4 || distintos_(filas) !== 4) throw new Error('filas: ' + filas.length + ' · distintas: ' + distintos_(filas) + ' (se esperaban 4 y 4)');
      return 'siguen siendo 4 filas, ninguna repetida';
    });
    paso('5. El buzón quedó vacío', () => {
      if (cartasDePrueba_(yo)) throw new Error('quedaron ' + cartasDePrueba_(yo) + ' cartas de prueba en el buzón');
      return '0 cartas de prueba';
    });
  } finally {
    console.log('Filas de prueba borradas de Usuarios: ' + limpiarPruebaRegistro_(yo));
  }
  console.log('===== RESULTADO: ' + (todoBien ? 'OK' : 'FALLA') + ' =====');
}

/* ---------- B. Varias ejecuciones a la vez ---------- */

/** 1. Borra restos de una prueba anterior y programa las ejecuciones. */
function iniciarPruebaRegistro() {
  exigirAdmin_();
  limpiarPruebaRegistro_();
  const salida = Date.now() + PRUEBA_REG_ESPERA_MS;
  PropertiesService.getScriptProperties().setProperty('PRUEBA_REG_SALIDA', String(salida));
  for (let i = 0; i < PRUEBA_REG_EJECUCIONES; i++) ScriptApp.newTrigger('pasoPruebaRegistro_').timeBased().after(10000).create();
  console.log(PRUEBA_REG_EJECUCIONES + ' ejecuciones programadas: arrancan juntas en ' + PRUEBA_REG_ESPERA_MS / 60000 +
    ' minutos y dejan ' + PRUEBA_REG_CARTAS + ' cartas cada una. Ejecuta revisarPruebaRegistro dentro de unos 6 minutos.');
}

/**
 * Lo que corre cada disparador. Espera la hora común y hace, por cada persona de mentira, lo mismo que registrarme:
 * dejar la carta e intentar repartir. Después confirma sus filas, como el navegador de cada persona.
 * Anota cada paso en su registro y deja un resumen en las propiedades del script para revisarPruebaRegistro.
 */
function pasoPruebaRegistro_() {
  const props = PropertiesService.getScriptProperties();
  const salida = Number(props.getProperty('PRUEBA_REG_SALIDA'));
  if (!salida) return;
  const yo = Utilities.getUuid().slice(0, 6);
  const espera = salida - Date.now();
  if (espera > 0) Utilities.sleep(espera);

  // pasadas: [segundos desde la salida hasta que tomó la llave, cartas que se llevó, filas que escribió, ms con la llave, ms en total]
  const informe = { yo: yo, retraso: Math.max(0, Date.now() - salida), cartas: 0, msCarta: 0, llave: 0, ocupada: 0, descanso: 0, pasadas: [], errores: [] };
  const error_ = (donde, error) => { if (informe.errores.length < 5) informe.errores.push(yo + ' ' + donde + ': ' + String(error.message).slice(0, 150)); };
  const intentar = etiqueta => {
    let frase = '';
    try {
      repartir_(false, (evento, datos) => {
        frase = frasePasada_(evento, datos);
        if (evento !== 'pasada') { informe[evento]++; return; }
        informe.llave++;
        informe.pasadas.push([Math.round((Date.now() - datos.ms - salida) / 100) / 10, datos.cartas, datos.escritas, datos.msConTurno, datos.ms]);
      });
    } catch (error) {
      error_(etiqueta, error);
      frase = 'ERROR: ' + error.message;
    }
    console.log(etiqueta + ' · ' + frase);
  };

  console.log('Ejecución ' + yo + ' · arranca ' + (informe.retraso / 1000).toFixed(1) + ' s después de la hora común');
  const mias = [];
  for (let n = 1; n <= PRUEBA_REG_CARTAS; n++) {
    const email = correoDePrueba_(yo, n);
    const antes = Date.now();
    try {
      dejarCartaDePrueba_(email);
      mias.push(email);
      informe.cartas++;
      informe.msCarta += Date.now() - antes;
    } catch (error) {
      error_('carta ' + n, error);
    }
    intentar('carta ' + n + ' dejada');
    // Las llegadas se reparten en unos 15 segundos, para que la prueba cruce varios descansos del cartero.
    Utilities.sleep(Math.floor(Math.random() * PRUEBA_REG_PAUSA_MS));
  }

  // Como el navegador de cada persona: vuelve a preguntar hasta ver sus filas en la hoja.
  for (let ronda = 1; ronda <= PRUEBA_REG_RONDAS; ronda++) {
    Utilities.sleep((SEGUNDOS_ENTRE_REPARTOS + 1 + Math.random() * 3) * 1000);
    // Se mira el marcador de cada correo y no la hoja: una segunda lectura de Usuarios en la misma ejecución puede no mostrar lo que escribió otra.
    const todas = buzon_().getProperties();
    const faltan = mias.filter(email => !todas[PREFIJO_ORDEN + email]).length;
    if (!faltan) { console.log('confirmación ' + ronda + ' · mis ' + mias.length + ' filas ya están en la hoja'); break; }
    intentar('confirmación ' + ronda + ' · faltan ' + faltan + ' de mis ' + mias.length + ' filas');
  }
  props.setProperty(PRUEBA_REG_INFORME + yo, JSON.stringify(informe));
}

/** 2. Unos 6 minutos después de iniciar: junta los informes, cuenta lo que quedó en la hoja y dice si pasó. */
function revisarPruebaRegistro() {
  exigirAdmin_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pasoPruebaRegistro_').forEach(t => ScriptApp.deleteTrigger(t));
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('PRUEBA_REG_SALIDA');

  const todas = props.getProperties();
  const informes = Object.keys(todas).filter(clave => clave.indexOf(PRUEBA_REG_INFORME) === 0).map(clave => JSON.parse(todas[clave]));
  const suma = campo => informes.reduce((total, informe) => total + (informe[campo] || 0), 0);
  const errores = informes.reduce((lista, informe) => lista.concat(informe.errores || []), []);
  const esperadas = PRUEBA_REG_EJECUCIONES * PRUEBA_REG_CARTAS;

  const sinRecoger = cartasDePrueba_();
  // Lo que en la app haría la siguiente persona que entre o confirme.
  repartir_(true, (evento, datos) => console.log('Pasada final · ' + frasePasada_(evento, datos)));
  const filas = filasDePrueba_();
  const repetidas = filas.length - distintos_(filas);
  const enBuzon = cartasDePrueba_();

  const pasa = informes.length === PRUEBA_REG_EJECUCIONES && suma('cartas') === esperadas &&
    filas.length === esperadas && !repetidas && !enBuzon && !errores.length;

  console.log('===== Registro por lotes, ' + PRUEBA_REG_EJECUCIONES + ' ejecuciones a la vez: ' + (pasa ? 'OK' : 'FALLA') + ' =====');
  console.log('Ejecuciones que terminaron: ' + informes.length + ' de ' + PRUEBA_REG_EJECUCIONES);
  console.log('Cartas dejadas: ' + suma('cartas') + ' de ' + esperadas);
  console.log('Filas en Usuarios: ' + filas.length + ' de ' + esperadas + ' · repetidas: ' + repetidas);
  console.log('Cartas sin recoger cuando terminaron las ejecuciones: ' + sinRecoger + ' (lo normal es 0: cada ejecución confirma sus filas)');
  console.log('Cartas en el buzón después de la pasada final: ' + enBuzon);
  console.log('Errores: ' + (errores.length ? errores.join(' | ') : 'ninguno'));

  console.log('--- Bitácora ---');
  console.log('Encontró la llave: ' + suma('llave') + ' veces · llave ocupada: ' + suma('ocupada') + ' · en descanso: ' + suma('descanso'));
  console.log('Dejar una carta tardó en promedio ' + (suma('cartas') ? Math.round(suma('msCarta') / suma('cartas')) : 0) + ' ms');
  const pasadas = [];
  informes.forEach(informe => (informe.pasadas || []).forEach(p => pasadas.push({ yo: informe.yo, t: p[0], cartas: p[1], escritas: p[2], ms: p[3], total: p[4] || p[3] })));
  pasadas.sort((a, b) => a.t - b.t);
  const conFilas = pasadas.filter(p => p.escritas);
  if (conFilas.length) {
    const numeros = campo => conFilas.map(p => p[campo]);
    const resumen = lista => 'mín ' + Math.min.apply(null, lista) + ' · promedio ' + Math.round(lista.reduce((a, b) => a + b, 0) / lista.length) + ' · máx ' + Math.max.apply(null, lista);
    console.log('Pasadas que escribieron filas: ' + conFilas.length + ' (una por persona habrían sido ' + esperadas + ')');
    console.log('Filas por pasada: ' + resumen(numeros('escritas')));
    console.log('Milisegundos con la llave por pasada: ' + resumen(numeros('ms')));
  }
  console.log('Cartas ya entregadas que otra pasada volvió a leer: ' + pasadas.reduce((total, p) => total + p.cartas - p.escritas, 0));
  console.log('Pasadas, por la hora en que tomaron la llave:');
  pasadas.forEach(p => console.log('+' + p.t.toFixed(1) + ' s · ' + p.yo + ' · se llevó ' + cuantas_(p.cartas, 'carta') + ' (' + (p.cartas - p.escritas) + ' ya entregadas), escribió ' +
    cuantas_(p.escritas, 'fila') + ' · ' + p.ms + ' ms con la llave, ' + p.total + ' ms en total'));
  informes.forEach(informe => console.log('Ejecución ' + informe.yo + ' · arrancó ' + (informe.retraso / 1000).toFixed(1) + ' s tarde · cartas ' + informe.cartas +
    ' · llave ' + informe.llave + ' · ocupada ' + informe.ocupada + ' · descanso ' + informe.descanso));

  if (pasa) console.log('Filas de prueba borradas de Usuarios: ' + limpiarPruebaRegistro_());
  else console.log('Las filas, las cartas y los informes de prueba se conservan para revisarlos. Al terminar, ejecuta limpiarPruebaRegistro.');
}
