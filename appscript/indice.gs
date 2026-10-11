/**
 * Índice por persona (Fase 3). Cada cuenta guarda sus propios intentos en UserProperties, así el mapa,
 * empezar un quiz y enviarlo no recorren la hoja Intentos completa. La hoja sigue siendo el registro oficial:
 * el índice se arma desde ella la primera vez de cada época (cada reinicio de datos abre una época nueva).
 *
 * Depende de executeAs USER_ACCESSING: cada persona ejecuta con su cuenta, así que tiene su propio almacén.
 *
 * Forma de cada intento en el índice (clave "i:" + stand_id):
 *   id: intento_id · e: EN_CURSO | COMPLETADO | VENCIDO · i, v: inicio y vencimiento (ms)
 *   q: ids de las preguntas sorteadas · r, a: letras elegidas y aciertos
 *   c, p, t: correctas, puntaje y hora de corrección · s: 1 cuando el resultado ya está en la hoja
 *   f: fila del intento en la hoja Intentos · k: código con el que se abrió
 *
 * Además guarda "orden": la copia del número de orden de la persona, que entrega el registro (registro.gs).
 * Con ese número se calcula su bloque de filas en Intentos (ver "Filas propias", más abajo).
 */

let MIS_PROPIEDADES_ = null;

function misPropiedades_() {
  if (!MIS_PROPIEDADES_) MIS_PROPIEDADES_ = PropertiesService.getUserProperties().getProperties();
  return MIS_PROPIEDADES_;
}

let EPOCA_ = null;

/** Cambia con cada reinicio de datos: lo guardado antes deja de valer. Se lee una vez por petición. */
function epoca_() {
  if (EPOCA_ === null) {
    const ultimo = ultimoReinicio_();
    EPOCA_ = String(ultimo ? ultimo.cuando : 0);
  }
  return EPOCA_;
}

/**
 * Ejecuta la acción con el bloqueo de esta persona y confirma lo escrito antes de soltarlo.
 * Personas distintas no se esperan entre sí.
 */
function conBloqueoPropio_(accion) {
  const bloqueo = LockService.getUserLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  // Lo leído antes de tener el bloqueo ya no vale: otra petición de la misma persona pudo escribir mientras se esperaba.
  MIS_PROPIEDADES_ = null;
  try {
    return accion();
  } finally {
    try { SpreadsheetApp.flush(); } finally { bloqueo.releaseLock(); }
  }
}

/** standId -> intento. Si la época cambió, o el admin pidió releer, se arma de nuevo desde la hoja. */
function miIndice_(sesion) {
  // Si la app corriera con la cuenta de quien despliega, todas las personas compartirían un solo índice.
  if (texto_(Session.getEffectiveUser().getEmail()).toLowerCase() !== sesion.email) {
    throw new Error('La app debe ejecutarse con la cuenta de quien accede.');
  }
  let propiedades = misPropiedades_();
  const releer = cacheLeer_('releer:' + sesion.email);
  if (releer || propiedades.epoca !== epoca_()) {
    propiedades = reconstruirIndice_(sesion);
    if (releer) cacheQuitar_('releer:' + sesion.email);
  }
  const indice = {};
  Object.keys(propiedades).forEach(k => { if (k.indexOf('i:') === 0) indice[k.slice(2)] = JSON.parse(propiedades[k]); });
  return indice;
}

function guardarEnIndice_(standId, intento) {
  const texto = JSON.stringify(intento);
  PropertiesService.getUserProperties().setProperty('i:' + standId, texto);
  misPropiedades_()['i:' + standId] = texto;
}

/**
 * Arma el índice desde las hojas: los intentos salen de Intentos y el número de orden, de Usuarios.
 * Conserva lo corregido que todavía no llegó a la hoja: esa corrección es más nueva que la fila,
 * y perderla obligaría a la persona a volver a responder.
 */
function reconstruirIndice_(sesion) {
  const viejas = misPropiedades_();
  const nuevas = { epoca: epoca_() };
  filasDeEmail_(sesion.email).forEach(fila => {
    const clave = 'i:' + id_(fila.stand_id);
    if (!nuevas[clave]) nuevas[clave] = JSON.stringify(intentoDesdeFila_(fila));
  });
  if (viejas.epoca === nuevas.epoca) {
    Object.keys(viejas).forEach(k => {
      if (k.indexOf('i:') !== 0) return;
      const intento = JSON.parse(viejas[k]);
      if (intento.e === 'COMPLETADO' && !intento.s) nuevas[k] = viejas[k];
    });
  }
  // El número de orden se vuelve a pedir a su marcador (registro.gs), que es el dato que manda: no se arrastra el guardado.
  const orden = ordenDe_(sesion.email);
  if (orden) nuevas.orden = String(orden);
  PropertiesService.getUserProperties().setProperties(nuevas, true);
  MIS_PROPIEDADES_ = nuevas;
  return nuevas;
}

/**
 * Filas de Intentos de una persona. Busca primero en la columna de correo y solo lee las filas encontradas:
 * no hace falta descargar la hoja completa, que con 20.000 filas tarda segundos.
 */
function filasDeEmail_(email) {
  const hoja = hoja_(HOJA.INTENTOS);
  const ultima = hoja.getLastRow();
  if (ultima < 2) return [];
  const encabezados = encabezados_(HOJA.INTENTOS);
  const columnaEmail = encabezados.indexOf('email') + 1;
  const hallazgos = hoja.getRange(2, columnaEmail, ultima - 1, 1).createTextFinder(email).matchEntireCell(true).findAll();
  return hallazgos.map(celda => {
    const valores = hoja.getRange(celda.getRow(), 1, 1, encabezados.length).getValues()[0];
    const fila = { _fila: celda.getRow() };
    encabezados.forEach((e, c) => { if (e) fila[e] = valores[c]; });
    return fila;
  }).filter(fila => texto_(fila.email).toLowerCase() === email);
}

function intentoDesdeFila_(fila) {
  const leer = texto => { try { return JSON.parse(texto || '[]'); } catch (error) { return []; } };
  const detalle = leer(fila.respuestas_json);
  return {
    id: id_(fila.intento_id), e: texto_(fila.estado).toUpperCase(),
    i: ms_(fila.iniciado_en), v: ms_(fila.vence_en), q: leer(fila.preguntas_json),
    r: detalle.map(d => d.r), a: detalle.map(d => !!d.ok),
    c: Number(fila.correctas) || 0, p: Number(fila.puntaje) || 0, t: ms_(fila.completado_en) || 0, s: 1,
    f: fila._fila, k: texto_(fila.codigo).toUpperCase(),
  };
}

/** Para el admin: tras corregir a mano los intentos de alguien en la hoja, hace que su celular los vuelva a leer. */
function releerIndiceDe(email) {
  exigirAdmin_();
  cachePoner_('releer:' + texto_(email).toLowerCase(), 1, 21600);
}

/* ---------- Filas propias ---------- */

/*
 * Cada persona tiene en Intentos un bloque de FILAS_POR_PERSONA filas que es solo suyo. Su número de orden
 * (lo da el registro por lotes de registro.gs y se ve en la columna "orden" de Usuarios) dice cuál: la persona 1 tiene desde
 * la fila 2, la persona 2 desde la 27, y así. Como nadie más escribe en ese bloque, empezar y enviar un quiz no
 * necesitan el turno global: no se agrega nada al final de la hoja.
 */

/** Primera fila del bloque de una persona. La fila 1 es la cabecera. */
function primeraFilaDe_(orden) {
  return 2 + (orden - 1) * FILAS_POR_PERSONA;
}

/** Número de orden al que pertenece una fila de Intentos. */
function ordenDeFila_(fila) {
  return Math.floor((fila - 2) / FILAS_POR_PERSONA) + 1;
}

/** Guarda en el índice de la persona la copia de su número de orden. */
function guardarOrden_(orden) {
  PropertiesService.getUserProperties().setProperty('orden', String(orden));
  if (MIS_PROPIEDADES_) MIS_PROPIEDADES_.orden = String(orden);
}

/**
 * Número de orden de quien llama. Sale de su índice; si no está ahí, de su marcador en el registro, y si la
 * persona todavía no tiene número se pide una pasada urgente. Sin número no se escribe nada en Intentos.
 */
function miOrden_(sesion) {
  const guardado = Number(misPropiedades_().orden) || 0;
  if (guardado) return guardado;
  const orden = ordenUrgente_(sesion.email, () => dejarCarta_(sesion));
  if (!orden) throw new Error('Todavía no pudimos reservar tus filas. Inténtalo de nuevo en unos segundos.');
  guardarOrden_(orden);
  return orden;
}

/** Primera fila del bloque que no está entre las usadas, o 0 si no queda ninguna. */
function filaLibreSegun_(orden, usadas) {
  const primera = primeraFilaDe_(orden);
  for (let k = 0; k < FILAS_POR_PERSONA; k++) if (usadas.indexOf(primera + k) < 0) return primera + k;
  return 0;
}

/**
 * Fila donde la persona puede escribir un intento nuevo: la primera de su bloque que está vacía en la hoja y que
 * tampoco tiene reservada en su índice. Antes comprueba que todo lo escrito en el bloque sea suyo: si aparece el
 * correo de otra persona, alguien movió filas a mano o hay dos personas con el mismo número, y no se escribe.
 */
function filaLibreDe_(orden, email, encabezados, reservadas) {
  const columnaEmail = encabezados.indexOf('email');
  const primera = primeraFilaDe_(orden);
  const bloque = hoja_(HOJA.INTENTOS).getRange(primera, 1, FILAS_POR_PERSONA, columnaEmail + 1).getValues();
  const ocupadas = (reservadas || []).slice();
  bloque.forEach((valores, k) => {
    if (valores[0] === '') return;
    if (texto_(valores[columnaEmail]).toLowerCase() !== email) {
      throw new Error('La fila ' + (primera + k) + ' de Intentos es del bloque ' + orden + ' y tiene el correo de otra persona. Avisa a un administrador.');
    }
    ocupadas.push(primera + k);
  });
  const libre = filaLibreSegun_(orden, ocupadas);
  if (!libre) throw new Error('Ya usaste las ' + FILAS_POR_PERSONA + ' filas reservadas para ti. Avisa a un administrador.');
  return libre;
}
