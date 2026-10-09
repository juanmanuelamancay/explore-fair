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
  feria_abierta: true,
  // Sala de espera previa al evento. fecha_feria queda en milisegundos (0 = sin fecha).
  espera_activa: false,
  fecha_feria: 0,
  lugar_feria: '',
  espera_mensaje: '',
  // Preset de la pantalla de ranking (vista RANKING_PANTALLA). Se edita desde su panel de ajustes.
  rp_personas: 0,        // personas por pantalla; 0 = lo que quepa
  rp_columnas: 6,
  rp_alto: 64,           // px por fila
  rp_espacio: 10,        // px entre filas
  rp_fuente: 16,         // px de los nombres
  rp_puntos: 22,         // px de los puntos
  rp_escala: 100,        // % del top (podio)
  rp_ancho_top: 66,      // % del ancho de la pantalla que ocupa el top
  rp_ocultar_menu: false, // TRUE oculta la barra de navegación en la vista de ranking de pantalla
  rp_modo_oscuro: false,  // TRUE pinta la vista de ranking de pantalla en oscuro
};

const PREGUNTAS_POR_BANCO = 16;
const PREGUNTAS_POR_QUIZ = 4;

/** Cuánto tarda la app en notar un cambio hecho a mano en las hojas de catálogo. Se ajusta en Config. */
function segundosDeCatalogo_(config) {
  return Math.min(21600, Math.max(5, Number(config.segundos_cache_catalogo) || 60));
}
const MAX_CARACTERES_CACHE = 90000;   // CacheService admite 100 KB por valor

/* ---------- Hojas ---------- */

// ID del Sheet de la feria: lo que va entre /d/ y /edit en su dirección.
// Hace falta porque el script es independiente (no se creó desde Extensiones > Apps Script del Sheet).
const ID_DEL_SHEET = '1OrelUt3Hx-KelLfiWF596BW9QBVjSiDHK5CveHabfvc';

let LIBRO_ = null;

/** El Sheet de la feria. La propiedad del script SPREADSHEET_ID, si existe, tiene prioridad sobre ID_DEL_SHEET. */
function libro_() {
  if (LIBRO_) return LIBRO_;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ID_DEL_SHEET;
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

/** Devuelve las filas como objetos según los encabezados (en minúsculas y sin tildes). Cada objeto trae _fila con su número de fila en la hoja. */
function leerHoja_(nombre) {
  const valores = hoja_(nombre).getDataRange().getValues();
  const encabezados = valores[0].map(normal_);
  const filas = [];
  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0] === '') continue;
    const objeto = { _fila: i + 1 };
    encabezados.forEach((e, c) => { if (e) objeto[e] = valores[i][c]; });
    filas.push(objeto);
  }
  return filas;
}

function encabezados_(nombre) {
  const hoja = hoja_(nombre);
  return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(normal_);
}

/** Agrega una fila ubicando cada valor bajo su encabezado, sin depender del orden de las columnas. */
function agregarFila_(nombre, objeto) {
  const fila = encabezados_(nombre).map(e => (objeto[e] === undefined ? '' : objeto[e]));
  hoja_(nombre).appendRow(fila);
}

function actualizarFila_(nombre, numeroDeFila, cambios) {
  const encabezados = encabezados_(nombre);
  const rango = hoja_(nombre).getRange(numeroDeFila, 1, 1, encabezados.length);
  const valores = rango.getValues()[0];
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

/**
 * Invalida toda la caché. Ejecutar desde el editor después de editar a mano
 * Pabellones, Stands, Preguntas, Staff, Permisos o Config, para no esperar a que venza la caché (un minuto por defecto).
 */
function limpiarCache() {
  GENERACION_ = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('GEN', GENERACION_);
  CATALOGO_ = null;
}

/* ---------- Catálogo ---------- */

function leerStaff_() {
  return leerHoja_(HOJA.STAFF).filter(s => esVerdadero_(s.activo)).map(s => ({
    email: texto_(s.email).toLowerCase(), nombre: texto_(s.nombre), rol: texto_(s.rol).toUpperCase(),
    pabellonId: id_(s.pabellon_id), standId: id_(s.stand_id),
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
 * abrir la app y al pulsar actualizar: compara Staff, Permisos y Config del Sheet con lo guardado
 * y, si cambiaron, descarta la caché. Cuesta tres lecturas chicas por llamada.
 */
function sincronizarRoles_() {
  const enCache = cacheLeer_("catalogo");
  if (!enCache) return;
  const actual = JSON.stringify([leerStaff_(), leerPermisos_(), leerConfig_()]);
  if (actual !== JSON.stringify([enCache.staff, enCache.permisos, enCache.config])) limpiarCache();
}

let CATALOGO_ = null;

/** Pabellones, stands, staff, permisos y configuración activos. Se lee una vez y queda en caché. */
function catalogo_() {
  if (CATALOGO_) return CATALOGO_;
  let catalogo = cacheLeer_('catalogo');
  if (!catalogo) {
    const porOrden = (a, b) => a.orden - b.orden;
    const config = leerConfig_();
    catalogo = {
      config: config,
      pabellones: leerHoja_(HOJA.PABELLONES).filter(p => esVerdadero_(p.activo)).map(p => ({
        id: id_(p.pabellon_id), nombre: texto_(p.nombre), orden: Number(p.orden) || 0,
      })).sort(porOrden),
      stands: leerHoja_(HOJA.STANDS).filter(s => esVerdadero_(s.activo)).map(s => ({
        id: id_(s.stand_id), pabellonId: id_(s.pabellon_id), nombre: texto_(s.nombre),
        requiereCodigo: esVerdadero_(s.requiere_codigo), numPreguntas: PREGUNTAS_POR_QUIZ,
        orden: Number(s.orden) || 0,
      })).sort(porOrden),
      staff: leerStaff_(),
      permisos: leerPermisos_(),
    };
    cachePoner_('catalogo', catalogo, segundosDeCatalogo_(config));
  }
  CATALOGO_ = catalogo;
  return catalogo;
}

/**
 * Pabellones que aparecen en el mapa: los que tienen al menos un stand con código.
 * El pabellón del quiz de entrada queda fuera. "indice" elige el color en el navegador.
 */
function pabellonesDelMapa_(catalogo) {
  return catalogo.pabellones
    .map(p => ({ id: p.id, nombre: p.nombre, stands: catalogo.stands.filter(s => s.pabellonId === p.id && s.requiereCodigo) }))
    .filter(p => p.stands.length)
    .map((p, i) => Object.assign(p, { indice: i }));
}

/** Preguntas activas de un stand, con su respuesta correcta. Nunca se devuelve tal cual al navegador. Con sinCache se relee la hoja. */
function preguntasDeStand_(standId, sinCache) {
  const clave = 'preguntas:' + standId;
  let preguntas = sinCache ? null : cacheLeer_(clave);
  if (!preguntas) {
    const porDefecto = catalogo_().config.puntos_por_defecto;
    preguntas = leerHoja_(HOJA.PREGUNTAS)
      .filter(p => id_(p.stand_id) === standId && esVerdadero_(p.activo))
      .map(p => ({
        id: id_(p.pregunta_id), texto: texto_(p.texto),
        opciones: [p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d].map(texto_),
        correcta: texto_(p.correcta).toUpperCase(), puntos: Number(p.puntos) || porDefecto,
      }));
    cachePoner_(clave, preguntas, segundosDeCatalogo_(catalogo_().config));
  }
  return preguntas;
}
