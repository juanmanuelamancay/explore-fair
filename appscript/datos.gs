/**
 * Acceso a las hojas, caché y utilidades compartidas por todas las vistas.
 * Las funciones que terminan en "_" son privadas: el navegador no puede llamarlas.
 */

const HOJA = {
  PABELLONES: 'Pabellones',
  STANDS: 'Stands',
  PREGUNTAS: 'Preguntas',
  STAFF: 'Staff',
  PERMISOS: 'Permisos',
  CONFIG: 'Config',
  PREMIOS: 'Premios',
  CHARLAS: 'Charlas',
  USUARIOS: 'Usuarios',
  CODIGOS: 'Codigos',
  INTENTOS: 'Intentos',
};

const CONFIG_DEFECTO = {
  minutos_vigencia_codigo: 5,
  minutos_para_responder: 5,
  puntos_por_defecto: 10,
  segundos_refresco_board: 15,
  segundos_cache_catalogo: 60,
  segundos_cache_ranking: 60,
  // Quiz por pabellón: cada stand aporta preguntas_por_stand preguntas de su banco, que debe tener PREGUNTAS_BANCO_STAND activas (fijo en el código).
  // Cada charla trae su propio banco y su sorteo (columnas de Charlas); estas dos claves valen si la columna está vacía.
  preguntas_por_stand: 2,
  preguntas_quiz_charla: 5,
  preguntas_banco_charla: 15,
  feria_abierta: true,
  // Sala de espera previa al evento. fecha_feria queda en milisegundos (0 = sin fecha).
  espera_activa: false,
  fecha_feria: 0,
  lugar_feria: '',
  espera_mensaje: '',
  premios_mensaje: 'Participando y aprendiendo podrás ganar:',
  // Preset de la pantalla de ranking (vista RANKING). Se edita desde su panel de ajustes.
  rp_personas: 0,        // personas por pantalla; 0 = lo que quepa
  rp_columnas: 3,
  rp_alto: 64,           // px por fila
  rp_espacio: 10,        // px entre filas
  rp_fuente: 16,         // px de los nombres
  rp_puntos: 22,         // px de los puntos
  rp_escala: 100,        // % del top (podio)
  rp_ancho_top: 52,      // % del ancho del contenido que ocupa el top
  rp_ancho_contenido: 100, // % del ancho disponible que usa el contenido (podio y cuadrícula)
  rp_filas: 0,           // filas de la cuadrícula; 0 = las que quepan
  rp_pts_top: 18,        // px de los puntos del top (el 1.º, un 25 % más)
  rp_resumen: 20,        // px del contador "N participantes · N quizzes"; 0 lo oculta
  rp_achicar_top: true,  // TRUE achica el top si con su tamaño no entran 3 filas de la cuadrícula
  rp_nombre_top: 16,     // px de los nombres del top (el 1.º, un 25 % más)
  rp_tiempo: 13,         // px del tiempo de desempate en la lista
  rp_tiempo_top: 13,     // px del tiempo de desempate en el top (el 1.º, un 25 % más)
  rp_margen: 5,          // % de margen en los bordes, por si la pantalla o el proyector recorta (overscan)
  rp_ocultar_menu: false, // TRUE oculta la barra de navegación en la vista de ranking
};

// Filas de Intentos que se reservan a cada persona: un intento por unidad (el quiz de entrada, 6 pabellones y 5 charlas son 12),
// con margen para unidades que se agreguen. No se cambia con la feria en curso: la fila de cada intento
// se calcula con este número (ver indice.gs).
const FILAS_POR_PERSONA = 16;

/** Preguntas activas que necesita el banco de cada stand (y tope del expositor). Fijo: no se lee de Config. */
const PREGUNTAS_BANCO_STAND = 10;

/** Cuánto tarda la app en notar un cambio hecho a mano en las hojas de catálogo. Se ajusta en Config. */
function segundosDeCatalogo_(config) {
  return Math.min(21600, Math.max(5, Number(config.segundos_cache_catalogo) || 60));
}
const MAX_CARACTERES_CACHE = 90000;   // CacheService admite 100 KB por valor

/* ---------- Hojas ---------- */

// ID del Sheet de la feria: lo que va entre /d/ y /edit en su dirección.
// Hace falta porque el script es independiente (no se creó desde Extensiones > Apps Script del Sheet).
const ID_DEL_SHEET = '15dUACK9DdXYXGpNSEihFqT_TdFJt2GcM43RAtLqJhVM';

let LIBRO_ = null;

/** ID del Sheet en uso. La propiedad del script SPREADSHEET_ID, si existe, tiene prioridad sobre ID_DEL_SHEET. */
function idDelSheet_() {
  return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ID_DEL_SHEET;
}

/** El Sheet de la feria. */
function libro_() {
  if (LIBRO_) return LIBRO_;
  const id = idDelSheet_();
  LIBRO_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!LIBRO_) throw new Error('No se encontró el Sheet de la feria. Revisa ID_DEL_SHEET en datos.gs.');
  return LIBRO_;
}

/** Busca la pestaña sin importar mayúsculas, tildes ni espacios sobrantes en su nombre. */
function hojaSiExiste_(nombre) {
  const libro = libro_();
  return libro.getSheetByName(nombre) || libro.getSheets().find(h => normal_(h.getName()) === normal_(nombre)) || null;
}

function hoja_(nombre) {
  const hoja = hojaSiExiste_(nombre);
  if (!hoja) throw new Error('Falta la hoja "' + nombre + '" en el archivo.');
  return hoja;
}

/**
 * Devuelve las filas como objetos según los encabezados (en minúsculas y sin tildes). Cada objeto trae _fila con su número de fila en la hoja.
 * Con "campos", solo lee hasta la última de esas columnas: si las pedidas están al principio de la hoja, se leen menos datos.
 */
function leerHoja_(nombre, campos) {
  return leerHojaCompleta_(nombre, campos).filas;
}

/**
 * Como leerHoja_, pero entrega además los encabezados y los valores tal como salieron de la hoja (valores[0] es la
 * cabecera; la fila n está en valores[n - 1]). Con eso, agregarFila_ y actualizarFila_ no vuelven a leer la hoja.
 */
function leerHojaCompleta_(nombre, campos) {
  const valores = rangoDeLectura_(nombre, campos).getValues();
  const encabezados = valores[0].map(normal_);
  const filas = [];
  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0] === '') continue;
    const objeto = { _fila: i + 1 };
    encabezados.forEach((e, c) => { if (e) objeto[e] = valores[i][c]; });
    filas.push(objeto);
  }
  return { encabezados: encabezados, valores: valores, filas: filas };
}

/** Rango a leer: toda la hoja, o solo hasta la última de las columnas pedidas. Si falta alguna, se lee todo. */
function rangoDeLectura_(nombre, campos) {
  const hoja = hoja_(nombre);
  if (!campos) return hoja.getDataRange();
  const encabezados = encabezados_(nombre);
  const posiciones = campos.map(c => encabezados.indexOf(c));
  if (posiciones.some(p => p < 0)) return hoja.getDataRange();
  return hoja.getRange(1, 1, Math.max(1, hoja.getLastRow()), Math.max(...posiciones) + 1);
}

function encabezados_(nombre) {
  const hoja = hoja_(nombre);
  return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(normal_);
}

/**
 * Agrega una fila ubicando cada valor bajo su encabezado, sin depender del orden de las columnas.
 * Quien ya leyó la hoja completa puede pasar sus encabezados para no leerlos otra vez.
 */
function agregarFila_(nombre, objeto, encabezados) {
  const fila = (encabezados || encabezados_(nombre)).map(e => (objeto[e] === undefined ? '' : objeto[e]));
  hoja_(nombre).appendRow(fila);
}

/**
 * Como agregarFila_, pero con un turno global: una escritura a la vez. Sin turno, dos personas que agregan
 * filas al mismo tiempo pueden caer en la misma fila y perderse (prueba 0.4 del plan: 286 de 1.000 sobrevivieron).
 * La app ya no la usa para los intentos: cada persona escribe en sus propias filas, sin agregar al final (indice.gs).
 * Queda para la prueba de filas simultáneas (pruebas-carga.gs).
 */
function agregarFilaConTurno_(nombre, objeto) {
  const turno = LockService.getScriptLock();
  turno.waitLock(SEGUNDOS_BLOQUEO);
  try {
    agregarFila_(nombre, objeto);
    SpreadsheetApp.flush();
  } finally {
    turno.releaseLock();
  }
}

/**
 * Escribe un objeto en una fila concreta, cada valor bajo su encabezado. Reemplaza la fila entera:
 * es para filas que quien llama sabe vacías y suyas. No agranda la hoja ni necesita turno.
 */
function escribirFila_(nombre, numeroDeFila, objeto, encabezados) {
  const columnas = encabezados || encabezados_(nombre);
  hoja_(nombre).getRange(numeroDeFila, 1, 1, columnas.length).setValues([columnas.map(e => (objeto[e] === undefined ? '' : objeto[e]))]);
}

/**
 * Filas con dato de una hoja, sin contar la cabecera. Intentos tiene filas vacías entre el bloque de una
 * persona y el de la siguiente, así que ahí no sirve restarle uno a la última fila.
 */
function filasConDato_(nombre) {
  const hoja = hoja_(nombre);
  const ultima = hoja.getLastRow();
  if (ultima < 2) return 0;
  return hoja.getRange(2, 1, ultima - 1, 1).getValues().filter(v => v[0] !== '').length;
}

/**
 * Agrega varias filas en una sola escritura, cada valor bajo su encabezado. Quien la llama debe tener el turno
 * global: calcula la última fila y escribe debajo, así que dos ejecuciones a la vez caerían en las mismas filas.
 */
function agregarFilas_(nombre, objetos) {
  if (!objetos.length) return;
  const hoja = hoja_(nombre);
  const encabezados = encabezados_(nombre);
  const filas = objetos.map(objeto => encabezados.map(e => (objeto[e] === undefined ? '' : objeto[e])));
  const desde = hoja.getLastRow() + 1;
  // A diferencia de appendRow, setValues no agranda la hoja.
  const faltan = desde + filas.length - 1 - hoja.getMaxRows();
  if (faltan > 0) hoja.insertRowsAfter(hoja.getMaxRows(), faltan);
  hoja.getRange(desde, 1, filas.length, encabezados.length).setValues(filas);
}

/**
 * Cambia solo las columnas indicadas en "cambios"; el resto de la fila se conserva.
 * "lectura" es el resultado de leerHojaCompleta_ de esa hoja: con él, la fila no se lee de nuevo. Solo vale si
 * quien llama tiene el turno global desde esa lectura, porque los valores se toman de ahí.
 */
function actualizarFila_(nombre, numeroDeFila, cambios, lectura) {
  const encabezados = lectura ? lectura.encabezados : encabezados_(nombre);
  const rango = hoja_(nombre).getRange(numeroDeFila, 1, 1, encabezados.length);
  const valores = lectura ? lectura.valores[numeroDeFila - 1].slice(0, encabezados.length) : rango.getValues()[0];
  encabezados.forEach((e, c) => { if (e in cambios) valores[c] = cambios[e]; });
  rango.setValues([valores]);
}

/* ---------- Valores ---------- */

function esVerdadero_(valor) {
  return valor === true || /^(true|verdadero|si|sí|1)$/i.test(String(valor).trim());
}

function texto_(valor) { return String(valor == null ? '' : valor).trim(); }

/*
 * Nada de lo que se escribe a mano en el Sheet se compara tal cual:
 *  - nombres de pestaña, encabezados y claves de Config pasan por normal_ (minúsculas, sin tildes);
 *  - identificadores como STD-001 pasan por id_ (mayúsculas);
 *  - roles, vistas, estados, códigos y la letra correcta se pasan a mayúsculas; los correos, a minúsculas.
 * Así "admin", "Admin" y "ADMIN" valen lo mismo, igual que "std-001" y "STD-001".
 */
function normal_(valor) {
  return texto_(valor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function id_(valor) { return texto_(valor).toUpperCase(); }

/**
 * Fecha y hora escritas en una celda, en milisegundos; 0 si está vacía o no se entiende.
 * Acepta una celda con formato de fecha, o texto como "2026-10-22 09:00" o "22/10/2026 09:00".
 * El texto se interpreta en la zona horaria del script.
 */
function fechaEnMs_(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]') return isNaN(valor.getTime()) ? 0 : valor.getTime();
  const t = texto_(valor);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  return 0;
}

function ms_(valor) {
  return valor instanceof Date ? valor.getTime() : new Date(valor).getTime();
}

/* ---------- Caché ---------- */

let GENERACION_ = null;

/** Prefijo de todas las claves de caché. Cambiarlo invalida la caché completa de una vez. */
function generacion_() {
  if (GENERACION_ === null) GENERACION_ = PropertiesService.getScriptProperties().getProperty('GEN') || '0';
  return GENERACION_;
}

function cacheLeer_(clave) {
  const texto = CacheService.getScriptCache().get(generacion_() + ':' + clave);
  return texto ? JSON.parse(texto) : null;
}

function cachePoner_(clave, valor, segundos) {
  const texto = JSON.stringify(valor);
  if (texto.length < MAX_CARACTERES_CACHE) CacheService.getScriptCache().put(generacion_() + ':' + clave, texto, segundos);
}

function cacheQuitar_(clave) {
  CacheService.getScriptCache().remove(generacion_() + ':' + clave);
}

/** Invalida toda la caché. La app la usa cuando el admin cambia datos desde el panel o reinicia. */
function limpiarCache_() {
  GENERACION_ = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('GEN', GENERACION_);
  CATALOGO_ = null;
}

/**
 * Versión para el editor; exige admin. Sirve después de editar a mano las hojas de catálogo,
 * para no esperar a que venza la caché (un minuto por defecto).
 */
function limpiarCache() {
  exigirAdmin_();
  limpiarCache_();
}

/* ---------- Catálogo ---------- */

function leerStaff_() {
  return leerHoja_(HOJA.STAFF).filter(s => esVerdadero_(s.activo)).map(s => ({
    email: texto_(s.email).toLowerCase(), nombre: texto_(s.nombre), rol: texto_(s.rol).toUpperCase(),
    pabellonId: id_(s.pabellon_id), standId: id_(s.stand_id), charlaId: id_(s.charla_id),
  }));
}

function leerPermisos_() {
  return leerHoja_(HOJA.PERMISOS).filter(p => esVerdadero_(p.activo)).map(p => ({
    rol: texto_(p.rol).toUpperCase(), vista: texto_(p.vista).toUpperCase(),
  }));
}

function leerConfig_() {
  const config = Object.assign({}, CONFIG_DEFECTO);
  leerHoja_(HOJA.CONFIG).forEach(f => {
    const clave = normal_(f.clave);
    if (!(clave in CONFIG_DEFECTO)) return;
    if (clave === 'fecha_feria') config[clave] = fechaEnMs_(f.valor);
    else if (typeof CONFIG_DEFECTO[clave] === 'string') config[clave] = texto_(f.valor);
    else if (typeof CONFIG_DEFECTO[clave] === 'boolean') config[clave] = esVerdadero_(f.valor);
    else if (!isNaN(Number(f.valor)) && texto_(f.valor) !== '') config[clave] = Number(f.valor);
  });
  return config;
}

/**
 * Lo que decide qué ve cada persona no puede esperar a que venza la caché: quien acaba de ser
 * nombrado líder, o la sala de espera recién encendida, deben notarse al recargar. Se llama al
 * abrir la app y al pulsar actualizar: compara el catálogo (pabellones, stands, Staff, Permisos y Config)
 * y los Premios del Sheet con lo guardado y, si cambiaron, los refresca. Se revisa como mucho cada 30 segundos,
 * así que un cambio a mano tarda hasta eso en notarse, aunque segundos_cache_catalogo sea mayor.
 */
function sincronizarRoles_() {
  // Como mucho una vez cada 30 segundos, para toda la feria: no hace falta que cada carga lea las hojas.
  if (cacheLeer_('roles-al-dia')) return;
  cachePoner_('roles-al-dia', 1, 30);
  const enCache = cacheLeer_('catalogo');
  if (!enCache) return;
  if (JSON.stringify(leerCatalogo_()) !== JSON.stringify(enCache)) refrescarCatalogo_();
  const premios = cacheLeer_('premios');
  if (premios && JSON.stringify(leerPremios_()) !== JSON.stringify(premios)) cacheQuitar_('premios');
}

let CATALOGO_ = null;

/**
 * Lee pabellones, stands, charlas, staff, permisos y configuración de las hojas. No toca la caché.
 *
 * "unidades" es lo que se responde: cada pabellón (con sus stands como bancos de preguntas) y cada charla (con su propio
 * banco). Todo el quiz, el código, el intento y el puntaje trabajan con la unidad, sin saber si es un pabellón o una charla.
 */
function leerCatalogo_() {
  const porOrden = (a, b) => a.orden - b.orden;
  const config = leerConfig_();
  const filasPabellones = leerHoja_(HOJA.PABELLONES).filter(p => esVerdadero_(p.activo));
  const filasStands = leerHoja_(HOJA.STANDS).filter(s => esVerdadero_(s.activo));
  const filasCharlas = hojaSiExiste_(HOJA.CHARLAS) ? leerHoja_(HOJA.CHARLAS).filter(c => esVerdadero_(c.activo)) : [];

  const pabellones = filasPabellones.map(p => ({
    id: id_(p.pabellon_id), nombre: texto_(p.nombre), nombreCorto: texto_(p.nombre_corto), descripcion: texto_(p.descripcion), orden: Number(p.orden) || 0,
  })).sort(porOrden);
  const stands = filasStands.map(s => ({
    id: id_(s.stand_id), pabellonId: id_(s.pabellon_id), nombre: texto_(s.nombre), orden: Number(s.orden) || 0,
  })).sort(porOrden);

  const unidadesDePabellon = filasPabellones.map(p => {
    const id = id_(p.pabellon_id);
    const propios = filasStands.filter(s => id_(s.pabellon_id) === id);
    // El código se pide por pabellón. Mientras la columna requiere_codigo de Pabellones esté vacía o no exista,
    // se deduce de los stands, como antes de que el quiz fuera por pabellón.
    const requiere = texto_(p.requiere_codigo) !== '' ? esVerdadero_(p.requiere_codigo)
      : (propios.length ? propios.some(s => texto_(s.requiere_codigo) === '' || esVerdadero_(s.requiere_codigo)) : true);
    const porStand = Math.floor(Number(p.preguntas_por_stand)) > 0 ? Math.floor(Number(p.preguntas_por_stand)) : config.preguntas_por_stand;
    const bancos = propios.map(s => ({ id: id_(s.stand_id), nombre: texto_(s.nombre), cuantas: porStand, minimo: PREGUNTAS_BANCO_STAND, orden: Number(s.orden) || 0 }))
      .sort(porOrden).map(b => ({ id: b.id, nombre: b.nombre, cuantas: b.cuantas, minimo: b.minimo }));
    return {
      id: id, tipo: 'PABELLON', nombre: texto_(p.nombre), nombreCorto: texto_(p.nombre_corto), descripcion: texto_(p.descripcion),
      orden: Number(p.orden) || 0, requiereCodigo: requiere, bancos: bancos,
      porQuiz: bancos.reduce((suma, b) => suma + b.cuantas, 0), ponente: '', inicio: 0, fin: 0, cierre: 0,
    };
  }).sort(porOrden);

  const unidadesDeCharla = filasCharlas.map(c => {
    const id = id_(c.charla_id);
    const cuantas = Math.floor(Number(c.preguntas_quiz)) > 0 ? Math.floor(Number(c.preguntas_quiz)) : config.preguntas_quiz_charla;
    const minimo = Math.floor(Number(c.preguntas_banco)) > 0 ? Math.floor(Number(c.preguntas_banco)) : config.preguntas_banco_charla;
    return {
      id: id, tipo: 'CHARLA', nombre: texto_(c.titulo), nombreCorto: texto_(c.titulo), descripcion: texto_(c.descripcion),
      orden: Number(c.orden) || 0, requiereCodigo: true, bancos: [{ id: id, nombre: texto_(c.titulo), cuantas: cuantas, minimo: minimo }],
      porQuiz: cuantas, ponente: texto_(c.ponente), inicio: fechaEnMs_(c.inicio), fin: fechaEnMs_(c.fin), cierre: fechaEnMs_(c.cierre),
    };
  }).sort((a, b) => a.inicio - b.inicio || a.orden - b.orden);

  return {
    config: config,
    pabellones: pabellones,
    stands: stands,
    unidades: unidadesDePabellon.concat(unidadesDeCharla),
    staff: leerStaff_(),
    permisos: leerPermisos_(),
  };
}

/** Pabellones, stands, staff, permisos y configuración activos. Se lee una vez y queda en caché. */
function catalogo_() {
  if (CATALOGO_) return CATALOGO_;
  let catalogo = cacheLeer_('catalogo');
  // Una copia guardada por una versión anterior del código no trae las unidades: se descarta.
  if (catalogo && !catalogo.unidades) catalogo = null;
  if (!catalogo) {
    catalogo = leerCatalogo_();
    cachePoner_('catalogo', catalogo, segundosDeCatalogo_(catalogo.config));
  }
  CATALOGO_ = catalogo;
  return catalogo;
}

/**
 * Relee el catálogo y reemplaza solo esa clave de la caché. Preguntas, ranking y códigos se conservan:
 * cambiar Config o Staff no obliga a todos a releer lo demás.
 */
function refrescarCatalogo_() {
  CATALOGO_ = leerCatalogo_();
  cachePoner_('catalogo', CATALOGO_, segundosDeCatalogo_(CATALOGO_.config));
  return CATALOGO_;
}

/** La unidad (pabellón o charla) con ese ID, o undefined. */
function unidadPorId_(catalogo, id) {
  return catalogo.unidades.find(u => u.id === id_(id));
}

/** El quiz de entrada: el pabellón sin código. Es el primero que se responde y no aparece entre los pabellones del mapa. */
function unidadDeEntrada_(catalogo) {
  return catalogo.unidades.find(u => u.tipo === 'PABELLON' && !u.requiereCodigo);
}

/** Charlas activas, en el orden de su fecha de inicio. */
function charlasDe_(catalogo) {
  return catalogo.unidades.filter(u => u.tipo === 'CHARLA');
}

/**
 * Pabellones que aparecen en el mapa: los que piden código y tienen al menos un stand.
 * El pabellón del quiz de entrada queda fuera. "indice" elige el color en el navegador.
 * Cada stand se muestra como información: se responde el pabellón entero, no el stand.
 */
function pabellonesDelMapa_(catalogo) {
  return catalogo.unidades
    .filter(u => u.tipo === 'PABELLON' && u.requiereCodigo && u.bancos.length)
    .map((u, i) => ({
      id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, descripcion: u.descripcion, indice: i, porQuiz: u.porQuiz,
      stands: u.bancos.map(b => ({ id: b.id, nombre: b.nombre })),
    }));
}

/**
 * Preguntas activas de un banco (un stand o una charla), con su respuesta correcta. Nunca se devuelve tal cual al navegador.
 * Con sinCache se relee la hoja. La columna stand_id de Preguntas lleva el ID del stand o de la charla.
 */
function preguntasDeStand_(standId, sinCache) {
  const clave = 'preguntas:' + standId;
  let preguntas = sinCache ? null : cacheLeer_(clave);
  if (!preguntas) {
    const porDefecto = catalogo_().config.puntos_por_defecto;
    preguntas = leerHoja_(HOJA.PREGUNTAS)
      .filter(p => id_(p.stand_id) === standId && esVerdadero_(p.activo))
      .map(p => preguntaDeFila_(p, porDefecto));
    cachePoner_(clave, preguntas, segundosDeCatalogo_(catalogo_().config));
  }
  return preguntas;
}

function preguntaDeFila_(p, porDefecto) {
  return {
    id: id_(p.pregunta_id), texto: texto_(p.texto),
    opciones: [p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d].map(texto_),
    correcta: texto_(p.correcta).toUpperCase(), puntos: Number(p.puntos) || porDefecto,
  };
}

/** Guarda en caché las preguntas de todos los bancos (stands y charlas) con una sola lectura de la hoja, y los premios. Devuelve cuántos bancos quedaron listos. */
function precargarPreguntasYPremios_() {
  const catalogo = catalogo_();
  const segundos = segundosDeCatalogo_(catalogo.config);
  const porBanco = {};
  catalogo.unidades.forEach(u => u.bancos.forEach(b => { porBanco[b.id] = []; }));
  leerHoja_(HOJA.PREGUNTAS).forEach(p => {
    const bancoId = id_(p.stand_id);
    if (porBanco[bancoId] && esVerdadero_(p.activo)) porBanco[bancoId].push(preguntaDeFila_(p, catalogo.config.puntos_por_defecto));
  });
  Object.keys(porBanco).forEach(bancoId => cachePoner_('preguntas:' + bancoId, porBanco[bancoId], segundos));
  cachePoner_('premios', leerPremios_(), segundos);
  return Object.keys(porBanco).length;
}
