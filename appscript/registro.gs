/**
 * Registro de personas en Usuarios, por lotes, y número de orden de cada una.
 *
 * Abrir la app no escribe en la hoja. El navegador llama a registrarme() en segundo plano: la persona deja una
 * carta en las propiedades del script (una clave por correo, sin bloqueo) y, si consigue el turno global sin
 * esperar, escribe en una sola operación todas las cartas pendientes. Quien no lo consigue no espera: su carta
 * la escribe otra pasada, y su navegador vuelve a preguntar hasta tener su número.
 *
 * La misma pasada le da a cada persona nueva su número de orden. Con ese número se calcula su bloque de filas
 * en Intentos (indice.gs). Los números se entregan con el turno global, de uno en uno, y no se reutilizan.
 *
 * Quién tiene qué número se anota en las propiedades del script, con un marcador por correo ("ord:" + correo).
 * Ese marcador es el dato que manda; la columna "orden" de Usuarios es su copia a la vista. No se decide leyendo
 * la hoja porque, dentro de una misma ejecución, una segunda lectura de Usuarios puede no mostrar lo que otra
 * ejecución acaba de escribir: en la prueba de carga del 2026-10-10 eso dejó a la misma persona en varias filas.
 * Las propiedades sí devuelven siempre lo último escrito.
 */

const PREFIJO_CARTA = 'reg:';
const PREFIJO_ORDEN = 'ord:';
const CLAVE_ULTIMO_ORDEN = 'ULTIMO_ORDEN';
const CLAVE_FILAS = 'FILAS:';   // más el nombre de la hoja y el ID del Sheet
// Marcador con esta marca al final: el número ya está entregado, pero la fila de Usuarios todavía no se confirmó.
const ORDEN_SIN_FILA = '?';
// Como mucho una pasada cada tantos segundos: el turno global también lo usan los códigos y el panel admin.
const SEGUNDOS_ENTRE_REPARTOS = 5;
const ESPERA_TURNO_REPARTO_MS = 200;
// Pasada urgente: la pide quien va a empezar un quiz y todavía no tiene número de orden.
const REPARTO_URGENTE = 'urgente';
const ESPERA_TURNO_URGENTE_MS = 1000;
// Cuando a Intentos le faltan filas para un bloque nuevo, se agranda de una vez para estas personas más.
const PERSONAS_DE_HOLGURA = 100;
// Personas para las que prepararFeria deja lista la hoja Intentos.
const PERSONAS_PREVISTAS = 2500;

/**
 * Se registra solo el usuario: quien no está en Staff. Admin y líder ya están en Staff, así que no reciben número
 * ni fila en Usuarios, tengan o no la vista QUIZ. Independiente de si la feria o la sala de espera están activas.
 */
function debeRegistrarse_(sesion) {
  return sesion.rol === 'USUARIO';
}

/**
 * Nombre de la persona sin leer la hoja Usuarios: el de su caché propia (que sale de la hoja una vez
 * confirmada su fila) o, si no hay, el de Staff, el del directorio de la organización o el deducido del correo.
 */
function nombreDe_(sesion) {
  const cacheMia = CacheService.getUserCache();
  const clave = generacion_() + ':usuario';
  const enCache = cacheMia.get(clave);
  if (enCache) return enCache;
  // El de Staff no se guarda: el catálogo ya está en memoria, y así un cambio ahí se nota al recargar.
  if (sesion.staff && sesion.staff.nombre) return sesion.staff.nombre;
  const nombre = nombreDeDirectorio_(sesion.email) || nombreDesdeEmail_(sesion.email);
  if (nombre) cacheMia.put(clave, nombre, SEGUNDOS_CACHE_USUARIO);
  return nombre;
}

/** ¿Esta persona ya confirmó su registro? Lo recuerda su caché propia, para no volver a preguntar en cada carga. */
function registroConfirmado_() {
  return !!CacheService.getUserCache().get(generacion_() + ':registrado');
}

/**
 * La llama el navegador en segundo plano al abrir la app, y repite hasta recibir listo: true,
 * que significa que la persona ya tiene su número de orden.
 */
function registrarme() {
  const sesion = sesion_();
  if (!debeRegistrarse_(sesion) || registroConfirmado_()) return { listo: true };
  const marcador = buzon_().getProperty(PREFIJO_ORDEN + sesion.email) || '';
  let orden = parseInt(marcador, 10) || 0;
  let conFila = !!orden && marcador.slice(-1) !== ORDEN_SIN_FILA;
  if (!conFila) {
    // Sin número se deja la carta. Con número pero sin fila confirmada, la carta sigue en el buzón y la pasada la vuelve a escribir.
    if (!orden) dejarCarta_(sesion);
    orden = (repartir_() || {})[sesion.email] || orden;
    // La carta solo se borra cuando la fila quedó escrita en Usuarios.
    conFila = !!orden && !buzon_().getProperty(PREFIJO_CARTA + sesion.email);
  }
  if (!orden) return { listo: false };

  // La copia del número va al índice de la persona, que no vence: desde aquí ya puede empezar quizzes.
  guardarOrden_(orden);
  // Sin su fila en Usuarios todavía no está listo: el navegador vuelve a llamar y otra pasada la escribe.
  if (!conFila) return { listo: false };
  // La caché solo recuerda que ya se confirmó, para no preguntar en cada carga.
  const cacheMia = CacheService.getUserCache();
  cacheMia.put(generacion_() + ':registrado', '1', SEGUNDOS_CACHE_USUARIO);
  try {
    // El nombre de la hoja manda: es el que el admin puede corregir a mano. Si su fila todavía no se ve, queda el que tenía.
    const mia = usuariosEnHoja_()[sesion.email];
    if (mia && mia.nombre) cacheMia.put(generacion_() + ':usuario', mia.nombre, SEGUNDOS_CACHE_USUARIO);
  } catch (error) {
    console.warn('No se pudo leer el nombre de ' + sesion.email + ' en Usuarios: ' + error.message);
  }
  return { listo: true };
}

/* ---------- Buzón ---------- */

function buzon_() { return PropertiesService.getScriptProperties(); }

/** Deja la carta de la persona si todavía no hay una. La hora de la carta es la de su primer ingreso. */
function dejarCarta_(sesion) {
  const clave = PREFIJO_CARTA + sesion.email;
  if (buzon_().getProperty(clave)) return;
  buzon_().setProperty(clave, JSON.stringify({ n: nombreDe_(sesion), t: Date.now() }));
}

/** Cartas que hay entre unas propiedades ya leídas, como [{ clave, email, n, t }]. Una carta ilegible no se pierde: se registra con el nombre deducido del correo. */
function cartasDe_(todas) {
  return Object.keys(todas).filter(clave => clave.indexOf(PREFIJO_CARTA) === 0).map(clave => {
    const email = clave.slice(PREFIJO_CARTA.length);
    let carta = {};
    try { carta = JSON.parse(todas[clave]) || {}; } catch (error) { /* se usa lo deducido */ }
    return { clave: clave, email: email, n: texto_(carta.n) || nombreDesdeEmail_(email), t: Number(carta.t) || Date.now() };
  });
}

/** Cartas pendientes en el buzón. */
function leerBuzon_() {
  return cartasDe_(buzon_().getProperties());
}

/** correo -> { nombre, orden, fila } de quienes están en la hoja Usuarios. Lee solo esas columnas. orden es 0 si la celda está vacía. */
function usuariosEnHoja_() {
  const usuarios = {};
  leerHoja_(HOJA.USUARIOS, ['email', 'nombre', 'orden']).forEach(u => {
    const email = texto_(u.email).toLowerCase();
    if (!(email in usuarios)) usuarios[email] = { nombre: texto_(u.nombre), orden: Number(u.orden) || 0, fila: u._fila };
  });
  return usuarios;
}

/** ¿El correo está en lo leído de Usuarios y tiene su número de orden? */
function tieneOrden_(enHoja, email) {
  return !!(enHoja[email] && enHoja[email].orden);
}

/* ---------- Número de orden ---------- */

/** Número de orden de un correo, o 0 si todavía no tiene. Sale de su marcador en las propiedades del script. */
function ordenDe_(email) {
  return parseInt(buzon_().getProperty(PREFIJO_ORDEN + email), 10) || 0;
}

/** Último número de orden entregado. */
function ultimoOrden_() {
  return parseInt(buzon_().getProperty(CLAVE_ULTIMO_ORDEN), 10) || 0;
}

/**
 * Escribir en una fila concreta no agranda la hoja: antes hay que asegurarse de que llega hasta ahí. Hasta dónde
 * llega cada hoja se recuerda en una propiedad, para no preguntárselo en cada pasada.
 * "todas" son las propiedades del script ya leídas y "holgura", las filas de más que se agregan si hay que agrandarla.
 */
function asegurarFilas_(nombre, necesarias, holgura, todas) {
  const clave = CLAVE_FILAS + nombre + ':' + (todas.SPREADSHEET_ID || ID_DEL_SHEET || 'activo');
  if (necesarias <= (parseInt(todas[clave], 10) || 0)) return;
  const hoja = hoja_(nombre);
  let hay = hoja.getMaxRows();
  if (hay < necesarias) {
    hoja.insertRowsAfter(hay, necesarias - hay + holgura);
    hay = hoja.getMaxRows();
  }
  buzon_().setProperty(clave, String(hay));
  todas[clave] = String(hay);
}

/** Intentos debe tener las filas del bloque antes de que alguien reciba ese número. */
function asegurarFilasDeIntentos_(orden, todas) {
  asegurarFilas_(HOJA.INTENTOS, primeraFilaDe_(orden) + FILAS_POR_PERSONA - 1, PERSONAS_DE_HOLGURA * FILAS_POR_PERSONA, todas);
}

/**
 * Escribe en Usuarios a cada persona en la fila de su número (orden + 1). Así volver a escribir a alguien cae en el
 * mismo lugar y no lo repite, y no hace falta preguntar cuál es la última fila. Los números seguidos van de una vez.
 * Como cada quien tiene su fila, dos ejecuciones pueden escribir a la vez sin turno: nunca caen en el mismo lugar.
 * Si la fila que le toca tiene a otra persona (alguien insertó filas a mano), ese grupo no se escribe: esas personas
 * conservan su número y pueden jugar, y su fila queda pendiente hasta que se arregle la hoja (prepararFeria).
 * Devuelve las personas que sí quedaron escritas.
 */
function escribirUsuarios_(personas, todas) {
  if (!personas.length) return [];
  const hoja = hoja_(HOJA.USUARIOS);
  const encabezados = encabezados_(HOJA.USUARIOS);
  if (encabezados.indexOf('orden') < 0) throw new Error('Falta la columna "orden" en la hoja Usuarios. Agrégala y vuelve a intentarlo.');
  const columnaEmail = encabezados.indexOf('email');
  const ordenadas = personas.slice().sort((a, b) => a.orden - b.orden);
  asegurarFilas_(HOJA.USUARIOS, ordenadas[ordenadas.length - 1].orden + 1, PERSONAS_DE_HOLGURA, todas);
  const escritas = [];
  for (let i = 0; i < ordenadas.length;) {
    let j = i;
    while (j + 1 < ordenadas.length && ordenadas[j + 1].orden === ordenadas[j].orden + 1) j++;
    const grupo = ordenadas.slice(i, j + 1);
    const rango = hoja.getRange(grupo[0].orden + 1, 1, grupo.length, encabezados.length);
    const ocupada = rango.getValues().some((fila, k) => fila[columnaEmail] !== '' && texto_(fila[columnaEmail]).toLowerCase() !== grupo[k].email);
    if (ocupada) {
      console.warn('La fila ' + (grupo[0].orden + 1) + ' de Usuarios tiene a otra persona: ' + grupo.length + ' filas quedan sin escribir. Con Intentos vacía, ejecuta prepararFeria.');
    } else {
      rango.setValues(grupo.map(persona => encabezados.map(e => (persona[e] === undefined ? '' : persona[e]))));
      grupo.forEach(persona => escritas.push(persona));
    }
    i = j + 1;
  }
  return escritas;
}

/**
 * Da número de orden a las personas que no lo tienen. "personas" es una lista de { email, nombre, registrado_en } y
 * "todas", las propiedades del script leídas con el turno global ya tomado: de eso depende que dos personas nunca
 * reciban el mismo número. Solo toca las propiedades del script, no el Sheet, así que el turno dura muy poco y no
 * depende de lo que tarde la hoja. Desde que vuelve, cada persona ya tiene su número y nadie más puede recibirlo.
 * Devuelve { numeros: correo -> número, porEscribir: personas cuya fila de Usuarios falta escribir o confirmar }.
 */
function entregarNumeros_(personas, todas) {
  const numeros = {};
  const porNumerar = {};
  const porEscribir = [];
  let ultimo = parseInt(todas[CLAVE_ULTIMO_ORDEN], 10) || 0;
  personas.forEach(persona => {
    if (numeros[persona.email]) return;
    const marcador = todas[PREFIJO_ORDEN + persona.email] || '';
    let orden = parseInt(marcador, 10) || 0;
    if (!orden) {
      orden = ++ultimo;
      porNumerar[PREFIJO_ORDEN + persona.email] = orden + ORDEN_SIN_FILA;
    }
    numeros[persona.email] = orden;
    if (!marcador || marcador.slice(-1) === ORDEN_SIN_FILA) porEscribir.push(Object.assign({}, persona, { orden: orden }));
  });
  if (!Object.keys(porNumerar).length) return { numeros: numeros, porEscribir: porEscribir };

  // La primera vez que se entrega un número se mira la hoja, y solo esa vez: tiene que tener la columna "orden", y no
  // puede traer números ya escritos (otra versión, u otro Sheet), porque empezar desde 1 los repetiría.
  if (todas[CLAVE_ULTIMO_ORDEN] === undefined) {
    if (encabezados_(HOJA.USUARIOS).indexOf('orden') < 0) throw new Error('Falta la columna "orden" en la hoja Usuarios. Agrégala y vuelve a intentarlo.');
    const enHoja = usuariosEnHoja_();
    if (Object.keys(enHoja).some(email => enHoja[email].orden)) {
      throw new Error('Usuarios ya tiene números de orden que el registro no conoce. Con Intentos vacía, ejecuta prepararFeria; si ya hay intentos, reconstruirRegistro.');
    }
  }
  // Antes de entregar un número, Intentos tiene que tener las filas de ese bloque.
  asegurarFilasDeIntentos_(ultimo, todas);
  porNumerar[CLAVE_ULTIMO_ORDEN] = String(ultimo);
  buzon_().setProperties(porNumerar, false);
  return { numeros: numeros, porEscribir: porEscribir };
}

/**
 * Escribe en Usuarios las filas de quienes ya tienen número y confirma sus marcadores. No necesita el turno global:
 * cada persona va en su propia fila. Si la hoja falla, los números siguen entregados y las cartas siguen en el buzón,
 * así que la siguiente pasada vuelve a escribir esas filas, en el mismo lugar. Devuelve las personas confirmadas.
 */
function escribirYConfirmar_(porEscribir, todas) {
  if (!porEscribir.length) return [];
  const escritas = escribirUsuarios_(porEscribir, todas);
  SpreadsheetApp.flush();
  if (!escritas.length) return [];
  const confirmados = {};
  escritas.forEach(persona => { confirmados[PREFIJO_ORDEN + persona.email] = String(persona.orden); });
  buzon_().setProperties(confirmados, false);
  return escritas;
}

/** Las dos cosas seguidas, para quien ya tiene el turno global y no atiende a participantes: simulaciones y completarUsuarios. */
function numerarYEscribir_(personas, todas) {
  const entrega = entregarNumeros_(personas, todas);
  escribirYConfirmar_(entrega.porEscribir, todas);
  return entrega.numeros;
}

/** Borra los marcadores de orden de los correos que cumplen el criterio. Para las limpiezas de pruebas y simulaciones. */
function borrarMarcadores_(esSuyo) {
  const props = buzon_();
  const todas = props.getProperties();
  let borrados = 0;
  Object.keys(todas).forEach(clave => {
    if (clave.indexOf(PREFIJO_ORDEN) !== 0 || !esSuyo(clave.slice(PREFIJO_ORDEN.length))) return;
    props.deleteProperty(clave);
    borrados++;
  });
  return borrados;
}

/**
 * Número de orden para quien lo necesita ya (va a empezar un quiz). Si todavía no tiene, deja su carta (con
 * "dejarCarta") y pide una pasada urgente del registro. Quien encuentra el turno ocupado no hace fila: otra pasada
 * está entregando números, probablemente también el suyo, así que vuelve a mirar su marcador.
 * Devuelve 0 si en SEGUNDOS_BLOQUEO no lo consigue.
 */
function ordenUrgente_(email, dejarCarta, anotar) {
  let orden = ordenDe_(email);
  if (orden) return orden;
  dejarCarta();
  const limite = Date.now() + SEGUNDOS_BLOQUEO;
  while (!orden && Date.now() < limite) {
    const numeros = repartir_(REPARTO_URGENTE, anotar);
    orden = (numeros && numeros[email]) || ordenDe_(email);
  }
  return orden;
}

/**
 * El cartero: da número de orden y escribe en Usuarios, de una vez, todas las cartas que todavía no lo tienen.
 * El turno global solo cubre la entrega de números, que no toca el Sheet. Las filas de Usuarios se escriben después,
 * ya sin turno: si la hoja tarda o falla, nadie que espere su número se queda esperándola.
 * Devuelve correo -> número de orden de las cartas que encontró, o null si no le tocó pasar: hubo una pasada
 * hace poco o el turno está ocupado.
 * "forzar" decide cuánto insiste: sin él respeta el descanso y casi no espera el turno; con true (panel admin y pruebas)
 * espera el turno lo que haga falta; con REPARTO_URGENTE (quien empieza un quiz sin número) no respeta el descanso
 * pero espera el turno solo un segundo.
 * "anotar" es opcional y solo lo usan las pruebas: recibe 'descanso', 'ocupada' o 'pasada' con sus números.
 */
function repartir_(forzar, anotar) {
  const nota = anotar || (() => {});
  if (!forzar && cacheLeer_('reparto')) { nota('descanso'); return null; }
  const turno = LockService.getScriptLock();
  if (forzar === true) turno.waitLock(SEGUNDOS_BLOQUEO);
  else if (!turno.tryLock(forzar === REPARTO_URGENTE ? ESPERA_TURNO_URGENTE_MS : ESPERA_TURNO_REPARTO_MS)) { nota('ocupada'); return null; }
  // Otra ejecución pudo pasar entre la primera comprobación y el turno: con el turno en la mano se mira otra vez.
  if (!forzar && cacheLeer_('reparto')) { turno.releaseLock(); nota('descanso'); return null; }
  const inicio = Date.now();
  let todas;
  let cartas;
  let pendientes;
  let entrega;
  try {
    cachePoner_('reparto', 1, SEGUNDOS_ENTRE_REPARTOS);
    // Todo se decide con las propiedades leídas ahora, con el turno tomado: las cartas y los marcadores de quien ya tiene número.
    todas = buzon_().getProperties();
    cartas = cartasDe_(todas);
    const confirmada = c => { const marcador = todas[PREFIJO_ORDEN + c.email] || ''; return !!marcador && marcador.slice(-1) !== ORDEN_SIN_FILA; };
    pendientes = cartas.filter(c => !confirmada(c));
    entrega = entregarNumeros_(pendientes.map(c => ({ email: c.email, nombre: c.n, registrado_en: new Date(c.t) })), todas);
  } finally {
    turno.releaseLock();
  }
  const msConTurno = Date.now() - inicio;
  const numeros = entrega.numeros;
  cartas.forEach(c => { if (!numeros[c.email]) numeros[c.email] = parseInt(todas[PREFIJO_ORDEN + c.email], 10) || 0; });

  // Ya sin turno: las filas de Usuarios. Un fallo aquí no le quita el número a nadie; las cartas de quienes no
  // quedaron escritos se conservan y la siguiente pasada vuelve a intentarlo.
  let escritas = [];
  let fallo = '';
  try {
    escritas = escribirYConfirmar_(entrega.porEscribir, todas);
  } catch (error) {
    fallo = String(error.message);
    console.warn('No se pudieron escribir ' + entrega.porEscribir.length + ' filas en Usuarios: ' + fallo);
  }
  // Se borran las cartas que ya no hacen falta: las recién confirmadas y las que ya lo estaban.
  const sinFila = {};
  entrega.porEscribir.forEach(persona => { sinFila[persona.email] = true; });
  escritas.forEach(persona => { delete sinFila[persona.email]; });
  const entregadas = cartas.filter(c => !sinFila[c.email]);
  entregadas.forEach(c => buzon_().deleteProperty(c.clave));
  nota('pasada', { cartas: cartas.length, escritas: escritas.length, borradas: entregadas.length, msConTurno: msConTurno, ms: Date.now() - inicio, fallo: fallo });
  return numeros;
}

/* ---------- Para el editor ---------- */

/**
 * Antes de premiar: escribe las cartas pendientes y deja en Usuarios una fila por cada persona con número de orden
 * que no la tenga (alguien la borró a mano, o su escritura falló y su carta ya no está), con su mismo número.
 * También agrega a quien tenga intentos sin fila ni número, que solo puede venir de datos anteriores a los bloques.
 * No debería encontrar a nadie; es la red de seguridad.
 */
function completarUsuarios() {
  exigirAdmin_();
  repartir_(true);
  const turno = LockService.getScriptLock();
  turno.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const enHoja = usuariosEnHoja_();
    const todas = buzon_().getProperties();
    const primerIntento = {};
    leerHoja_(HOJA.INTENTOS, ['email', 'iniciado_en']).forEach(i => {
      const email = texto_(i.email).toLowerCase();
      if (!email) return;
      const inicio = ms_(i.iniciado_en) || Date.now();
      primerIntento[email] = Math.min(primerIntento[email] || inicio, inicio);
    });
    const faltan = {};
    Object.keys(todas).forEach(clave => { if (clave.indexOf(PREFIJO_ORDEN) === 0) faltan[clave.slice(PREFIJO_ORDEN.length)] = true; });
    Object.keys(primerIntento).forEach(email => { faltan[email] = true; });
    const correos = Object.keys(faltan).filter(email => !(email in enHoja) && !email.endsWith(SIM_DOMINIO));
    const deStaff = email => (catalogo_().staff.find(s => s.email === email) || {}).nombre;
    const personas = correos.map(email => ({
      email: email, nombre: deStaff(email) || nombreDeDirectorio_(email) || nombreDesdeEmail_(email), registrado_en: new Date(primerIntento[email] || Date.now()),
    }));
    // Quien ya tiene marcador conserva su número; el resto recibe uno nuevo.
    const conNumero = personas.filter(p => parseInt(todas[PREFIJO_ORDEN + p.email], 10));
    const escritas = escribirUsuarios_(conNumero.map(p => Object.assign({}, p, { orden: parseInt(todas[PREFIJO_ORDEN + p.email], 10) })), todas);
    SpreadsheetApp.flush();
    const confirmados = {};
    escritas.forEach(p => { confirmados[PREFIJO_ORDEN + p.email] = String(p.orden); });
    if (escritas.length) buzon_().setProperties(confirmados, false);
    numerarYEscribir_(personas.filter(p => conNumero.indexOf(p) < 0), todas);
    console.log('Personas sin fila en Usuarios que se agregaron: ' + (correos.length ? correos.join(', ') : 'ninguna'));
  } finally {
    turno.releaseLock();
  }
  console.log('Cartas que quedan en el buzón: ' + leerBuzon_().length);
}

/**
 * Para el admin: muestra los números de orden entregados, que viven en las propiedades del script y la hoja no enseña,
 * y los compara con la hoja Usuarios y con las cartas pendientes. No cambia nada.
 * Termina con REGISTRO: OK, OK con filas pendientes, o REVISAR.
 */
function auditarRegistro() {
  exigirAdmin_();
  const todas = buzon_().getProperties();
  const entregado = {};      // correo -> número
  const porNumero = {};      // número -> correos
  const sinConfirmar = [];
  Object.keys(todas).forEach(clave => {
    if (clave.indexOf(PREFIJO_ORDEN) !== 0) return;
    const email = clave.slice(PREFIJO_ORDEN.length);
    const orden = parseInt(todas[clave], 10) || 0;
    entregado[email] = orden;
    (porNumero[orden] = porNumero[orden] || []).push(email);
    if (todas[clave].slice(-1) === ORDEN_SIN_FILA) sinConfirmar.push(email);
  });
  const contador = parseInt(todas[CLAVE_ULTIMO_ORDEN], 10) || 0;
  const mayor = Object.keys(porNumero).reduce((m, n) => Math.max(m, Number(n)), 0);
  const repetidos = Object.keys(porNumero).filter(n => porNumero[n].length > 1).map(n => n + ' (' + porNumero[n].join(', ') + ')');

  const filasDe = {};        // correo -> [{ orden, fila }]
  leerHoja_(HOJA.USUARIOS, ['email', 'orden']).forEach(u => {
    const email = texto_(u.email).toLowerCase();
    (filasDe[email] = filasDe[email] || []).push({ orden: Number(u.orden) || 0, fila: u._fila });
  });
  const enHoja = Object.keys(filasDe);
  const sinFila = Object.keys(entregado).filter(email => !filasDe[email]);
  const sinNumero = enHoja.filter(email => !entregado[email]);
  const distintos = enHoja.filter(email => entregado[email] && filasDe[email].some(f => f.orden !== entregado[email]))
    .map(email => email + ' (hoja ' + filasDe[email].map(f => f.orden).join('/') + ', entregado ' + entregado[email] + ')');
  const repetidosEnHoja = enHoja.filter(email => filasDe[email].length > 1);
  const fueraDeLugar = enHoja.filter(email => entregado[email] && filasDe[email][0].fila !== entregado[email] + 1);
  const cartas = cartasDe_(todas).map(c => c.email);

  const lista = correos => correos.length + (correos.length ? ' -> ' + correos.slice(0, 15).join(', ') + (correos.length > 15 ? ' …' : '') : '');
  const grave = repetidos.length || distintos.length || repetidosEnHoja.length || sinNumero.length || contador < mayor;
  const pendiente = sinFila.length || sinConfirmar.length || cartas.length;
  console.log('===== Registro: números de orden =====');
  console.log('REGISTRO: ' + (grave ? 'REVISAR' : pendiente ? 'OK, con filas pendientes de escribir' : 'OK'));
  console.log('Personas con número entregado: ' + Object.keys(entregado).length + ' · último número entregado: ' + contador +
    (contador < mayor ? ' · ATENCIÓN: el contador va por detrás del mayor número entregado (' + mayor + ')' : ''));
  console.log('Números entregados a más de una persona: ' + lista(repetidos));
  console.log('Personas en la hoja Usuarios: ' + enHoja.length + ' · con más de una fila: ' + lista(repetidosEnHoja));
  console.log('Con número y sin fila en Usuarios: ' + lista(sinFila) + ' · con la fila sin confirmar: ' + lista(sinConfirmar));
  console.log('En Usuarios sin número entregado: ' + lista(sinNumero));
  console.log('Con otro número en la hoja que el entregado: ' + lista(distintos));
  console.log('Fuera de la fila de su número: ' + lista(fueraDeLugar));
  console.log('Cartas en el buzón: ' + lista(cartas));
  if (!grave && pendiente) console.log('Para escribir lo pendiente: "Registrar ahora" en el panel admin o, si no alcanza, completarUsuarios.');
  if (sinNumero.length && !Object.keys(entregado).length) console.log('El registro no conoce ningún número y la hoja sí tiene: si se perdieron las propiedades del script, ejecuta reconstruirRegistro.');
}

/**
 * Para recuperar el registro si se perdieron las propiedades del script: vuelve a crear, a partir de la columna "orden"
 * de Usuarios, los marcadores que falten, y deja el contador en el mayor número. No cambia el número de nadie:
 * si un correo ya tiene marcador con otro número, o dos correos tienen el mismo número en la hoja, no los toca y lo informa.
 */
function reconstruirRegistro() {
  exigirAdmin_();
  const turno = LockService.getScriptLock();
  turno.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const todas = buzon_().getProperties();
    const duenoDe = {};        // número -> correo que ya lo tiene
    let mayor = parseInt(todas[CLAVE_ULTIMO_ORDEN], 10) || 0;
    Object.keys(todas).forEach(clave => {
      if (clave.indexOf(PREFIJO_ORDEN) !== 0) return;
      const orden = parseInt(todas[clave], 10) || 0;
      duenoDe[orden] = clave.slice(PREFIJO_ORDEN.length);
      mayor = Math.max(mayor, orden);
    });
    const nuevos = {};
    const vistos = {};
    const conflictos = [];
    leerHoja_(HOJA.USUARIOS, ['email', 'orden']).forEach(u => {
      const email = texto_(u.email).toLowerCase();
      const orden = Number(u.orden) || 0;
      if (!email || !orden || vistos[email]) return;
      vistos[email] = true;
      const suyo = parseInt(todas[PREFIJO_ORDEN + email], 10) || 0;
      if (suyo) {
        if (suyo !== orden) conflictos.push(email + ' (hoja ' + orden + ', entregado ' + suyo + ')');
        return;
      }
      if (duenoDe[orden] && duenoDe[orden] !== email) {
        conflictos.push(email + ' (el ' + orden + ' ya es de ' + duenoDe[orden] + ')');
        return;
      }
      duenoDe[orden] = email;
      nuevos[PREFIJO_ORDEN + email] = String(orden);
      mayor = Math.max(mayor, orden);
    });
    const recuperados = Object.keys(nuevos).length;
    nuevos[CLAVE_ULTIMO_ORDEN] = String(mayor);
    buzon_().setProperties(nuevos, false);
    console.log('Registro reconstruido desde Usuarios: ' + recuperados + ' números recuperados · el siguiente será el ' + (mayor + 1) +
      ' · sin tocar por conflicto: ' + (conflictos.length ? conflictos.join(', ') : 'ninguno'));
  } finally {
    turno.releaseLock();
  }
}

/**
 * Antes de abrir la feria, con Intentos vacía: deja Usuarios con una fila por correo, numeradas desde 1, rehace
 * los marcadores de orden a partir de la hoja, abre una época nueva (cada celular vuelve a pedir su número) y
 * agranda Intentos para las personas previstas. Sirve después de las pruebas, que gastan números de orden, y
 * cuando el script pasa a apuntar a otro Sheet.
 * Con intentos en la hoja no hace nada: cambiar los números movería a la gente de bloque.
 */
function prepararFeria() {
  const sesion = exigirAdmin_();
  const turno = LockService.getScriptLock();
  turno.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const conDato = filasConDato_(HOJA.INTENTOS);
    if (conDato) throw new Error('Intentos todavía tiene ' + conDato + ' filas. Reinicia los datos desde el panel, o limpia las pruebas, y vuelve a ejecutar esto.');
    const encabezados = encabezados_(HOJA.USUARIOS);
    const columnaEmail = encabezados.indexOf('email'), columnaOrden = encabezados.indexOf('orden');
    if (columnaOrden < 0) throw new Error('Falta la columna "orden" en la hoja Usuarios. Agrégala y vuelve a ejecutar esto.');

    // Usuarios: una fila por correo (la primera que aparece), seguidas y numeradas desde 1.
    const hoja = hoja_(HOJA.USUARIOS);
    const ultima = hoja.getLastRow();
    const valores = ultima > 1 ? hoja.getRange(2, 1, ultima - 1, encabezados.length).getValues() : [];
    const marcadores = {};
    const filas = [];
    valores.forEach(fila => {
      const email = texto_(fila[columnaEmail]).toLowerCase();
      if (!email || marcadores[PREFIJO_ORDEN + email]) return;
      fila[columnaOrden] = filas.length + 1;
      marcadores[PREFIJO_ORDEN + email] = String(filas.length + 1);
      filas.push(fila);
    });
    if (filas.length) hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);
    if (valores.length > filas.length) hoja.getRange(2 + filas.length, 1, valores.length - filas.length, encabezados.length).clearContent();
    SpreadsheetApp.flush();

    // Propiedades: se conserva todo menos los marcadores y contadores anteriores, y se ponen los nuevos de una vez.
    const props = buzon_();
    const todas = props.getProperties();
    const nuevas = {};
    Object.keys(todas).forEach(clave => {
      if (clave.indexOf(PREFIJO_ORDEN) === 0 || clave.indexOf(CLAVE_ULTIMO_ORDEN) === 0 || clave.indexOf(CLAVE_FILAS) === 0) return;
      nuevas[clave] = todas[clave];
    });
    Object.assign(nuevas, marcadores);
    nuevas[CLAVE_ULTIMO_ORDEN] = String(filas.length);
    // Época nueva: los números guardados en el índice de cada persona dejan de valer y se vuelven a pedir.
    nuevas.ULTIMO_REINICIO = JSON.stringify({ cuando: Date.now(), por: sesion.email });
    props.setProperties(nuevas, true);
    EPOCA_ = null;
    const previstas = Math.max(PERSONAS_PREVISTAS, filas.length);
    asegurarFilasDeIntentos_(previstas, nuevas);
    asegurarFilas_(HOJA.USUARIOS, previstas + 1, PERSONAS_DE_HOLGURA, nuevas);
    limpiarCache_();
    // Codigos con su fila por stand ya puesta: así la primera generación de cada líder no necesita el turno.
    crearFilasDeCodigos_(catalogo_());

    const total = hoja_(HOJA.INTENTOS).getMaxRows();
    const resumen = {
      personas: filas.length,
      quitadas: valores.length - filas.length,
      siguiente: filas.length + 1,
      intentosFilas: total,
      personasSinAgrandar: Math.floor((total - 1) / FILAS_POR_PERSONA),
    };
    console.log('Feria preparada: ' + resumen.personas + ' personas numeradas desde 1' + (resumen.quitadas > 0 ? ' (' + resumen.quitadas + ' filas repetidas o vacías quitadas de Usuarios)' : '') +
      ' · el siguiente número de orden es el ' + resumen.siguiente + ' · bloques de ' + FILAS_POR_PERSONA + ' filas · Intentos tiene ' + resumen.intentosFilas + ' filas, para ' +
      resumen.personasSinAgrandar + ' personas sin agrandarse.');
    return resumen;
  } finally {
    turno.releaseLock();
  }
}
