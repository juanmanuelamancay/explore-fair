/**
 * Simulador local del proyecto Apps Script. Ejecuta los .gs reales de ../appscript con
 * hojas en memoria y sirve la web app en http://localhost:8123, sin desplegar nada.
 *
 *   node simulador/servidor.js
 *
 * Para entrar como otra persona: http://localhost:8123/?como=lider.apx@demo.com
 * Cuentas de ejemplo: ana.torres@demo.com (usuario), lider.apx@demo.com (líder de un stand),
 * lider.backend@demo.com (líder de pabellón), admin@demo.com (admin).
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
  clearContent() { return this.setValues(Array.from({ length: this.filas }, () => Array(this.columnas).fill(''))); }
}

class Hoja {
  constructor(libro, nombre, datos) { Object.assign(this, { libro, nombre, datos, oculta: false }); }
  getLastColumn() { return Math.max(0, ...this.datos.map(f => f.length)); }
  getLastRow() {
    for (let i = this.datos.length - 1; i >= 0; i--) if (this.datos[i].some(v => v !== '' && v != null)) return i + 1;
    return 0;
  }
  getDataRange() { return new Rango(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(fila, columna, filas = 1, columnas = 1) { return new Rango(this, fila, columna, filas, columnas); }
  appendRow(fila) { this.datos.length = this.getLastRow(); this.datos.push(fila.slice()); return this; }
  deleteRow(fila) { this.datos.splice(fila - 1, 1); return this; }
  copyTo(libro) { const copia = new Hoja(libro, 'Copia de ' + this.nombre, this.datos.map(f => f.slice())); libro.hojas.push(copia); return copia; }
  setName(nombre) { this.nombre = nombre; return this; }
  getName() { return this.nombre; }
  hideSheet() { this.oculta = true; return this; }
}

class Libro {
  constructor(tablas) { this.hojas = Object.keys(tablas).map(n => new Hoja(this, n, tablas[n])); }
  getSheetByName(nombre) { return this.hojas.find(h => h.nombre === nombre) || null; }
  getSheets() { return this.hojas; }
  getName() { return 'Sheet simulado'; }
  getUrl() { return 'http://localhost:' + PUERTO + '/hoja'; }
}

/* ---------- Datos de ejemplo ---------- */

function datosDeEjemplo() {
  const hoy = new Date();
  const pabellones = [['PAB-000', 'General'], ['PAB-001', 'Backend'], ['PAB-002', 'Frontend'], ['PAB-003', 'Quality'], ['PAB-004', 'Seguridad'], ['PAB-005', 'Data'], ['PAB-006', 'Host']];
  const stands = [
    ['STD-000', 'PAB-000', 'Quiz de entrada', false, 5],
    ['STD-001', 'PAB-001', 'APX'], ['STD-002', 'PAB-001', 'ASO / APIs'], ['STD-003', 'PAB-001', 'LRA / LRBA'],
    ['STD-004', 'PAB-002', 'Cells'], ['STD-005', 'PAB-002', 'Glomo'], ['STD-006', 'PAB-002', 'Emailing'],
    ['STD-007', 'PAB-003', 'Testing'], ['STD-008', 'PAB-003', 'QE'], ['STD-009', 'PAB-003', 'Code Review'],
    ['STD-010', 'PAB-004', 'SAST'], ['STD-011', 'PAB-004', 'Security'], ['STD-012', 'PAB-004', 'Gobierno'], ['STD-013', 'PAB-004', 'Quality'],
    ['STD-014', 'PAB-005', 'ADA'], ['STD-015', 'PAB-005', 'Data & Analytics'], ['STD-016', 'PAB-005', 'Gobierno de Datos'],
    ['STD-017', 'PAB-006', 'Synapse'], ['STD-018', 'PAB-006', 'Katalyst'], ['STD-019', 'PAB-006', 'Control-M'],
  ];
  const preguntas = [];
  stands.forEach(([id, , nombre]) => {
    for (let n = 1; n <= 16; n++) {
      const correcta = 'ABCD'[(n - 1) % 4];
      preguntas.push(['PRG-' + String(preguntas.length + 1).padStart(3, '0'), id, `Pregunta ${n} de ejemplo sobre ${nombre}: ¿cuál es la opción correcta?`,
        ...'ABCD'.split('').map(l => (l === correcta ? 'Esta es la opción correcta' : `Opción ${l} de ejemplo, incorrecta`)), correcta, 10, true, hoy]);
    }
  });
  return {
    Pabellones: [['pabellon_id', 'nombre', 'descripcion', 'orden', 'activo', 'creado_en'], ...pabellones.map(([id, nombre], i) => [id, nombre, '', i, true, hoy])],
    Stands: [['stand_id', 'pabellon_id', 'nombre', 'descripcion', 'requiere_codigo', 'num_preguntas', 'orden', 'activo', 'creado_en'],
      ...stands.map(([id, pab, nombre, codigo = true, num = 4], i) => [id, pab, nombre, '', codigo, num, i, true, hoy])],
    Preguntas: [['pregunta_id', 'stand_id', 'texto', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'correcta', 'puntos', 'activo', 'creado_en'], ...preguntas],
    Staff: [['email', 'nombre', 'rol', 'pabellon_id', 'stand_id', 'activo'],
      ['admin@demo.com', 'Marta Salinas', 'ADMIN', '', '', true],
      ['lider.apx@demo.com', 'Carlos Mendoza', 'LIDER', 'PAB-001', 'STD-001', true],
      ['lider.backend@demo.com', 'Rosa Quiroz', 'LIDER', 'PAB-001', '', true],
      ['prueba@demo.com', 'Paula Prueba', 'PRUEBA', '', '', true],
      // Rol que no existe en Permisos, para ver la página de error.
      ['sin.vistas@demo.com', 'Invitado De Prueba', 'INVITADO', '', '', true]],
    Permisos: [['rol', 'vista', 'activo'],
      ...['MAPA', 'QUIZ', 'RANKING'].map(v => ['USUARIO', v, true]),
      ...['GENERAR_CODIGO', 'RANKING'].map(v => ['LIDER', v, true]),
      ...['MAPA', 'QUIZ', 'RANKING'].map(v => ['PRUEBA', v, true]),
      ...['MAPA', 'QUIZ', 'RANKING', 'GENERAR_CODIGO', 'PANEL_ADMIN', 'BOARD'].map(v => ['ADMIN', v, true])],
    Config: [['clave', 'valor', 'descripcion'], ['minutos_vigencia_codigo', 5, ''], ['minutos_para_responder', 5, ''],
      ['puntos_por_defecto', 10, ''], ['segundos_refresco_board', 15, ''], ['feria_abierta', true, ''],
      // ESPERA=1 enciende la sala de espera; ESPERA=0 la deja con la fecha ya cumplida.
      ['espera_activa', !!process.env.ESPERA, ''],
      ['fecha_feria', new Date(Date.now() + (process.env.ESPERA === '0' ? -1000 : 3 * 86400000 + 5 * 3600000)), ''],
      ['lugar_feria', 'Auditorio principal, piso 3', ''], ['espera_mensaje', 'Trae tu celular con batería.', '']],
    Premios: [['orden', 'titulo', 'descripcion', 'activo'],
      [1, 'Primer puesto', 'Audífonos inalámbricos', true], [2, 'Segundo puesto', 'Mochila', true],
      [3, 'Tercer puesto', 'Kit de la feria', true], [5, 'Cuarto puesto', 'Mención especial', true], [4, 'Premio retirado', 'No debe verse', false]],
    Usuarios: [['email', 'nombre', 'registrado_en']],
    Codigos: [['codigo', 'stand_id', 'generado_por', 'creado_en', 'expira_en', 'estado']],
    Intentos: [['intento_id', 'email', 'stand_id', 'pabellon_id', 'codigo', 'preguntas_json', 'iniciado_en', 'vence_en', 'estado', 'respuestas_json', 'correctas', 'puntaje', 'completado_en']],
  };
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

const libro = new Libro(process.env.DESORDEN ? desordenar(datosDeEjemplo()) : datosDeEjemplo());
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

const contexto = vm.createContext({
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => libro, openById: () => libro },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in propiedades ? propiedades[k] : null), setProperty: (k, v) => { propiedades[k] = String(v); } }) },
  CacheService: { getScriptCache: () => ({
    get: k => (cache[k] && cache[k].hasta > Date.now() ? cache[k].valor : null),
    put: (k, valor, segundos) => { cache[k] = { valor, hasta: Date.now() + segundos * 1000 }; },
    remove: k => { delete cache[k]; },
  }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Session: {
    getActiveUser: () => ({ getEmail: () => emailActual }),
    getEffectiveUser: () => ({ getEmail: () => 'quien.despliega@demo.com' }),
    getScriptTimeZone: () => 'America/Lima',
  },
  Utilities: { formatDate: fecha => { const p = n => String(n).padStart(2, '0'); return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}_${p(fecha.getHours())}${p(fecha.getMinutes())}`; } },
  ScriptApp: { getService: () => ({ getUrl: () => 'http://localhost:' + PUERTO + '/?como=' + emailActual }) },
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
  vm.runInContext('GENERACION_ = null; CATALOGO_ = null;', contexto);
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
