/**
 * Prueba de líderes al mismo tiempo: un líder ficticio por stand con código (18 en la base actual) hace lo mismo
 * que hace un líder en la app, a la misma hora y en olas:
 *  1. abre o actualiza la pantalla "Código" (obtenerCodigos), y
 *  2. toca "Generar" (generarCodigo). La app solo deja una generación a la vez por líder.
 * Cada llamada incluye la comprobación de permisos que hace la app (exigirVista_). La primera ola es la ráfaga
 * real (18 a la vez, sin código previo); las siguientes son cambios de código a la vez, el peor caso.
 * Después de cada generación, fuera de la medición, comprueba lo que vería la app: el código nuevo vale, el
 * anterior ya no, la pantalla muestra el nuevo. Al final, ya vencidos los códigos, que ninguno salga como activo.
 *
 * Ejecutar a mano desde el editor, en este orden:
 *  1. iniciarPruebaLideres()  -> prepara la hoja y programa un disparador por líder. Todos esperan 3 minutos y empiezan a la vez.
 *  2. revisarPruebaLideres()  -> cuando terminen los disparadores (se puede correr varias veces): resume tiempos y revisa las reglas.
 *  3. limpiarPruebaLideres()  -> vacía los códigos de la prueba (cada stand conserva su fila), los disparadores y la hoja de resultados.
 *
 * Los líderes no están en Staff: cada disparador arma la sesión en memoria, así que no se escribe nada en
 * Staff ni en Permisos. La comprobación de permisos se mide con la cuenta que ejecuta la prueba (tiene que ser ADMIN).
 * Sus correos usan SIM_DOMINIO, y por eso limpiarPruebaLideres() los reconoce.
 * Como generan códigos reales para esos stands, corre la prueba en una copia del libro.
 * Apps Script permite 20 disparadores por usuario: mientras corre, no debe haber otros (por ejemplo, una simulación).
 */

const PRUEBA_LIDERES_N = 18;               // un líder por stand con código; cámbialo si la base tiene más stands
const PRUEBA_LIDERES_RONDAS = 3;           // olas: la primera genera, las otras dos cambian el código a la vez
const PRUEBA_LIDERES_ESPERA_MS = 180000;   // la primera ola arranca 3 minutos después de iniciar
const PRUEBA_LIDERES_PAUSA_MS = 45000;     // entre una ola y la siguiente (un disparador no puede pasar de 6 minutos)
const PRUEBA_LIDERES_HOJA = 'PruebaLideres';
const PRUEBA_LIDERES_ENCABEZADOS = ['lider', 'stand_id', 'ronda', 'codigo', 'ms', 'pantalla', 'sesion', 'leer', 'escribir', 'confirmar', 'cache',
  'nuevo_valido', 'anterior_invalido', 'pantalla_ok', 'resultado'];
const PRUEBA_LIDERES_CLAVE_TURNOS = 'PRUEBA_LIDERES_TURNOS';
const PRUEBA_LIDERES_CLAVE_SALIDA = 'PRUEBA_LIDERES_SALIDA';

/** 1. Elige los stands, arma el turno de cada líder y programa los disparadores. */
function iniciarPruebaLideres() {
  exigirAdminFresco_();
  const propiedades = PropertiesService.getScriptProperties();
  if (propiedades.getProperty(PRUEBA_LIDERES_CLAVE_TURNOS)) {
    throw new Error('La prueba ya está preparada. Ejecuta limpiarPruebaLideres() antes de volver a iniciarla.');
  }
  const catalogo = catalogo_();
  const stands = catalogo.stands.filter(s => s.requiereCodigo).slice(0, PRUEBA_LIDERES_N);
  if (stands.length < PRUEBA_LIDERES_N) {
    throw new Error('Hacen falta ' + PRUEBA_LIDERES_N + ' stands activos con código y hay ' + stands.length + '.');
  }

  // No se reemplazan códigos reales: si alguno de estos stands tiene un código vigente que no es de la prueba, se para.
  const ahora = Date.now();
  const ids = stands.map(s => s.id);
  const reales = leerHoja_(HOJA.CODIGOS).filter(c =>
    estaVigente_(c, ahora) && ids.indexOf(id_(c.stand_id)) >= 0 && !generadoPorSimulacion_(c));
  if (reales.length) {
    throw new Error('Hay códigos activos reales en estos stands (' + reales.map(c => id_(c.stand_id)).join(', ') + '). Corre la prueba en una copia del libro.');
  }

  const turnos = stands.map((s, i) => {
    const turno = { email: 'lider-' + String(i + 1).padStart(2, '0') + SIM_DOMINIO, standId: s.id, pabellonId: s.pabellonId };
    if (!standsALiderar_(sesionDeLiderPrueba_(turno), catalogo).some(x => x.id === s.id)) {
      throw new Error('El stand ' + s.id + ' no sale en el mapa; no se le puede asignar un líder.');
    }
    return turno;
  });

  const libro = libro_();
  const vieja = libro.getSheetByName(PRUEBA_LIDERES_HOJA);
  if (vieja) libro.deleteSheet(vieja);
  libro.insertSheet(PRUEBA_LIDERES_HOJA).appendRow(PRUEBA_LIDERES_ENCABEZADOS);

  propiedades.setProperty(PRUEBA_LIDERES_CLAVE_TURNOS, JSON.stringify(turnos));
  propiedades.setProperty(PRUEBA_LIDERES_CLAVE_SALIDA, String(Date.now() + PRUEBA_LIDERES_ESPERA_MS));
  borrarDisparadoresPruebaLideres_();
  turnos.forEach(() => ScriptApp.newTrigger('pasoPruebaLideres_').timeBased().after(10000).create());
  console.log(turnos.length + ' líderes preparados: ' + ids.join(', ') + '. La primera ola es en ' +
    Math.round(PRUEBA_LIDERES_ESPERA_MS / 60000) + ' minutos y hay ' + PRUEBA_LIDERES_RONDAS + ' olas. Ejecuta revisarPruebaLideres() unos 6 minutos después.');
}

/** Lo que corre cada disparador: toma un líder de la lista y, ola tras ola, hace lo que hace un líder en la app. */
function pasoPruebaLideres_() {
  const turno = tomarTurnoPruebaLideres_();
  if (!turno) return;
  const salida = Number(PropertiesService.getScriptProperties().getProperty(PRUEBA_LIDERES_CLAVE_SALIDA));
  const sesion = sesionDeLiderPrueba_(turno);
  const filas = [];
  let anterior = '';
  for (let ronda = 1; ronda <= PRUEBA_LIDERES_RONDAS; ronda++) {
    // Todos los líderes empiezan cada ola a la misma hora.
    const espera = salida + (ronda - 1) * PRUEBA_LIDERES_PAUSA_MS - Date.now();
    if (espera > 0) Utilities.sleep(espera);

    const fila = { lider: turno.email, stand_id: turno.standId, ronda: ronda, resultado: 'OK' };
    try {
      // 1. Abre o actualiza la pantalla "Código".
      let inicio = Date.now();
      permisoDePrueba_();
      obtenerCodigosDe_(sesion);
      fila.pantalla = Date.now() - inicio;

      // 2. Toca "Generar".
      ULTIMA_MEDIDA_CODIGO_ = null;
      inicio = Date.now();
      fila.sesion = permisoDePrueba_();
      fila.codigo = generarCodigoDe_(sesion, turno.standId).codigo;
      fila.ms = Date.now() - inicio;
      Object.assign(fila, ULTIMA_MEDIDA_CODIGO_);

      // 3. Lo que vería la app. Va fuera de la medición, pero suma carga como la de los asistentes al ingresar el código.
      const ahora = Date.now();
      fila.nuevo_valido = codigoValido_(turno.standId, fila.codigo, ahora) ? 'SI' : 'NO';
      fila.anterior_invalido = anterior ? (codigoValido_(turno.standId, anterior, ahora) ? 'NO' : 'SI') : '';
      const mostrado = obtenerCodigosDe_(sesion).stands.find(s => s.id === turno.standId);
      fila.pantalla_ok = mostrado && mostrado.activo && mostrado.activo.codigo === fila.codigo ? 'SI' : 'NO';
      anterior = fila.codigo;
    } catch (error) {
      fila.resultado = error.message;
    }
    filas.push(fila);
  }

  // Escribir el registro también necesita turno: si no, las filas de dos líderes pueden caer en la misma fila.
  // Se escribe todo en una sola llamada: con una llamada por fila, el último de los 18 líderes podía agotar la espera y perder sus filas.
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(120000);
  try {
    agregarFilas_(PRUEBA_LIDERES_HOJA, filas);
    SpreadsheetApp.flush();
  } finally {
    bloqueo.releaseLock();
  }
}

/** Saca el siguiente líder de la lista. Con turno, para que dos disparadores no tomen el mismo. */
function tomarTurnoPruebaLideres_() {
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(60000);
  try {
    const propiedades = PropertiesService.getScriptProperties();
    const guardados = propiedades.getProperty(PRUEBA_LIDERES_CLAVE_TURNOS);
    if (!guardados) return null;
    const turnos = JSON.parse(guardados);
    const turno = turnos.shift() || null;
    propiedades.setProperty(PRUEBA_LIDERES_CLAVE_TURNOS, JSON.stringify(turnos));
    return turno;
  } finally {
    bloqueo.releaseLock();
  }
}

/** 2. Unos 6 minutos después de iniciar: resume el registro y revisa las reglas con la hoja Codigos. */
function revisarPruebaLideres() {
  exigirAdminFresco_();
  borrarDisparadoresPruebaLideres_();
  if (!libro_().getSheetByName(PRUEBA_LIDERES_HOJA)) throw new Error('No hay prueba de líderes. Ejecuta iniciarPruebaLideres().');

  const filas = leerHoja_(PRUEBA_LIDERES_HOJA);
  const esperadas = PRUEBA_LIDERES_N * PRUEBA_LIDERES_RONDAS;
  console.log('Filas: ' + filas.length + ' de ' + esperadas + (filas.length < esperadas ? ' (aún no terminan todos: vuelve a revisar)' : ''));
  const fallas = filas.filter(f => texto_(f.resultado) !== 'OK');
  console.log('Con error: ' + (fallas.length ? fallas.map(f => f.lider + ' ronda ' + f.ronda + ': ' + f.resultado).join(' | ') : 'ninguno'));
  // Lideres que sí dejaron su registro: si falta alguno, su disparador falló (mirar Ejecuciones).
  const lideres = [...new Set(filas.map(f => texto_(f.lider)))];
  console.log('Líderes con registro: ' + lideres.length + ' de ' + PRUEBA_LIDERES_N);
  const resumen = (nombre, lista) => {
    if (!lista.length) return;
    const orden = lista.slice().sort((a, b) => a - b);
    const promedio = Math.round(lista.reduce((a, b) => a + b, 0) / lista.length);
    console.log(nombre + ': mínimo ' + orden[0] + ' · mediana ' + orden[Math.floor(orden.length / 2)] + ' · p90 ' +
      orden[Math.min(orden.length - 1, Math.floor(orden.length * 0.9))] + ' · máximo ' + orden[orden.length - 1] + ' · promedio ' + promedio);
  };
  // Ola 1: la ráfaga real (18 a la vez, sin código previo). Olas 2 y 3: los 18 cambian el código a la vez.
  for (let ronda = 1; ronda <= PRUEBA_LIDERES_RONDAS; ronda++) {
    const deLaOla = filas.filter(f => Number(f.ronda) === ronda && f.ms !== '');
    resumen('Ola ' + ronda + ' · tocar "Generar" (ms)', deLaOla.map(f => Number(f.ms)));
    resumen('Ola ' + ronda + ' · abrir la pantalla (ms)', deLaOla.map(f => Number(f.pantalla) || 0));
  }
  ['sesion', 'leer', 'escribir', 'confirmar', 'cache'].forEach(fase =>
    resumen('  dentro de "Generar", fase ' + fase, filas.filter(f => f[fase] !== '' && Number(f[fase]) >= 0).map(f => Number(f[fase]))));
  console.log('Lo que espera el líder = ms de "Generar" + unos 1,6 s de animación de la app + la red de su celular.');
  const sinPermiso = filas.filter(f => f.sesion !== '' && Number(f.sesion) < 0).length;
  if (sinPermiso) console.log('AVISO: la cuenta que ejecuta no tiene la vista GENERAR_CODIGO; en ' + sinPermiso + ' filas la comprobación de permisos no se midió.');

  // Lo que vería la app después de cada generación.
  // Una generación que falló no llegó a comprobarse: también cuenta como incumplida. El código anterior solo existe desde la ola 2.
  const noCumplen = campo => filas.filter(f => (campo !== 'anterior_invalido' || Number(f.ronda) > 1) && f[campo] !== 'SI').map(f => f.lider + ' ola ' + f.ronda);
  const fallaNuevo = noCumplen('nuevo_valido'), fallaAnterior = noCumplen('anterior_invalido'), fallaPantalla = noCumplen('pantalla_ok');
  console.log('El código nuevo vale: ' + (fallaNuevo.length ? 'FALLA en ' + fallaNuevo.join(', ') : 'sí, en todas'));
  console.log('El código anterior deja de valer: ' + (fallaAnterior.length ? 'FALLA en ' + fallaAnterior.join(', ') : 'sí, en todas'));
  console.log('La pantalla muestra el código nuevo: ' + (fallaPantalla.length ? 'FALLA en ' + fallaPantalla.join(', ') : 'sí, en todas'));

  // Lo que quedó en Codigos y en la caché, comparado con lo que devolvió cada generación.
  const codigos = leerHoja_(HOJA.CODIGOS).filter(generadoPorSimulacion_);
  const ahora = Date.now();
  const standsPrueba = [...new Set(filas.map(f => id_(f.stand_id)))];
  const problemas = [];
  const activos = [];
  let porTiempo = 0;
  standsPrueba.forEach(standId => {
    const delStand = codigos.filter(c => id_(c.stand_id) === standId);
    // ACTIVO es el estado en la hoja. Un código vencido por tiempo sigue ACTIVO hasta que se reemplace.
    const marcados = delStand.filter(c => texto_(c.estado).toUpperCase() === 'ACTIVO');
    const ok = filas.filter(f => id_(f.stand_id) === standId && f.resultado === 'OK');
    const ultima = ok.length ? ok.reduce((a, b) => (Number(b.ronda) > Number(a.ronda) ? b : a)) : null;
    const cache = cacheLeer_('codigo:' + standId);

    if (!ok.length) problemas.push(standId + ': ninguna de sus generaciones funcionó');
    if (marcados.length !== (ok.length ? 1 : 0)) problemas.push(standId + ': códigos ACTIVO ' + marcados.length + ', se esperaba ' + (ok.length ? 1 : 0));
    // Cada stand tiene una sola fila en Codigos: cada código nuevo reemplaza al anterior en esa fila.
    if (delStand.length > 1) problemas.push(standId + ': ' + delStand.length + ' filas en Codigos, se esperaba 1');
    if (ultima && texto_(marcados[0] && marcados[0].codigo) !== texto_(ultima.codigo)) problemas.push(standId + ': el ACTIVO no es el de la última ronda');
    // La caché solo se compara mientras el código sigue vigente por tiempo.
    const aunVigente = !!marcados[0] && ms_(marcados[0].expira_en) > ahora;
    if (aunVigente) porTiempo++;
    if (ultima && aunVigente && (!cache || texto_(cache.codigo) !== texto_(ultima.codigo))) problemas.push(standId + ': la caché no tiene el código vigente');
    if (marcados[0]) activos.push(texto_(marcados[0].codigo));

    // Lo que mostraría la app ahora: el código mientras sigue vigente y nada una vez vencido (la app lo pinta como "venció").
    const infoStand = catalogo_().stands.find(s => s.id === standId);
    const delLider = filas.find(f => id_(f.stand_id) === standId);
    if (infoStand && delLider && marcados[0]) {
      const sesionLider = sesionDeLiderPrueba_({ email: texto_(delLider.lider), standId: standId, pabellonId: infoStand.pabellonId });
      const visto = (obtenerCodigosDe_(sesionLider).stands.find(s => s.id === standId) || {}).activo;
      if (aunVigente && (!visto || visto.codigo !== texto_(marcados[0].codigo))) problemas.push(standId + ': la pantalla no muestra su código vigente');
      if (!aunVigente && visto) problemas.push(standId + ': la pantalla sigue mostrando como activo un código vencido');
    }
  });
  const repetidos = activos.filter((c, i) => activos.indexOf(c) !== i);
  if (repetidos.length) problemas.push('códigos ACTIVO repetidos entre stands: ' + repetidos.join(', '));

  console.log('Stands revisados: ' + standsPrueba.length + ' · códigos ACTIVO distintos: ' + new Set(activos).size +
    ' · todavía vigentes por tiempo: ' + porTiempo);
  console.log('Problemas: ' + (problemas.length ? problemas.join(' | ') : 'ninguno'));
}

/**
 * 3. Vacía los códigos de la prueba (cada stand conserva su fila con el stand_id), borra los disparadores y la hoja
 * de resultados. Los datos reales no se tocan.
 */
function limpiarPruebaLideres() {
  exigirAdminFresco_();
  borrarDisparadoresPruebaLideres_();
  const propiedades = PropertiesService.getScriptProperties();
  propiedades.deleteProperty(PRUEBA_LIDERES_CLAVE_TURNOS);
  propiedades.deleteProperty(PRUEBA_LIDERES_CLAVE_SALIDA);
  const libro = libro_();
  const hoja = libro.getSheetByName(PRUEBA_LIDERES_HOJA);
  if (hoja) libro.deleteSheet(hoja);

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    console.log('Códigos de la prueba vaciados: ' + vaciarCodigosDePrueba_());
  } finally {
    bloqueo.releaseLock();
  }
  limpiarCache_();
}

/** Deja en blanco todo menos el stand_id en las filas de Codigos que generó la prueba. Quien llama tiene el turno global. */
function vaciarCodigosDePrueba_() {
  const leida = leerCodigos_('');
  const generadoPor = leida.encabezados.indexOf('generado_por');
  if (generadoPor < 0) throw new Error('Falta la columna "generado_por" en Codigos.');
  let vaciadas = 0;
  leida.tabla.forEach((fila, i) => {
    if (i === 0 || !texto_(fila[generadoPor]).toLowerCase().endsWith(SIM_DOMINIO)) return;
    leida.tabla[i] = fila.map((valor, c) => (c === leida.col.stand ? valor : ''));
    vaciadas++;
  });
  if (vaciadas) leida.hoja.getRange(1, 1, leida.tabla.length, leida.tabla[0].length).setValues(leida.tabla);
  return vaciadas;
}

/**
 * Diagnóstico de acceso, sin exigir admin y sin escribir nada: qué hoja usa el script, con qué cuenta corre
 * y qué lee la app en Staff. Sirve para saber por qué exigirAdmin_() rechaza una ejecución.
 *
 * No puede pedir admin (es justo lo que diagnostica), pero cualquier participante podría llamarla desde el navegador.
 * Por eso solo corre si el script tiene la propiedad DIAGNOSTICO = 1, que un participante no puede poner: se agrega en
 * Configuración del proyecto > Propiedades del script, se ejecuta esta función y se borra la propiedad al terminar.
 */
function diagnosticarAccesoPrueba() {
  if (PropertiesService.getScriptProperties().getProperty('DIAGNOSTICO') !== '1') {
    throw new Error('Diagnóstico apagado. Agrega la propiedad del script DIAGNOSTICO = 1, ejecútalo y borra la propiedad.');
  }
  const email = texto_(Session.getActiveUser().getEmail()).toLowerCase();
  const propiedad = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  console.log('Cuenta que ejecuta: ' + (email || '(vacía)'));
  console.log('ID de la hoja que usa el script: ' + idDelSheet_() + (propiedad ? ' (viene de la propiedad SPREADSHEET_ID)' : ' (viene de ID_DEL_SHEET)'));
  console.log('Nombre de esa hoja: "' + libro_().getName() + '"');
  const staff = leerStaff_();
  console.log('Staff activo según la app: ' + (staff.map(s => s.email + ' ' + s.rol).join(' | ') || 'ninguno'));
  const propio = staff.find(s => s.email === email);
  console.log('Rol para esta cuenta: ' + (propio ? propio.rol : 'no está en Staff activo'));
}

/* ---------- Ayudas ---------- */

/**
 * Como exigirAdmin_, pero primero recarga el catálogo desde la hoja. exigirAdmin_ decide el rol con la caché del
 * catálogo, que puede tardar hasta segundos_cache_catalogo en notar una fila nueva de Staff.
 */
function exigirAdminFresco_() {
  refrescarCatalogo_();
  return exigirAdmin_();
}

/**
 * La comprobación de permisos que hace la app en cada llamada (exigirVista_), con la cuenta que ejecuta la prueba.
 * Devuelve lo que tardó, o -1 si esa cuenta no tiene la vista (la prueba sigue, pero ese tiempo no se midió).
 */
function permisoDePrueba_() {
  const inicio = Date.now();
  try {
    exigirVista_('GENERAR_CODIGO');
  } catch (error) {
    return -1;
  }
  return Date.now() - inicio;
}

/** La sesión que usaría la app para este líder, armada en memoria. */
function sesionDeLiderPrueba_(turno) {
  return { email: turno.email, rol: 'LIDER', staff: { standId: turno.standId, pabellonId: turno.pabellonId }, vistas: ['GENERAR_CODIGO'], enEspera: false };
}

/** Códigos creados por la prueba (su generador es un correo de simulación). */
function generadoPorSimulacion_(fila) {
  return texto_(fila.generado_por).toLowerCase().endsWith(SIM_DOMINIO);
}

function borrarDisparadoresPruebaLideres_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pasoPruebaLideres_').forEach(t => ScriptApp.deleteTrigger(t));
}
