/**
 * Simulador local del proyecto Apps Script. Ejecuta los .gs reales de ../appscript con
 * hojas en memoria y sirve la web app en http://localhost:8123, sin desplegar nada.
 *
 *   node simulador/servidor.js
 *
 * Para entrar como otra persona: http://localhost:8123/?como=expositor.apx@demo.com
 * Cuentas de ejemplo: ana.torres@demo.com (usuario), expositor.apx@demo.com (expositor de un stand),
 * lider.backend@demo.com (líder de pabellón), ponente.uno@demo.com (ponente de una charla),
 * validador@demo.com (validador), admin@demo.com (admin), juanmanuel.amancay@bbva.com (líder, expositor y ponente) y validador.prueba@bbva.com (validador, dominio válido),
 * y sin.vistas@demo.com (rol sin permisos, para ver la página de error).
 * CHARLAS=1 deja al usuario solo con la ruta de charlas (semana previa al evento); sin esa variable ve el mapa del evento.
 * Variables de entorno: PORT, ESPERA=1 o ESPERA=0 (sala de espera), DESORDEN=1 (datos escritos a mano),
 * RANKING=N (cuánta gente con puntajes hay de entrada, 40 por defecto; 0 deja el ranking vacío) y
 * VIVO=1 (cada pocos segundos alguien completa un quiz y sube de puesto, para ver las animaciones del ranking).
 * El ranking se ve entrando como admin: http://localhost:8123/?como=admin@demo.com
 * Los datos se pierden al detener el servidor. No se sube a Apps Script.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', 'appscript');
const PUERTO = Number(process.env.PORT) || 8123;

/* ---------- Hojas en memoria ---------- */

class Rango {
  constructor(hoja, fila, columna, filas, columnas) { Object.assign(this, { hoja, fila, columna, filas, columnas }); }
  getValues() {
    const salida = [];
    for (let f = 0; f < this.filas; f++) {
      const origen = this.hoja.datos[this.fila - 1 + f] || [];
      salida.push(Array.from({ length: this.columnas }, (_, c) => (origen[this.columna - 1 + c] === undefined ? '' : origen[this.columna - 1 + c])));
    }
    return salida;
  }
  setValues(valores) {
    valores.forEach((v, f) => {
      const destino = this.hoja.datos[this.fila - 1 + f] || (this.hoja.datos[this.fila - 1 + f] = []);
      v.forEach((valor, c) => { destino[this.columna - 1 + c] = valor; });
    });
    return this;
  }
  setValue(valor) { return this.setValues([[valor]]); }
  clearContent() { return this.setValues(Array.from({ length: this.filas }, () => Array(this.columnas).fill(''))); }
  // Busca en esta columna las celdas que coinciden, sin distinguir mayúsculas (como TextFinder de Sheets).
  createTextFinder(texto) {
    const rango = this;
    return {
      matchEntireCell() { return this; },
      findAll() {
        const valores = rango.getValues();
        const hallazgos = [];
        for (let f = 0; f < valores.length; f++) {
          if (String(valores[f][0]).toUpperCase() === String(texto).toUpperCase()) hallazgos.push({ getRow: () => rango.fila + f });
        }
        return hallazgos;
      },
      findNext() {
        const valores = rango.getValues();
        for (let f = 0; f < valores.length; f++) {
          if (String(valores[f][0]).toUpperCase() === String(texto).toUpperCase()) return { getRow: () => rango.fila + f };
        }
        return null;
      },
    };
  }
}

class Hoja {
  constructor(libro, nombre, datos) { Object.assign(this, { libro, nombre, datos, oculta: false }); }
  // Intentos se escribe por bloques de filas, así que entre medio hay filas que nunca se tocaron (huecos del arreglo).
  getLastColumn() { return Math.max(0, ...Array.from(this.datos, f => (f ? f.length : 0))); }
  getLastRow() {
    for (let i = this.datos.length - 1; i >= 0; i--) if (this.datos[i] && this.datos[i].some(v => v !== '' && v != null)) return i + 1;
    return 0;
  }
  getDataRange() { return new Rango(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(fila, columna, filas = 1, columnas = 1) { return new Rango(this, fila, columna, filas, columnas); }
  appendRow(fila) { this.datos.length = this.getLastRow(); this.datos.push(fila.slice()); return this; }
  getMaxRows() { return this.datos.length; }
  insertRowsAfter(fila, cuantas) { for (let i = 0; i < cuantas; i++) this.datos.splice(fila, 0, []); return this; }
  deleteRow(fila) { this.datos.splice(fila - 1, 1); return this; }
  copyTo(libro) { const copia = new Hoja(libro, 'Copia de ' + this.nombre, Array.from(this.datos, f => (f ? f.slice() : []))); libro.hojas.push(copia); return copia; }
  setName(nombre) { this.nombre = nombre; return this; }
  getName() { return this.nombre; }
  hideSheet() { this.oculta = true; return this; }
}

class Libro {
  constructor(tablas) { this.hojas = Object.keys(tablas).map(n => new Hoja(this, n, tablas[n])); }
  getSheetByName(nombre) { return this.hojas.find(h => h.nombre === nombre) || null; }
  getSheets() { return this.hojas; }
  deleteSheet(hoja) { this.hojas = this.hojas.filter(h => h !== hoja); }
  getName() { return 'Sheet simulado'; }
  getUrl() { return 'http://localhost:' + PUERTO + '/hoja'; }
}

/* ---------- Datos de ejemplo ---------- */

function datosDeEjemplo() {
  const hoy = new Date();
  const pabellones = [['PAB-000', 'General'], ['PAB-001', 'Backend'], ['PAB-002', 'Frontend'], ['PAB-003', 'Quality'], ['PAB-004', 'Seguridad'], ['PAB-005', 'Data'], ['PAB-006', 'Host'], ['PAB-007', 'Prueba doble rol']];
  const stands = [
    ['STD-000', 'PAB-000', 'Quiz de entrada', false],
    ['STD-001', 'PAB-001', 'APX'], ['STD-002', 'PAB-001', 'ASO / APIs'], ['STD-003', 'PAB-001', 'LRA / LRBA'],
    ['STD-004', 'PAB-002', 'Cells'], ['STD-005', 'PAB-002', 'Glomo'], ['STD-006', 'PAB-002', 'Emailing'],
    ['STD-007', 'PAB-003', 'Testing'], ['STD-008', 'PAB-003', 'QE'], ['STD-009', 'PAB-003', 'Code Review'],
    ['STD-010', 'PAB-004', 'SAST'], ['STD-011', 'PAB-004', 'Security'], ['STD-012', 'PAB-004', 'Gobierno'], ['STD-013', 'PAB-004', 'Quality'],
    ['STD-014', 'PAB-005', 'ADA'], ['STD-015', 'PAB-005', 'Data & Analytics'], ['STD-016', 'PAB-005', 'Gobierno de Datos'],
    ['STD-017', 'PAB-006', 'Synapse'], ['STD-018', 'PAB-006', 'Katalyst'], ['STD-019', 'PAB-007', 'Control-M'],
  ];
  const preguntas = [];
  // Con la sala de espera encendida las charlas aún no empiezan: la primera cae dentro de 2 días y 3 horas.
  const corrimientoEspera = process.env.ESPERA === '1' ? 51 * 3600000 : 0;
  const charlas = [
    ['CHA-001', 'Introducción a los custom agents', 'Rosa Quiroz', -2 * 3600000],
    ['CHA-002', 'Taller de prompts efectivos', 'Carlos Mendoza', -600000],
    ['CHA-003', 'Agentes con herramientas', 'Valeria Ortiz', 3 * 3600000],
    ['CHA-004', 'Evaluar la calidad de un agente', 'Marta Salinas', 26 * 3600000],
    ['CHA-005', 'Cierre: lo que viene', 'Rosa Quiroz', 50 * 3600000],
    // Solo con CHARLAS=1, para ver cómo se ven una charla cerrada sin responder (CHA-006) y una ya respondida (CHA-007).
    ...(process.env.CHARLAS ? [
      ['CHA-006', 'Fundamentos de IA generativa', 'Daniel Calle', -30 * 3600000],
      ['CHA-007', 'Uso responsable de la IA', 'César Mariluz', -4 * 3600000],
    ] : []),
  ].map(c => [c[0], c[1], c[2], c[3] + corrimientoEspera]);
  const bancos = stands.map(([id, , nombre]) => [id, nombre, 10]).concat(charlas.map(([id, titulo]) => [id, titulo, 15]));
  bancos.forEach(([id, nombre, cuantas]) => {
    for (let n = 1; n <= cuantas; n++) {
      const correcta = 'ABCD'[(n - 1) % 4];
      preguntas.push(['PRG-' + String(preguntas.length + 1).padStart(3, '0'), id, `Pregunta ${n} de ejemplo sobre ${nombre}: ¿cuál es la opción correcta?`,
        ...'ABCD'.split('').map(l => (l === correcta ? 'Esta es la opción correcta' : `Opción ${l} de ejemplo, incorrecta`)), correcta, 10, true, hoy]);
    }
  });
  return {
    // El quiz de entrada (PAB-000) va sin código y con 4 preguntas por stand; los demás pabellones piden código y sortean 2 por stand.
    Pabellones: [['pabellon_id', 'nombre', 'nombre_corto', 'descripcion', 'requiere_codigo', 'preguntas_por_stand', 'orden', 'activo', 'creado_en'],
      ...pabellones.map(([id, nombre], i) => [id, nombre, '', 'Descubre agentes de IA para aumentar tu productividad', id !== 'PAB-000', id === 'PAB-000' ? 4 : '', i, true, hoy])],
    Stands: [['stand_id', 'pabellon_id', 'nombre', 'descripcion', 'orden', 'activo', 'creado_en'],
      ...stands.map(([id, pab, nombre], i) => [id, pab, nombre, '', i, true, hoy])],
    Charlas: [['charla_id', 'titulo', 'ponente', 'descripcion', 'inicio', 'fin', 'cierre', 'preguntas_banco', 'preguntas_quiz', 'orden', 'activo', 'creado_en'],
      ...charlas.map(([id, titulo, ponente, desfase], i) => [id, titulo, ponente, 'Taller de ejemplo para la semana previa al evento.',
        // Cierra 2 horas después de empezar, pero nunca antes de una hora a partir de ahora (la primera ya empezó hace 2 horas).
        new Date(Date.now() + desfase), new Date(Date.now() + desfase + 3600000), new Date(Date.now() + (desfase < -3 * 3600000 ? desfase + 7200000 : Math.max(desfase + 7200000, 3600000))), 15, 5, i, true, hoy])],
    Preguntas: [['pregunta_id', 'stand_id', 'texto', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'correcta', 'puntos', 'activo', 'creado_en'], ...preguntas],
    Staff: [['email', 'nombre', 'rol', 'pabellon_id', 'stand_id', 'charla_id', 'activo'],
      ['admin@demo.com', 'Marta Salinas', 'ADMIN', '', '', '', true],
      ['lider.backend@demo.com', 'Rosa Quiroz', 'LIDER', 'PAB-001', '', '', true],
      ['expositor.apx@demo.com', 'Carlos Mendoza', 'EXPOSITOR', 'PAB-001', 'STD-001', '', true],
      ['ponente.uno@demo.com', 'Rosa Quiroz', 'PONENTE', '', '', 'CHA-001', true],
      ['validador@demo.com', 'Valeria Ortiz', 'VALIDADOR', '', '', '', true],
      ['juanmanuel.amancay@bbva.com', 'JUAN MANUEL AMANCAY', 'LIDER', 'PAB-007', '', '', true],
      ['juanmanuel.amancay@bbva.com', 'JUAN MANUEL AMANCAY', 'EXPOSITOR', 'PAB-007', 'STD-019', '', true],
      ['juanmanuel.amancay@bbva.com', 'JUAN MANUEL AMANCAY', 'PONENTE', '', '', 'CHA-003', true],
      ['validador.prueba@bbva.com', 'Validador De Prueba', 'VALIDADOR', '', '', '', true],
      // Rol que no existe en Permisos, para ver la página de error.
      ['sin.vistas@demo.com', 'Invitado De Prueba', 'INVITADO', '', '', '', true]],
    // CHARLAS=1: semana de charlas (el usuario solo ve la ruta); sin esa variable, el evento (el usuario ve el mapa).
    Permisos: [['rol', 'vista', 'activo'],
      ...(process.env.CHARLAS ? ['CHARLAS', 'QUIZ'] : ['MAPA', 'QUIZ']).map(v => ['USUARIO', v, true]),
      ['LIDER', 'GENERAR_CODIGO', true],
      ['EXPOSITOR', 'PREGUNTAS', true],
      ...['GENERAR_CODIGO', 'PREGUNTAS'].map(v => ['PONENTE', v, true]),
      ...['MAPA', 'QUIZ', 'PREGUNTAS', 'CHARLAS'].map(v => ['VALIDADOR', v, true]),
      ...['MAPA', 'CHARLAS', 'QUIZ', 'RANKING', 'GENERAR_CODIGO', 'PREGUNTAS', 'PANEL_ADMIN', 'ESPERA'].map(v => ['ADMIN', v, true])],
    Config: [['clave', 'valor', 'descripcion'], ['minutos_vigencia_codigo', 5, ''], ['minutos_para_responder', 5, ''],
      ['puntos_por_defecto', 10, ''], ['segundos_refresco_board', process.env.VIVO ? 10 : 15, ''], ['feria_abierta', true, ''],
      ['segundos_cache_ranking', process.env.VIVO ? 5 : 60, ''],
      // ESPERA=1 enciende la sala de espera; ESPERA=0 la deja con la fecha ya cumplida.
      ['espera_activa', !!process.env.ESPERA, ''],
      ['fecha_feria', new Date(Date.now() + (process.env.ESPERA === '0' ? -1000 : 3 * 86400000 + 5 * 3600000)), ''],
      ['lugar_feria', 'Auditorio principal, piso 3', ''], ['espera_mensaje', 'Trae tu celular con batería.', '']],
    Premios: [['orden', 'titulo', 'descripcion', 'activo'],
      [1, 'Primer puesto', 'Nintendo Switch', true], [2, 'Segundo puesto', 'Silla Gamer', true],
      [3, 'Tercer puesto', 'Monitor', true], [4, 'Cuarto puesto', 'Audífonos', true], [5, 'Premio retirado', 'No debe verse', false]],
    Usuarios: [['email', 'nombre', 'registrado_en', 'orden']],
    Codigos: [['codigo', 'unidad_id', 'generado_por', 'creado_en', 'expira_en', 'estado']],
    Intentos: [['intento_id', 'email', 'unidad_id', 'estado', 'puntaje', 'completado_en', 'correctas', 'pabellon_id', 'codigo', 'iniciado_en', 'vence_en', 'preguntas_json', 'respuestas_json'],
      ...(process.env.CHARLAS ? [Object.assign(intentoCompletado({ Intentos: [[]] }, 'ana.torres@demo.com', 'CHA-007', 4, Date.now() - 2 * 3600000), { 11: JSON.stringify([1, 2, 3, 4, 5]) })] : [])],
  };
}

/* ---------- Gente con puntajes, para ver el ranking ---------- */

const NOMBRES = ['Lucía', 'Mateo', 'Valentina', 'Sebastián', 'Camila', 'Diego', 'Isabella', 'Andrés', 'Daniela', 'Gabriel', 'Sofía', 'Joaquín',
  'Mariana', 'Nicolás', 'Paula', 'Rodrigo', 'Fernanda', 'Javier', 'Alejandra', 'Ricardo', 'Karla', 'Hugo', 'Natalia', 'Óscar', 'Renata', 'Luis'];
const APELLIDOS = ['Quispe', 'Ramírez', 'Huamán', 'Torres', 'Flores', 'Vargas', 'Castillo', 'Mendoza', 'Rojas', 'Salazar', 'Paredes', 'Guerra',
  'Cárdenas', 'Chávez', 'Zapata', 'Delgado', 'Fuentes', 'Ibáñez', 'Maldonado', 'Soto'];
const sinTildes = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Generador repetible: cada arranque del simulador arma el mismo ranking. */
function azar(semilla) {
  return () => { semilla = (semilla + 0x6D2B79F5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const sorteo = azar(2024);

/** Una persona que completó el quiz de una unidad (un pabellón), con unas respuestas correctas de 10 puntos. */
function intentoCompletado(tablas, email, unidad, correctas, cuando) {
  const id = 'INT-' + String(tablas.Intentos.length).padStart(5, '0');
  return [id, email, unidad, 'COMPLETADO', correctas * 10, cuando, correctas, unidad, '', new Date(cuando - 120000), new Date(cuando + 180000), '[]', '[]'];
}

/** Arma N personas con puntajes variados, algunos empates arriba, para que el podio y la cuadrícula tengan qué mostrar. */
function sembrarRanking(tablas, cuantas) {
  // Pabellones con código (sin el de entrada): cada persona completa algunos.
  const stands = tablas.Pabellones.slice(1).filter(f => f[4] !== false).map(f => f[0]);
  const ahora = Date.now();
  for (let i = 0; i < cuantas; i++) {
    const nombre = NOMBRES[i % NOMBRES.length] + ' ' + APELLIDOS[(i * 7 + Math.floor(i / NOMBRES.length)) % APELLIDOS.length] + (i >= NOMBRES.length * APELLIDOS.length ? ' ' + (i + 1) : '');
    const email = sinTildes(nombre).replace(/\s+/g, '.') + '@demo.com';
    tablas.Usuarios.push([email, nombre, new Date(ahora - 3600000), i + 1]);
    // Los primeros completan casi todo con buen puntaje; el resto, cada vez menos.
    const ritmo = 1 - i / Math.max(1, cuantas);
    const hechos = Math.max(1, Math.round(stands.length * (0.15 + 0.7 * ritmo * sorteo() + 0.15 * ritmo)));
    stands.slice().sort(() => sorteo() - 0.5).slice(0, hechos).forEach(stand => {
      const correctas = Math.min(8, Math.round(3 + 5 * ritmo + (sorteo() - 0.5) * 3));
      tablas.Intentos.push(intentoCompletado(tablas, email, stand, Math.max(0, correctas), ahora - Math.floor(sorteo() * 3000000)));
    });
  }
}

/* ---------- Servicios de Apps Script simulados ---------- */

/**
 * Con DESORDEN=1 los datos se cargan como los escribiría alguien a mano: pestañas y encabezados
 * con otras mayúsculas, roles y vistas en minúsculas, identificadores en minúsculas.
 * Sirve para comprobar que la app no depende de mayúsculas ni minúsculas.
 */
function desordenar(tablas) {
  const salida = {};
  Object.keys(tablas).forEach(nombre => {
    const [encabezados, ...filas] = tablas[nombre];
    salida[' ' + nombre.toUpperCase() + ' '] = [
      encabezados.map(e => ' ' + e.charAt(0).toUpperCase() + e.slice(1).toUpperCase() + ' '),
      ...filas.map(fila => fila.map((valor, c) => {
        if (typeof valor !== 'string') return valor === true ? 'verdadero' : valor;
        if (/^(rol|vista|clave|correcta)$/.test(encabezados[c]) || /_id$/.test(encabezados[c])) return ' ' + valor.toLowerCase() + ' ';
        return encabezados[c] === 'email' ? valor.toUpperCase() : valor;
      })),
    ];
  });
  return salida;
}

const tablasIniciales = datosDeEjemplo();
sembrarRanking(tablasIniciales, process.env.RANKING === undefined ? 40 : Number(process.env.RANKING) || 0);
const libro = new Libro(process.env.DESORDEN ? desordenar(tablasIniciales) : tablasIniciales);
const propiedades = {};
const cache = {};
let emailActual = '';

function plantilla(nombre) {
  const fuente = fs.readFileSync(path.join(RAIZ, nombre + '.html'), 'utf8');
  return {
    evaluate() {
      // Mismo lenguaje de plantillas que HtmlService: <? código ?>, <?= escapado ?>, <?!= sin escapar ?>
      let codigo = 'let __s = "";\n';
      fuente.split(/(<\?!?=?[\s\S]*?\?>)/).forEach(parte => {
        if (parte.startsWith('<?!=')) codigo += `__s += (${parte.slice(4, -2)});\n`;
        else if (parte.startsWith('<?=')) codigo += `__s += String(${parte.slice(3, -2)}).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));\n`;
        else if (parte.startsWith('<?')) codigo += parte.slice(2, -2) + '\n';
        else codigo += `__s += ${JSON.stringify(parte)};\n`;
      });
      const variables = Object.keys(this).filter(k => typeof this[k] !== 'function');
      const contenido = vm.runInContext(`(function(${variables.join(',')}){${codigo} return __s;})`, contexto)(...variables.map(k => this[k]));
      return salida(contenido);
    },
  };
}
function salida(contenido) {
  return { getContent: () => contenido, setTitle() { return this; }, addMetaTag() { return this; } };
}

// Caché propia de cada persona, separada por correo (como CacheService.getUserCache en Apps Script).
const cachesDeUsuario = {};
// Propiedades propias de cada persona (como PropertiesService.getUserProperties en Apps Script).
const propiedadesDeUsuario = {};
function propiedadesDe(email) {
  const mias = propiedadesDeUsuario[email] || (propiedadesDeUsuario[email] = {});
  return {
    getProperty: k => (k in mias ? mias[k] : null),
    getProperties: () => Object.assign({}, mias),
    setProperty: (k, v) => { mias[k] = String(v); },
    setProperties: (nuevas, borrarOtras) => {
      if (borrarOtras) Object.keys(mias).forEach(k => { delete mias[k]; });
      Object.keys(nuevas).forEach(k => { mias[k] = String(nuevas[k]); });
    },
    deleteProperty: k => { delete mias[k]; },
  };
}

const contexto = vm.createContext({
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => libro, openById: () => libro, flush: () => {} },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => (k in propiedades ? propiedades[k] : null),
      getProperties: () => Object.assign({}, propiedades),
      setProperty: (k, v) => { propiedades[k] = String(v); },
      setProperties: (nuevas, borrarOtras) => {
        if (borrarOtras) Object.keys(propiedades).forEach(k => { delete propiedades[k]; });
        Object.keys(nuevas).forEach(k => { propiedades[k] = String(nuevas[k]); });
      },
      deleteProperty: k => { delete propiedades[k]; },
    }),
    getUserProperties: () => propiedadesDe(emailActual),
  },
  CacheService: {
    getScriptCache: () => ({
      get: k => (cache[k] && cache[k].hasta > Date.now() ? cache[k].valor : null),
      put: (k, valor, segundos) => { cache[k] = { valor, hasta: Date.now() + segundos * 1000 }; },
      remove: k => { delete cache[k]; },
    }),
    getUserCache: () => {
      const propia = cachesDeUsuario[emailActual] || (cachesDeUsuario[emailActual] = {});
      return {
        get: k => (propia[k] && propia[k].hasta > Date.now() ? propia[k].valor : null),
        put: (k, valor, segundos) => { propia[k] = { valor, hasta: Date.now() + segundos * 1000 }; },
        remove: k => { delete propia[k]; },
      };
    },
  },
  // En el simulador todo corre en un solo proceso, así que los bloqueos no hacen nada; la prueba de concurrencia es el punto 5.2.
  LockService: {
    getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }),
    getUserLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }),
  },
  Session: {
    getActiveUser: () => ({ getEmail: () => emailActual }),
    // Igual que la app con executeAs USER_ACCESSING: la cuenta que ejecuta es la de quien entra.
    getEffectiveUser: () => ({ getEmail: () => emailActual }),
    getScriptTimeZone: () => 'America/Lima',
  },
  Utilities: { getUuid: () => require('crypto').randomUUID(), sleep: () => {}, formatDate: fecha => { const p = n => String(n).padStart(2, '0'); return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}_${p(fecha.getHours())}${p(fecha.getMinutes())}`; } },
  // Los disparadores no existen aquí: se aceptan y no hacen nada, para poder correr la parte inicial de las pruebas de carga.
  ScriptApp: {
    getService: () => ({ getUrl: () => 'http://localhost:' + PUERTO + '/?como=' + emailActual }),
    getProjectTriggers: () => [],
    deleteTrigger: () => {},
    newTrigger: () => { const t = { timeBased: () => t, at: () => t, after: () => t, everyMinutes: () => t, create: () => {} }; return t; },
  },
  HtmlService: {
    createTemplateFromFile: plantilla,
    createHtmlOutputFromFile: nombre => salida(fs.readFileSync(path.join(RAIZ, nombre + '.html'), 'utf8')),
    createHtmlOutput: salida,
  },
});

// Todos los .gs comparten un mismo ámbito global, igual que en Apps Script.
const fuentes = fs.readdirSync(RAIZ).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(RAIZ, f), 'utf8'));
vm.runInContext(fuentes.join('\n'), contexto, { filename: 'appscript.gs' });

/** Cada ejecución real empieza con las variables globales limpias; aquí se reinician a mano. */
function ejecutar(email, funcion, argumentos) {
  emailActual = email;
  vm.runInContext('GENERACION_ = null; CATALOGO_ = null; MIS_PROPIEDADES_ = null; EPOCA_ = null;', contexto);
  return vm.runInContext(funcion, contexto)(...argumentos);
}

/* ---------- Servidor web ---------- */

// Reemplazo de google.script.run en el navegador: llama a /run con el mismo nombre de función.
const CLIENTE = `<script>
  window.google = { script: { run: (function () {
    function crear(bien, mal) {
      return new Proxy({}, { get: function (_, nombre) {
        if (nombre === 'withSuccessHandler') return function (f) { return crear(f, mal); };
        if (nombre === 'withFailureHandler') return function (f) { return crear(bien, f); };
        return function () {
          fetch('/run' + location.search, { method: 'POST', body: JSON.stringify({ funcion: nombre, argumentos: Array.from(arguments) }) })
            .then(function (r) { return r.json(); })
            .then(function (r) { if (r.error) { if (mal) mal(new Error(r.error)); } else if (bien) bien(r.valor); })
            .catch(function (e) { if (mal) mal(e); });
        };
      } });
    }
    return crear(null, null);
  })() } };
</script>`;

http.createServer((peticion, respuesta) => {
  const url = new URL(peticion.url, 'http://localhost');
  const email = (url.searchParams.get('como') || 'ana.torres@demo.com').toLowerCase();

  if (peticion.method === 'GET' && url.pathname === '/') {
    const html = ejecutar(email, 'doGet', []).getContent()
      .replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1">' + CLIENTE);
    respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return respuesta.end(html);
  }

  if (peticion.method === 'POST' && url.pathname === '/run') {
    let cuerpo = '';
    peticion.on('data', trozo => { cuerpo += trozo; });
    peticion.on('end', () => {
      let resultado;
      try {
        const { funcion, argumentos } = JSON.parse(cuerpo);
        // Igual que Apps Script: las funciones que terminan en "_" no se pueden llamar desde el navegador.
        if (!/^[A-Za-z]\w*[A-Za-z0-9]$/.test(funcion)) throw new Error('Función no disponible.');
        resultado = { valor: ejecutar(email, funcion, argumentos || []) };
      } catch (error) {
        resultado = { error: error.message };
      }
      respuesta.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      respuesta.end(JSON.stringify(resultado === undefined ? {} : resultado));
    });
    return;
  }

  // Solo para pruebas: ver el contenido de una hoja, por ejemplo /hoja?nombre=Intentos
  if (peticion.method === 'GET' && url.pathname === '/hoja') {
    const hoja = libro.getSheetByName(url.searchParams.get('nombre') || '');
    respuesta.writeHead(hoja ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
    return respuesta.end(JSON.stringify(hoja ? hoja.datos : { hojas: libro.hojas.map(h => h.nombre) }));
  }

  // Solo para pruebas: agregar una fila como si se escribiera a mano en el Sheet.
  // POST /hoja?nombre=Staff con el cuerpo ["correo@demo.com","Nombre","LIDER","PAB-001","STD-001",true]
  if (peticion.method === 'POST' && url.pathname === '/hoja') {
    let cuerpo = '';
    peticion.on('data', trozo => { cuerpo += trozo; });
    peticion.on('end', () => {
      const hoja = libro.getSheetByName(url.searchParams.get('nombre') || '');
      if (hoja) hoja.appendRow(JSON.parse(cuerpo));
      respuesta.writeHead(hoja ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
      respuesta.end(JSON.stringify({ ok: !!hoja }));
    });
    return;
  }

  respuesta.writeHead(404);
  respuesta.end();
}).listen(PUERTO, () => console.log('Simulador en http://localhost:' + PUERTO));

// VIVO=1: cada pocos segundos alguien completa un quiz que le faltaba, como pasaría en la feria.
if (process.env.VIVO && !process.env.DESORDEN) {
  const usuarios = libro.getSheetByName('Usuarios');
  const intentos = libro.getSheetByName('Intentos');
  setInterval(() => {
    const personas = usuarios.datos.slice(1).filter(f => f && f[0]);
    if (!personas.length) return;
    const email = personas[Math.floor(Math.random() * personas.length)][0];
    const hechos = new Set(intentos.datos.filter(f => f && f[1] === email).map(f => f[2]));
    const faltan = libro.getSheetByName('Pabellones').datos.slice(2).map(f => f[0]).filter(id => !hechos.has(id));
    if (!faltan.length) return;
    const unidad = faltan[Math.floor(Math.random() * faltan.length)];
    const correctas = 4 + Math.floor(Math.random() * 5);
    intentos.appendRow(intentoCompletado({ Intentos: intentos.datos }, email, unidad, correctas, Date.now()));
    console.log(`+${correctas * 10} pts para ${email} (${unidad})`);
  }, 4000);
}

// Para pruebas automáticas que cargan este archivo con require (ver docs/arquitectura/apps-script.md, simulador local).
module.exports = { ejecutar, contexto, propiedades, libro };
