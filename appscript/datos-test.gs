/**
 * Diagnóstico. Se ejecuta a mano desde el editor de Apps Script: elegir "probarTodo"
 * en el selector de funciones, pulsar Ejecutar y leer el registro de ejecución.
 * Solo lee y escribe en el registro: no modifica ninguna hoja ni devuelve datos al navegador.
 */

// Encabezados que el código espera encontrar en la fila 1 de cada hoja.
const ENCABEZADOS_ESPERADOS = {
  Pabellones: ['pabellon_id', 'nombre', 'orden', 'activo'],
  Stands: ['stand_id', 'pabellon_id', 'nombre', 'requiere_codigo', 'num_preguntas', 'orden', 'activo'],
  Preguntas: ['pregunta_id', 'stand_id', 'texto', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'correcta', 'puntos', 'activo'],
  Staff: ['email', 'nombre', 'rol', 'pabellon_id', 'stand_id', 'activo'],
  Permisos: ['rol', 'vista', 'activo'],
  Config: ['clave', 'valor'],
  Usuarios: ['email', 'nombre', 'registrado_en', 'orden'],
  Codigos: ['codigo', 'stand_id', 'generado_por', 'creado_en', 'expira_en', 'estado'],
  Premios: ['orden', 'titulo', 'descripcion', 'activo'],
  Intentos: ['intento_id', 'email', 'stand_id', 'pabellon_id', 'codigo', 'preguntas_json', 'iniciado_en', 'vence_en', 'estado', 'respuestas_json', 'correctas', 'puntaje', 'completado_en'],
};

/** Ejecuta un paso y registra si pasó o por qué falló, sin detener los siguientes. */
function paso_(titulo, accion) {
  try {
    const detalle = accion();
    console.log('OK     ' + titulo + (detalle ? ' -> ' + detalle : ''));
    return true;
  } catch (error) {
    console.error('FALLA  ' + titulo + ' -> ' + error.message);
    return false;
  }
}

function probarTodo() {
  exigirAdmin_();
  console.log('===== Diagnóstico de Explore Fair =====');
  console.log('Versión del código: ' + (typeof VERSION_DEL_CODIGO === 'undefined' ? '(main.gs sin actualizar)' : VERSION_DEL_CODIGO));
  if (probarSheet()) {
    probarHojas();
    probarCatalogo();
    probarPreguntas();
  }
  probarSesion();
  probarCache();
  console.log('===== Fin =====');
}

/** ¿El script encuentra y puede abrir el Sheet? */
function probarSheet() {
  exigirAdmin_();
  console.log('--- Sheet ---');
  paso_('ID_DEL_SHEET definido en datos.gs', () => {
    if (typeof ID_DEL_SHEET === 'undefined') throw new Error('No existe ID_DEL_SHEET: datos.gs sigue con la versión anterior.');
    return ID_DEL_SHEET;
  });
  paso_('Propiedad SPREADSHEET_ID', () => PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '(vacía, se usa ID_DEL_SHEET)');
  paso_('Sheet ligado al script', () => {
    const activo = SpreadsheetApp.getActiveSpreadsheet();
    return activo ? activo.getName() : 'ninguno: el script es independiente, es normal';
  });
  return paso_('Abrir el Sheet con libro_()', () => {
    const libro = libro_();
    if (!libro) throw new Error('libro_() devolvió null: se está ejecutando la versión anterior de libro_.');
    return '"' + libro.getName() + '" · ' + libro.getUrl();
  });
}

/** ¿Están las diez hojas, con sus encabezados? */
function probarHojas() {
  exigirAdmin_();
  console.log('--- Hojas ---');
  paso_('Pestañas del archivo', () => libro_().getSheets().map(h => h.getName()).join(', '));
  Object.keys(ENCABEZADOS_ESPERADOS).forEach(nombre => {
    paso_('Hoja ' + nombre, () => {
      const hoja = hojaSiExiste_(nombre);
      if (!hoja) throw new Error('no existe una pestaña con ese nombre exacto');
      const encontrados = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0].map(normal_);
      const faltan = ENCABEZADOS_ESPERADOS[nombre].filter(e => encontrados.indexOf(e) < 0);
      if (faltan.length) throw new Error('faltan columnas: ' + faltan.join(', ') + ' · encontradas: ' + encontrados.join(', '));
      return Math.max(0, hoja.getLastRow() - 1) + ' filas';
    });
  });
  paso_('Filas propias en Intentos', () => {
    const enHoja = usuariosEnHoja_();
    const correos = Object.keys(enHoja);
    const sinNumero = correos.filter(email => !enHoja[email].orden);
    const numeros = correos.map(email => enHoja[email].orden).filter(Boolean);
    const repetidos = numeros.filter((n, i) => numeros.indexOf(n) !== i);
    if (repetidos.length) throw new Error('números de orden repetidos en Usuarios: ' + repetidos.join(', '));
    // El número que manda es el del marcador de cada correo en las propiedades del script; la columna es su copia.
    const todas = buzon_().getProperties();
    const marcadores = Object.keys(todas).filter(clave => clave.indexOf(PREFIJO_ORDEN) === 0);
    const distintos = correos.filter(email => enHoja[email].orden && parseInt(todas[PREFIJO_ORDEN + email], 10) !== enHoja[email].orden);
    if (distintos.length) throw new Error('la columna orden no coincide con el número entregado para: ' + distintos.slice(0, 10).join(', ') + '. Con Intentos vacía, ejecuta prepararFeria.');
    const total = hoja_(HOJA.INTENTOS).getMaxRows();
    return 'bloques de ' + FILAS_POR_PERSONA + ' filas · último número de orden entregado: ' + ultimoOrden_() + ' · personas con número: ' + marcadores.length +
      ' · con número y sin fila en Usuarios: ' + marcadores.filter(clave => !(clave.slice(PREFIJO_ORDEN.length) in enHoja)).length + ' · filas de Usuarios sin número: ' + sinNumero.length + ' · Intentos tiene ' + total + ' filas, para ' + Math.floor((total - 1) / FILAS_POR_PERSONA) + ' personas sin agrandarse';
  });
}

/** ¿El catálogo se lee como espera la app? */
function probarCatalogo() {
  exigirAdmin_();
  console.log('--- Catálogo (leído directo de las hojas, sin caché) ---');
  CATALOGO_ = leerCatalogo_();
  paso_('Config', () => JSON.stringify(catalogo_().config));
  paso_('Pabellones activos', () => catalogo_().pabellones.map(p => p.id + ' ' + p.nombre).join(' | ') || 'NINGUNO');
  paso_('Stands activos', () => catalogo_().stands.length + ' en total');
  paso_('Quiz de entrada (stand con requiere_codigo = FALSE)', () => {
    const entrada = catalogo_().stands.find(s => !s.requiereCodigo);
    if (!entrada) throw new Error('ningún stand activo tiene requiere_codigo en FALSE');
    return entrada.id + ' ' + entrada.nombre;
  });
  paso_('Pabellones que salen en el mapa', () => {
    const delMapa = pabellonesDelMapa_(catalogo_());
    if (!delMapa.length) throw new Error('ninguno: revisa pabellon_id y activo en Stands');
    return delMapa.map(p => p.nombre + ' (' + p.stands.length + ' stands)').join(' | ');
  });
  paso_('Staff activo', () => catalogo_().staff.map(s => s.email + ' ' + s.rol).join(' | ') || 'NINGUNO: falta escribir el primer ADMIN');
  paso_('Permisos por rol', () => {
    const porRol = {};
    catalogo_().permisos.forEach(p => { (porRol[p.rol] = porRol[p.rol] || []).push(p.vista); });
    if (!porRol.USUARIO) throw new Error('el rol USUARIO no tiene vistas: revisa la hoja Permisos');
    return Object.keys(porRol).map(r => r + ': ' + porRol[r].join(',')).join(' | ');
  });
}

/** ¿Cada stand tiene suficientes preguntas activas y bien marcadas? */
function probarPreguntas() {
  exigirAdmin_();
  console.log('--- Preguntas ---');
  catalogo_().stands.forEach(stand => {
    paso_(stand.id + ' ' + stand.nombre, () => {
      const banco = preguntasDeStand_(stand.id);
      const malas = banco.filter(p => 'ABCD'.indexOf(p.correcta) < 0 || p.correcta.length !== 1).map(p => p.id);
      if (malas.length) throw new Error('columna "correcta" inválida en: ' + malas.join(', '));
      if (banco.length < PREGUNTAS_POR_BANCO) throw new Error('tiene ' + banco.length + ' preguntas activas y necesita ' + PREGUNTAS_POR_BANCO);
      return banco.length + ' preguntas, usa ' + stand.numPreguntas;
    });
  });
}

/** ¿La app reconoce a quien ejecuta y le asigna rol, vistas y nombre? */
function probarSesion() {
  exigirAdmin_();
  console.log('--- Sesión (la tuya, al ejecutar desde el editor) ---');
  paso_('Correo de quien ejecuta', () => {
    const email = Session.getActiveUser().getEmail();
    if (!email) throw new Error('vacío: la cuenta no permite identificar al usuario');
    return email + ' · el script corre como ' + Session.getEffectiveUser().getEmail();
  });
  paso_('Rol y vistas', () => {
    const sesion = sesion_();
    if (!sesion.vistas.length) throw new Error('rol ' + sesion.rol + ' sin vistas en Permisos');
    return sesion.rol + ' · ' + sesion.vistas.join(', ');
  });
  paso_('Nombre en el directorio', () => nombreDeDirectorio_(sesion_().email) || '(no disponible, se usará el deducido del correo)');
  paso_('Nombre deducido del correo', () => nombreDesdeEmail_(sesion_().email));
}

/** ¿Funcionan la caché y el bloqueo? */
function probarCache() {
  exigirAdmin_();
  console.log('--- Caché y bloqueo ---');
  paso_('Caché', () => {
    cachePoner_('prueba', { ok: true }, 30);
    const leido = cacheLeer_('prueba');
    cacheQuitar_('prueba');
    if (!leido || !leido.ok) throw new Error('no devolvió lo guardado');
  });
  paso_('Bloqueo', () => {
    const bloqueo = LockService.getScriptLock();
    bloqueo.waitLock(5000);
    bloqueo.releaseLock();
  });
  paso_('Registros pendientes de escribir en Usuarios', () => leerBuzon_().length + ' cartas en el buzón');
}

/**
 * ¿Funciona el límite de intentos de código con la caché y el bloqueo reales? Usa tu propia cuenta: hace 4 intentos
 * seguidos con "0000", un código que la app nunca genera, y espera CODIGO, CODIGO, BLOQUEADO, BLOQUEADO.
 * No escribe en ninguna hoja; al terminar borra el contador de fallos de tu cuenta.
 */
function probarLimiteDeCodigos() {
  exigirAdmin_();
  console.log('--- Límite de intentos de código (' + FALLOS_DE_CODIGO_MAX + ' fallos = ' + SEGUNDOS_BLOQUEO_CODIGO + ' s) ---');
  const stand = catalogo_().stands.find(s => s.requiereCodigo);
  if (!stand) { console.error('FALLA  No hay ningún stand activo con código'); return; }
  const cacheMia = CacheService.getUserCache();
  cacheMia.remove(CLAVE_FALLOS_CODIGO);
  try {
    paso_('Cuatro intentos seguidos con un código imposible', () => {
      const esperado = ['CODIGO', 'CODIGO', 'BLOQUEADO', 'BLOQUEADO'];
      const obtenido = esperado.map(() => (revisarCodigo_(stand.id, '0000') || { motivo: 'VALIDO' }).motivo);
      if (obtenido.join() !== esperado.join()) throw new Error('salió ' + obtenido.join(', ') + ' y se esperaba ' + esperado.join(', '));
      return obtenido.join(', ');
    });
    paso_('Un campo vacío no cuenta como intento', () => {
      cacheMia.remove(CLAVE_FALLOS_CODIGO);
      const motivos = [1, 2, 3, 4].map(() => revisarCodigo_(stand.id, '  ').motivo);
      if (motivos.some(m => m !== 'CODIGO')) throw new Error('salió ' + motivos.join(', '));
      if (cacheMia.get(CLAVE_FALLOS_CODIGO)) throw new Error('el contador de fallos no debería existir');
    });
  } finally {
    cacheMia.remove(CLAVE_FALLOS_CODIGO);
  }
  console.log('Contador de fallos de tu cuenta borrado.');
}
