/**
 * Vista PANEL_ADMIN: editor jerárquico del catálogo y reinicio de datos transaccionales.
 */

const PALABRA_DE_REINICIO = 'REINICIAR';
const PALABRA_DE_PREPARACION = 'PREPARAR';
const PALABRA_DE_BORRADO = 'BORRAR';
// Las hojas de respaldo que crea reiniciarDatos empiezan así.
const PREFIJO_DE_RESPALDO = 'respaldo_';
// Hojas que borra el reinicio. Usuarios se conserva: quien ya se registró no vuelve a escribir al entrar.
// Las de catálogo nunca se tocan.
// Van como texto y no como HOJA.X porque el orden en que Apps Script carga los archivos no está garantizado.
const HOJAS_A_REINICIAR = ['Intentos', 'Codigos'];
const SEGUNDOS_BLOQUEO_REINICIO = 30000;

function conteos_() {
  const conteos = {};
  // Intentos tiene filas vacías entre los bloques de cada persona: se cuentan las que tienen dato.
  HOJAS_A_REINICIAR.forEach(nombre => { conteos[nombre] = filasConDato_(nombre); });
  return conteos;
}

function ultimoReinicio_() {
  const guardado = PropertiesService.getScriptProperties().getProperty('ULTIMO_REINICIO');
  return guardado ? JSON.parse(guardado) : null;
}

/** Personas con fila en Usuarios y cartas del buzón que todavía no llegaron a la hoja (registro.gs). */
function registro_() {
  return { registrados: filasConDato_('Usuarios'), pendientes: leerBuzon_().length };
}

/** Hojas de respaldo (ocultas) que dejaron los reinicios. */
function respaldos_() {
  return libro_().getSheets().filter(h => h.getName().toLowerCase().indexOf(PREFIJO_DE_RESPALDO) === 0);
}

function obtenerPanel() {
  exigirVista_('PANEL_ADMIN');
  return { conteos: conteos_(), ultimo: ultimoReinicio_(), registro: registro_(), respaldos: respaldos_().length };
}

/**
 * Borra las hojas de respaldo que guardan los reinicios (respaldo_Intentos_..., respaldo_Codigos_...). Cada reinicio
 * copia las hojas enteras y con el tiempo ocupan celdas del Sheet, que tiene un límite. No se puede deshacer.
 * Solo toca hojas cuyo nombre empieza por "respaldo_": ni el catálogo ni los datos vivos.
 */
function borrarRespaldos(palabra) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede borrar los respaldos.');
  if (texto_(palabra).toUpperCase() !== PALABRA_DE_BORRADO) throw new Error('La palabra de confirmación no coincide.');
  const libro = libro_();
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO_REINICIO);
  try {
    const hojas = respaldos_();
    hojas.forEach(hoja => libro.deleteSheet(hoja));
    SpreadsheetApp.flush();
    return { borradas: hojas.length, respaldos: respaldos_().length };
  } finally {
    bloqueo.releaseLock();
  }
}

/** Escribe ahora en Usuarios las cartas pendientes, sin esperar a que entre otra persona. */
function registrarPendientes() {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede hacer esto.');
  repartir_(true);
  return registro_();
}

/** Descarta la caché, relee las hojas de catálogo y deja listas las preguntas de cada banco (stands y charlas) y los premios. Devuelve qué encontró. */
function actualizarCatalogo() {
  exigirVista_('PANEL_ADMIN');
  limpiarCache_();
  const catalogo = catalogo_();
  const standsListos = precargarPreguntasYPremios_();
  return {
    pabellones: catalogo.pabellones.length,
    stands: catalogo.stands.length,
    charlas: charlasDe_(catalogo).length,
    preguntas: leerHoja_(HOJA.PREGUNTAS).filter(p => esVerdadero_(p.activo)).length,
    standsListos: standsListos,
  };
}

/**
 * Copia Intentos y Codigos a hojas de respaldo ocultas y luego borra sus filas.
 * Los encabezados se conservan. Usuarios no se toca: cada persona conserva su número de orden,
 * y con él su mismo bloque de filas en Intentos.
 */
function reiniciarDatos(palabra) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede reiniciar los datos.');
  if (texto_(palabra).toUpperCase() !== PALABRA_DE_REINICIO) throw new Error('La palabra de confirmación no coincide.');

  const libro = libro_();
  const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
  const borradas = {};

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO_REINICIO);
  try {
    HOJAS_A_REINICIAR.forEach(nombre => {
      const hoja = hoja_(nombre);
      // Se borra hasta la última fila con dato; lo que se informa es cuántas filas tenían dato.
      const filas = Math.max(0, hoja.getLastRow() - 1);
      borradas[nombre] = filasConDato_(nombre);
      if (!filas) return;
      // En Codigos las filas que solo traen stand_id no tienen nada que respaldar.
      const hayQueRespaldar = nombre === HOJA.CODIGOS ? borradas[nombre] > 0 : true;
      if (hayQueRespaldar) hoja.copyTo(libro).setName('respaldo_' + nombre + '_' + sello).hideSheet();
      hoja.getRange(2, 1, filas, hoja.getLastColumn()).clearContent();
    });
    const ultimo = { cuando: Date.now(), por: sesion.email };
    PropertiesService.getScriptProperties().setProperty('ULTIMO_REINICIO', JSON.stringify(ultimo));
    EPOCA_ = null;
    // Invalida ranking y catálogo en caché.
    limpiarCache_();
    // Codigos queda con exactamente una fila por stand con código, lista para generar sin turno (ver generar-codigo.gs).
    crearFilasDeCodigos_(catalogo_());
    return { borradas: borradas, respaldo: 'respaldo_' + sello, conteos: conteos_(), ultimo: ultimo, respaldos: respaldos_().length };
  } finally {
    bloqueo.releaseLock();
  }
}

/**
 * Botón "Preparar feria" del panel: el mismo trabajo que prepararFeria() desde el editor, con la vista del panel y la
 * palabra de confirmación. Renumera Usuarios desde 1, así que pide escribir PREPARAR antes de hacer nada.
 */
function prepararFeriaPanel(palabra) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede preparar la feria.');
  if (texto_(palabra).toUpperCase() !== PALABRA_DE_PREPARACION) throw new Error('La palabra de confirmación no coincide.');
  const preparada = prepararFeria();
  return { preparada: preparada, conteos: conteos_(), ultimo: ultimoReinicio_(), registro: registro_() };
}

/* ---------- Editor del catálogo ---------- */

const ADMIN_DEFINICIONES = {
  pabellones: { hoja: HOJA.PABELLONES, campos: ['pabellon_id', 'nombre', 'nombre_corto', 'descripcion', 'requiere_codigo', 'preguntas_por_stand', 'orden', 'activo'] },
  stands: { hoja: HOJA.STANDS, campos: ['stand_id', 'pabellon_id', 'nombre', 'descripcion', 'orden', 'activo'] },
  charlas: { hoja: HOJA.CHARLAS, campos: ['charla_id', 'titulo', 'ponente', 'descripcion', 'inicio', 'fin', 'cierre', 'preguntas_banco', 'preguntas_quiz', 'orden', 'activo'] },
  preguntas: { hoja: HOJA.PREGUNTAS, campos: ['pregunta_id', 'stand_id', 'texto', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'correcta', 'puntos', 'activo'] },
  staff: { hoja: HOJA.STAFF, campos: ['email', 'nombre', 'rol', 'pabellon_id', 'stand_id', 'charla_id', 'activo'] },
  permisos: { hoja: HOJA.PERMISOS, campos: ['rol', 'vista', 'activo'] },
  config: { hoja: HOJA.CONFIG, campos: ['clave', 'valor', 'descripcion'] },
  premios: { hoja: HOJA.PREMIOS, campos: ['orden', 'titulo', 'descripcion', 'activo'] },
};

const ADMIN_CAMPOS_ID = {
  pabellones: 'pabellon_id',
  stands: 'stand_id',
  charlas: 'charla_id',
  preguntas: 'pregunta_id',
};

// Hojas opcionales: sin ellas el panel las muestra vacías y no deja guardar hasta crearlas.
const ADMIN_HOJAS_OPCIONALES = { premios: 'Premios', charlas: 'Charlas' };

function adminDefinicion_(entidad) {
  const def = ADMIN_DEFINICIONES[texto_(entidad).toLowerCase()];
  if (!def) throw new Error('La sección solicitada no existe.');
  return def;
}

function adminValor_(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  }
  return valor;
}

function adminFila_(fila, campos) {
  const resultado = { _fila: fila._fila };
  campos.forEach(campo => { resultado[campo] = adminValor_(fila[campo] === undefined ? '' : fila[campo]); });
  return resultado;
}

function adminFilas_(entidad) {
  const def = adminDefinicion_(entidad);
  if (ADMIN_HOJAS_OPCIONALES[entidad] && !hojaSiExiste_(def.hoja)) return [];
  return leerHoja_(def.hoja).map(fila => adminFila_(fila, def.campos));
}

/** Devuelve el catálogo editable sin fechas Date ni columnas internas innecesarias, más lo que falta por cargar. */
function obtenerAdminCatalogo() {
  exigirVista_('PANEL_ADMIN');
  const datos = {};
  Object.keys(ADMIN_DEFINICIONES).forEach(entidad => { datos[entidad] = adminFilas_(entidad); });
  datos.avance = adminAvance_(datos);
  return datos;
}

/**
 * Lo que falta antes de abrir: cuántas preguntas activas tiene cada banco frente a lo que necesita, y qué pabellones, stands y
 * charlas no tienen a nadie asignado en Staff. Solo lee lo que el panel ya leyó; no escribe.
 */
function adminAvance_(datos) {
  const config = catalogo_().config;
  const activa = fila => adminBooleano_(fila, 'activo');
  const activasPorBanco = {};
  datos.preguntas.filter(activa).forEach(q => { activasPorBanco[q.stand_id] = (activasPorBanco[q.stand_id] || 0) + 1; });
  const preguntas = {};
  datos.stands.filter(activa).forEach(s => {
    preguntas[s.stand_id] = { activas: activasPorBanco[s.stand_id] || 0, necesita: Math.max(PREGUNTAS_BANCO_STAND, config.preguntas_por_stand) };
  });
  datos.charlas.filter(activa).forEach(c => {
    const banco = Math.floor(Number(c.preguntas_banco)) > 0 ? Math.floor(Number(c.preguntas_banco)) : config.preguntas_banco_charla;
    preguntas[c.charla_id] = { activas: activasPorBanco[c.charla_id] || 0, necesita: banco };
  });
  const quienes = (rol, campo) => {
    const asignados = {};
    datos.staff.filter(f => activa(f) && texto_(f.rol).toUpperCase() === rol).forEach(f => { asignados[id_(f[campo])] = true; });
    return asignados;
  };
  const lideres = quienes('LIDER', 'pabellon_id'), expositores = quienes('EXPOSITOR', 'stand_id'), ponentes = quienes('PONENTE', 'charla_id');
  const conCodigo = p => texto_(p.requiere_codigo) === '' || adminBooleano_(p, 'requiere_codigo');
  return {
    preguntas: preguntas,
    sinResponsable: {
      pabellones: datos.pabellones.filter(p => activa(p) && conCodigo(p) && !lideres[id_(p.pabellon_id)]).map(p => p.pabellon_id),
      stands: datos.stands.filter(s => activa(s) && !expositores[id_(s.stand_id)]).map(s => s.stand_id),
      charlas: datos.charlas.filter(c => activa(c) && !ponentes[id_(c.charla_id)]).map(c => c.charla_id),
    },
  };
}

/** Con "filas" (las de la hoja, ya leídas) no vuelve a leerla: quien llama debe tener el turno desde esa lectura. */
function adminSiguienteId_(entidad, prefijo, filas) {
  const campo = ADMIN_CAMPOS_ID[entidad];
  const usados = (filas || adminFilas_(entidad)).map(fila => texto_(fila[campo]).toUpperCase());
  const propiedad = 'ULTIMA_ID_' + entidad.toUpperCase();
  const guardado = Number(PropertiesService.getScriptProperties().getProperty(propiedad)) || 0;
  const patron = new RegExp('^' + prefijo + '-(\\d+)$');
  const mayorEnHoja = usados.reduce((mayor, usado) => {
    const coincidencia = usado.match(patron);
    return coincidencia ? Math.max(mayor, Number(coincidencia[1])) : mayor;
  }, 0);
  let numero = Math.max(guardado, mayorEnHoja) + 1;
  let candidato = prefijo + '-' + String(numero).padStart(3, '0');
  while (usados.indexOf(candidato) >= 0) {
    numero++;
    candidato = prefijo + '-' + String(numero).padStart(3, '0');
  }
  return { id: candidato, numero: numero, propiedad: propiedad };
}

function adminNumero_(registro, campo, minimo) {
  const valor = Number(registro[campo]);
  if (!isFinite(valor) || valor < minimo || Math.floor(valor) !== valor) {
    throw new Error('El campo "' + campo + '" debe ser un número entero válido.');
  }
  return valor;
}

function adminBooleano_(registro, campo) {
  return registro[campo] === true || /^(true|1|si|sí|verdadero)$/i.test(texto_(registro[campo]));
}

function adminNormalizar_(entidad, entrada) {
  const registro = {};
  const campos = ADMIN_DEFINICIONES[entidad].campos;
  campos.forEach(campo => { registro[campo] = entrada[campo] === undefined ? '' : entrada[campo]; });
  if (entidad === 'pabellones') {
    registro.pabellon_id = id_(registro.pabellon_id);
    registro.nombre = texto_(registro.nombre);
    registro.nombre_corto = texto_(registro.nombre_corto);
    registro.descripcion = texto_(registro.descripcion);
    // El código se pide por pabellón. Sin dato se asume que sí: solo el quiz de entrada va sin código.
    registro.requiere_codigo = texto_(registro.requiere_codigo) === '' ? true : adminBooleano_(registro, 'requiere_codigo');
    registro.preguntas_por_stand = texto_(registro.preguntas_por_stand) === '' ? '' : Number(registro.preguntas_por_stand);
    registro.orden = Number(registro.orden);
    registro.activo = adminBooleano_(registro, 'activo');
  } else if (entidad === 'stands') {
    registro.stand_id = id_(registro.stand_id);
    registro.pabellon_id = id_(registro.pabellon_id);
    registro.nombre = texto_(registro.nombre);
    registro.descripcion = texto_(registro.descripcion);
    registro.orden = Number(registro.orden);
    registro.activo = adminBooleano_(registro, 'activo');
  } else if (entidad === 'charlas') {
    registro.charla_id = id_(registro.charla_id);
    registro.titulo = texto_(registro.titulo);
    registro.ponente = texto_(registro.ponente);
    registro.descripcion = texto_(registro.descripcion);
    // El formulario manda "2026-10-19T18:00"; en la hoja queda "2026-10-19 18:00".
    registro.inicio = texto_(registro.inicio).replace('T', ' ');
    registro.fin = texto_(registro.fin).replace('T', ' ');
    registro.cierre = texto_(registro.cierre).replace('T', ' ');
    registro.preguntas_banco = texto_(registro.preguntas_banco) === '' ? '' : Number(registro.preguntas_banco);
    registro.preguntas_quiz = texto_(registro.preguntas_quiz) === '' ? '' : Number(registro.preguntas_quiz);
    registro.orden = Number(registro.orden);
    registro.activo = adminBooleano_(registro, 'activo');
  } else if (entidad === 'preguntas') {
    registro.pregunta_id = id_(registro.pregunta_id);
    registro.stand_id = id_(registro.stand_id);
    ['texto', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d'].forEach(campo => { registro[campo] = texto_(registro[campo]); });
    registro.correcta = texto_(registro.correcta).toUpperCase();
    registro.puntos = Number(registro.puntos);
    registro.activo = adminBooleano_(registro, 'activo');
  } else if (entidad === 'staff') {
    registro.email = texto_(registro.email).toLowerCase();
    registro.nombre = texto_(registro.nombre);
    registro.rol = texto_(registro.rol).toUpperCase();
    registro.pabellon_id = id_(registro.pabellon_id);
    registro.stand_id = id_(registro.stand_id);
    registro.charla_id = id_(registro.charla_id);
    registro.activo = adminBooleano_(registro, 'activo');
  } else if (entidad === 'permisos') {
    registro.rol = texto_(registro.rol).toUpperCase();
    registro.vista = texto_(registro.vista).toUpperCase();
    registro.activo = adminBooleano_(registro, 'activo');
  } else if (entidad === 'config') {
    registro.clave = normal_(registro.clave);
    registro.valor = texto_(registro.valor);
    registro.descripcion = texto_(registro.descripcion);
  } else if (entidad === 'premios') {
    registro.orden = Number(registro.orden);
    registro.titulo = texto_(registro.titulo);
    registro.descripcion = texto_(registro.descripcion);
    registro.activo = adminBooleano_(registro, 'activo');
  }
  return registro;
}

function adminValidarUnicidad_(entidad, registro, fila) {
  const filas = adminFilas_(entidad);
  let campos = [];
  if (entidad === 'pabellones') campos = ['pabellon_id'];
  if (entidad === 'stands') campos = ['stand_id'];
  if (entidad === 'charlas') campos = ['charla_id'];
  if (entidad === 'preguntas') campos = ['pregunta_id'];
  if (entidad === 'config') campos = ['clave'];
  if (entidad === 'permisos') {
    if (filas.some(f => f._fila !== (fila && fila._fila) && texto_(f.rol).toUpperCase() === registro.rol && texto_(f.vista).toUpperCase() === registro.vista)) {
      throw new Error('Ya existe ese permiso para el rol indicado.');
    }
  }
  if (entidad === 'staff') {
    // Una persona del staff puede tener una fila por función (líder, expositor, ponente), pero no dos del mismo rol.
    // ADMIN y VALIDADOR van solos: no se mezclan con ninguna otra fila activa.
    const correo = texto_(registro.email).toLowerCase();
    const otras = filas.filter(f => f._fila !== (fila && fila._fila) && texto_(f.email).toLowerCase() === correo);
    if (otras.some(f => texto_(f.rol).toUpperCase() === registro.rol)) throw new Error('Ese correo ya tiene una fila con el rol ' + registro.rol + '.');
    const solo = rol => rol === 'ADMIN' || rol === 'VALIDADOR';
    if (registro.activo && solo(registro.rol) && otras.some(f => adminBooleano_(f, 'activo'))) throw new Error(registro.rol + ' va solo: ese correo ya tiene otra fila activa.');
    if (registro.activo && !solo(registro.rol) && otras.some(f => adminBooleano_(f, 'activo') && solo(texto_(f.rol).toUpperCase()))) throw new Error('Ese correo es ' + otras.find(f => solo(texto_(f.rol).toUpperCase())).rol + ' y ese rol va solo.');
    return;
  }
  campos.forEach(campo => {
    if (filas.some(f => f._fila !== (fila && fila._fila) && texto_(f[campo]).toUpperCase() === texto_(registro[campo]).toUpperCase())) {
      throw new Error('Ya existe un registro con ese valor en "' + campo + '".');
    }
  });
}

/** Enunciado, opciones, respuesta correcta y puntos. No lee hojas: la usan el panel y la vista de preguntas del líder. */
function adminValidarContenidoPregunta_(registro) {
  if (!registro.texto || ['opcion_a', 'opcion_b', 'opcion_c', 'opcion_d'].some(campo => !registro[campo])) throw new Error('Completa el enunciado y las cuatro opciones.');
  if (!/^[ABCD]$/.test(registro.correcta)) throw new Error('La respuesta correcta debe ser A, B, C o D.');
  adminNumero_(registro, 'puntos', 0);
}

function adminValidarRelaciones_(entidad, registro, fila) {
  const pabellones = adminFilas_('pabellones');
  const stands = adminFilas_('stands');
  const permisos = adminFilas_('permisos');
  const charlas = adminFilas_('charlas');
  const pabellonActivo = id => pabellones.some(p => p.pabellon_id === id && adminBooleano_(p, 'activo'));
  const standActivo = id => stands.some(s => s.stand_id === id && adminBooleano_(s, 'activo'));
  const charlaActiva = id => charlas.some(c => c.charla_id === id && adminBooleano_(c, 'activo'));

  if (entidad === 'pabellones') {
    if (!registro.nombre) throw new Error('Escribe un nombre para el pabellón.');
    adminNumero_(registro, 'orden', 0);
    if (registro.preguntas_por_stand !== '') adminNumero_(registro, 'preguntas_por_stand', 1);
    // Solo puede haber un quiz de entrada: un segundo pabellón sin código no se mostraría en ninguna parte.
    if (registro.activo && !registro.requiere_codigo && pabellones.some(f => f._fila !== (fila && fila._fila) && adminBooleano_(f, 'activo') && texto_(f.requiere_codigo) !== '' && !adminBooleano_(f, 'requiere_codigo'))) {
      throw new Error('Ya hay un pabellón sin código (el quiz de entrada). Solo puede haber uno.');
    }
  }
  if (entidad === 'stands') {
    if (!registro.nombre || !registro.pabellon_id || !pabellonActivo(registro.pabellon_id)) throw new Error('El stand necesita un pabellón activo válido.');
    adminNumero_(registro, 'orden', 0);
  }
  if (entidad === 'charlas') {
    if (!registro.titulo) throw new Error('Escribe un título para el taller.');
    if (!fechaEnMs_(registro.inicio)) throw new Error('Escribe la fecha y la hora de inicio, por ejemplo 2026-10-19 18:00.');
    if (registro.fin && !fechaEnMs_(registro.fin)) throw new Error('La fecha de fin no tiene un formato válido. Ejemplo: 2026-10-19 19:00.');
    if (registro.cierre && !fechaEnMs_(registro.cierre)) throw new Error('La hora de cierre no tiene un formato válido. Ejemplo: 2026-10-19 19:30.');
    if (registro.cierre && fechaEnMs_(registro.cierre) <= fechaEnMs_(registro.inicio)) throw new Error('El cierre tiene que ser posterior al inicio del taller.');
    adminNumero_(registro, 'orden', 0);
    if (registro.preguntas_banco !== '') adminNumero_(registro, 'preguntas_banco', 1);
    if (registro.preguntas_quiz !== '') adminNumero_(registro, 'preguntas_quiz', 1);
    if (registro.preguntas_banco !== '' && registro.preguntas_quiz !== '' && registro.preguntas_quiz > registro.preguntas_banco) {
      throw new Error('Las preguntas del quiz no pueden ser más que las del banco.');
    }
  }
  if (entidad === 'preguntas') {
    if (!standActivo(registro.stand_id) && !charlaActiva(registro.stand_id)) throw new Error('La pregunta necesita un stand o un taller activos válidos.');
    adminValidarContenidoPregunta_(registro);
  }
  if (entidad === 'staff') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(registro.email)) throw new Error('Escribe un correo válido.');
    if (!registro.nombre || !registro.rol) throw new Error('Completa nombre y rol.');
    if (registro.activo && !permisos.some(p => p.rol === registro.rol && adminBooleano_(p, 'activo'))) throw new Error('Ese rol no tiene permisos activos. Configura primero al menos una vista.');
    // Cada rol trabaja sobre una sola cosa: el líder, un pabellón; el expositor, un stand; el ponente, una charla.
    // El admin y el validador ven todo: no tienen nada asignado.
    if (registro.rol === 'ADMIN' || registro.rol === 'VALIDADOR') {
      registro.pabellon_id = '';
      registro.stand_id = '';
      registro.charla_id = '';
    } else if (registro.rol === 'LIDER') {
      if (!registro.pabellon_id || !pabellonActivo(registro.pabellon_id)) throw new Error('El líder necesita un pabellón activo.');
      registro.stand_id = '';
      registro.charla_id = '';
    } else if (registro.rol === 'EXPOSITOR') {
      const stand = stands.find(s => s.stand_id === registro.stand_id && adminBooleano_(s, 'activo'));
      if (!stand) throw new Error('El expositor necesita un stand activo.');
      if (registro.pabellon_id && stand.pabellon_id !== registro.pabellon_id) throw new Error('El stand no pertenece al pabellón asignado.');
      registro.pabellon_id = stand.pabellon_id;
      registro.charla_id = '';
    } else if (registro.rol === 'PONENTE') {
      if (!registro.charla_id || !charlaActiva(registro.charla_id)) throw new Error('El ponente necesita un taller activo.');
      registro.pabellon_id = '';
      registro.stand_id = '';
    } else {
      registro.charla_id = '';
      if (registro.pabellon_id && !pabellonActivo(registro.pabellon_id)) throw new Error('El pabellón asignado no está activo.');
      if (registro.stand_id) {
        const stand = stands.find(s => s.stand_id === registro.stand_id && adminBooleano_(s, 'activo'));
        if (!stand || (registro.pabellon_id && stand.pabellon_id !== registro.pabellon_id)) throw new Error('El stand no pertenece al pabellón asignado.');
        if (!registro.pabellon_id) registro.pabellon_id = stand.pabellon_id;
      }
    }
    // Sin la columna, guardar o agregar la fila descarta el valor en silencio: avisa antes de guardar.
    if (registro.charla_id && encabezados_(HOJA.STAFF).indexOf('charla_id') < 0) throw new Error('Agrega la columna charla_id en la hoja Staff para asignar un taller.');
  }
  if (entidad === 'permisos') {
    if (!registro.rol || !registro.vista || registro.vista === 'ESPERA' || !Object.prototype.hasOwnProperty.call(ARCHIVO_DE_VISTA, registro.vista)) throw new Error('El rol o la vista no son válidos.');
    if (registro.rol === 'VALIDADOR' && VISTAS_DEL_VALIDADOR.indexOf(registro.vista) < 0) throw new Error('El validador solo puede tener las vistas ' + VISTAS_DEL_VALIDADOR.join(', ') + '.');
    if (VISTAS_SOLO_ADMIN_Y_VALIDADOR.indexOf(registro.vista) >= 0 && registro.rol !== 'ADMIN' && registro.rol !== 'VALIDADOR') throw new Error('Esa vista solo puede tenerla el admin o el validador.');
    if (registro.activo && registro.vista === 'QUIZ' && !permisos.some(p => p._fila !== (fila && fila._fila) && p.rol === registro.rol && (p.vista === 'MAPA' || p.vista === 'CHARLAS') && adminBooleano_(p, 'activo'))) throw new Error('QUIZ necesita también el permiso MAPA o CHARLAS para ese rol.');
  }
  if (entidad === 'config') {
    if (!Object.prototype.hasOwnProperty.call(CONFIG_DEFECTO, registro.clave)) throw new Error('Esa clave de configuración no está soportada por la app.');
    const defecto = CONFIG_DEFECTO[registro.clave];
    if (registro.clave === 'fecha_feria' && registro.valor && !fechaEnMs_(registro.valor)) throw new Error('La fecha de la feria no tiene un formato válido.');
    else if (typeof defecto === 'boolean' && !/^(true|false|1|0|si|no|sí|verdadero|falso)$/i.test(registro.valor)) throw new Error('Ese valor debe ser TRUE o FALSE.');
    else if (typeof defecto === 'number' && (registro.valor === '' || isNaN(Number(registro.valor)) || Number(registro.valor) < 0)) throw new Error('Ese valor debe ser un número mayor o igual a cero.');
  }
  if (entidad === 'premios') {
    if (!registro.titulo) throw new Error('Escribe un título para el premio.');
    adminNumero_(registro, 'orden', 1);
  }
}

/* ---------- Responsable de un pabellón, un stand o una charla ---------- */

/**
 * Quién responde de cada cosa y con qué rol queda en Staff: el líder de un pabellón (genera su código), el expositor de un
 * stand (edita sus preguntas) y el ponente de una charla (genera su código y edita sus preguntas). Cada formulario trae el
 * correo en su propio campo y el servidor lo guarda en Staff, con el alcance que corresponde al rol.
 */
const ADMIN_RESPONSABLES = {
  pabellones: {
    rol: 'LIDER', campo: 'pabellon_id', formulario: 'lider_email', nombreRol: 'líder', articulo: 'el líder', exigeCodigo: true,
    ubicacion: r => ({ pabellon_id: r.pabellon_id, stand_id: '', charla_id: '' }),
  },
  stands: {
    rol: 'EXPOSITOR', campo: 'stand_id', formulario: 'expositor_email', nombreRol: 'expositor', articulo: 'el expositor',
    ubicacion: r => ({ pabellon_id: r.pabellon_id, stand_id: r.stand_id, charla_id: '' }),
  },
  charlas: {
    rol: 'PONENTE', campo: 'charla_id', formulario: 'ponente_email', nombreRol: 'ponente', articulo: 'el ponente',
    ubicacion: r => ({ pabellon_id: '', stand_id: '', charla_id: r.charla_id }),
  },
};

/**
 * Responsable que muestra y reemplaza el formulario: la primera fila activa de Staff con el rol de "def" y ese ID.
 * Si el Sheet tiene más (escritas a mano), se conservan: el formulario solo maneja una.
 */
function adminResponsableDe_(staff, def, id) {
  if (!id) return null;
  return staff.find(f => texto_(f.rol).toUpperCase() === def.rol && id_(f[def.campo]) === id_(id) && adminBooleano_(f, 'activo')) || null;
}

/** Correo del campo del formulario: null si el formulario no lo trae (no se toca Staff), '' si lo vació. */
function adminCorreoResponsable_(entrada, def) {
  if (!entrada || entrada[def.formulario] === undefined || entrada[def.formulario] === null) return null;
  const correo = texto_(entrada[def.formulario]).toLowerCase();
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new Error('Escribe un correo válido para ' + def.articulo + '.');
  return correo;
}

/**
 * Nombre para la fila de Staff, con la misma cadena que la app usa para registrar personas: el que ya tenga en Staff,
 * el del directorio de Google y, si no hay, el deducido del correo. Hace una llamada de red: va antes del turno global.
 */
function adminNombreLider_(correo, staff) {
  const fila = staff.find(f => texto_(f.email).toLowerCase() === correo);
  if (fila && texto_(fila.nombre)) return texto_(fila.nombre);
  return nombreDeDirectorio_(correo) || nombreDesdeEmail_(correo);
}

/**
 * Qué hay que cambiar en Staff para que "correo" sea el responsable (vacío = que no tenga). No escribe nada:
 * lee, valida y devuelve el plan, para que un rechazo llegue antes de tocar el Sheet.
 *  - "idAnterior" es el ID que tenía antes de este guardado (vacío si es nuevo).
 *  - Un correo que ya está en Staff con otro rol, o que ya responde de otra cosa, se rechaza: no se le quita nada a nadie.
 */
function adminPlanResponsable_(def, correo, registro, idAnterior, nombre) {
  const staff = adminFilas_('staff');
  const actual = adminResponsableDe_(staff, def, idAnterior);
  const correoActual = actual ? texto_(actual.email).toLowerCase() : '';
  const plan = { desactivar: [], actualizar: null, agregar: null };
  const ubicacion = def.ubicacion(registro);
  // Mantiene la fila al día con lo que responde: si el stand cambió de pabellón o de ID, su expositor lo sigue.
  const alDia = fila => {
    const cambios = {};
    Object.keys(ubicacion).forEach(campo => { if (id_(fila[campo]) !== ubicacion[campo]) cambios[campo] = ubicacion[campo]; });
    if (Object.keys(cambios).length) plan.actualizar = { fila: fila._fila, cambios: cambios };
  };

  if (correo === correoActual) {
    if (actual) alDia(actual);
    return plan;
  }
  if (actual) plan.desactivar.push(actual._fila);
  if (!correo) return plan;

  if (!registro.activo) throw new Error('Activa este registro para asignarle ' + def.articulo + '.');
  if (def.exigeCodigo && !registro.requiere_codigo) throw new Error('Este pabellón no usa código, así que no necesita líder.');
  if (ubicacion.charla_id && encabezados_(HOJA.STAFF).indexOf('charla_id') < 0) throw new Error('Agrega la columna charla_id en la hoja Staff para asignar un ponente.');
  if (!adminFilas_('permisos').some(p => texto_(p.rol).toUpperCase() === def.rol && adminBooleano_(p, 'activo'))) {
    throw new Error('El rol ' + def.rol + ' no tiene permisos activos. Configura primero al menos una vista.');
  }

  // Una persona puede tener una fila por función; ADMIN y VALIDADOR van solos y no se les suma ninguna.
  const delCorreo = staff.filter(f => texto_(f.email).toLowerCase() === correo);
  const soloActiva = delCorreo.find(f => ['ADMIN', 'VALIDADOR'].indexOf(texto_(f.rol).toUpperCase()) >= 0 && adminBooleano_(f, 'activo'));
  if (soloActiva) throw new Error(correo + ' ya está en Staff como ' + texto_(soloActiva.rol).toUpperCase() + ', un rol que va solo. Si hace falta cambiarle el rol, hazlo desde la pestaña Staff.');
  const existente = delCorreo.find(f => texto_(f.rol).toUpperCase() === def.rol);
  if (!existente) {
    plan.agregar = Object.assign({ email: correo, nombre: nombre, rol: def.rol, activo: true }, ubicacion);
    return plan;
  }
  if (adminBooleano_(existente, 'activo')) {
    if (id_(existente[def.campo]) === id_(registro[def.campo])) {
      // Ya responde de esto mismo (había dos): solo se reemplaza al primero.
      alDia(existente);
      return plan;
    }
    // Solo en este camino de error se leen los nombres, para que el aviso diga dónde responde.
    const nombreDe = (entidad, campo, id) => { const f = adminFilas_(entidad).find(x => id_(x[campo]) === id_(id)); return f ? (f.nombre || f.titulo) + ' (' + id_(id) + ')' : id_(id); };
    const donde = existente.charla_id ? 'del taller ' + nombreDe('charlas', 'charla_id', existente.charla_id)
      : existente.stand_id ? 'del stand ' + nombreDe('stands', 'stand_id', existente.stand_id)
      : 'del pabellón ' + (existente.pabellon_id ? nombreDe('pabellones', 'pabellon_id', existente.pabellon_id) : '');
    throw new Error(correo + ' ya es ' + def.nombreRol + ' ' + donde.trim() + '. Quítalo de ahí primero.');
  }
  // Fila de alguien dado de baja: se reactiva con esta ubicación. Conserva su nombre si lo tenía.
  const cambios = Object.assign({}, ubicacion, { activo: true });
  if (!texto_(existente.nombre)) cambios.nombre = nombre;
  plan.actualizar = { fila: existente._fila, cambios: cambios };
  return plan;
}

/** Escribe el plan en Staff. Quien llama tiene el turno global. Primero se da de alta al nuevo y al final se baja al anterior. */
function adminAplicarResponsable_(plan) {
  if (plan.actualizar) actualizarFila_(HOJA.STAFF, plan.actualizar.fila, plan.actualizar.cambios);
  if (plan.agregar) agregarFila_(HOJA.STAFF, plan.agregar);
  plan.desactivar.forEach(fila => actualizarFila_(HOJA.STAFF, fila, { activo: false }));
}

function guardarAdminRegistro(entidad, entrada) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede editar el catálogo.');
  entidad = texto_(entidad).toLowerCase();
  const def = adminDefinicion_(entidad);
  if (ADMIN_HOJAS_OPCIONALES[entidad] && !hojaSiExiste_(def.hoja)) throw new Error('Crea primero la hoja ' + ADMIN_HOJAS_OPCIONALES[entidad] + ' con sus encabezados.');
  const original = entrada && entrada._fila ? adminFilas_(entidad).find(f => f._fila === Number(entrada._fila)) : null;
  const registro = adminNormalizar_(entidad, entrada || {});
  if (entidad === 'stands' && original && id_(registro.pabellon_id) !== id_(original.pabellon_id)) throw new Error('Para cambiar de pabellón usa Mover hacia.');
  // Sin la columna, actualizarFila_ y agregarFila_ descartan el valor en silencio: avisa antes de guardar.
  if (entidad === 'pabellones' && registro.nombre_corto && encabezados_(def.hoja).indexOf('nombre_corto') < 0) {
    throw new Error('Agrega la columna nombre_corto en la hoja Pabellones para guardar un nombre corto.');
  }
  // Sin estas columnas, guardar o agregar la fila descarta el valor en silencio: avisa antes de guardar.
  if (entidad === 'pabellones') {
    const columnas = encabezados_(def.hoja);
    ['requiere_codigo', 'preguntas_por_stand'].forEach(campo => {
      if (columnas.indexOf(campo) < 0 && (campo === 'requiere_codigo' || registro[campo] !== '')) throw new Error('Agrega la columna ' + campo + ' en la hoja Pabellones para guardar este dato.');
    });
  }
  if (entidad === 'charlas' && registro.cierre && encabezados_(def.hoja).indexOf('cierre') < 0) {
    throw new Error('Agrega la columna cierre en la hoja Charlas para guardar la hora de cierre.');
  }
  adminValidarRelaciones_(entidad, registro, original);
  // El responsable (líder, expositor o ponente) va en el mismo formulario pero se guarda en Staff. La búsqueda del
  // nombre usa la red, así que se hace antes del turno global para no tenerlo ocupado mientras el directorio responde.
  const responsable = ADMIN_RESPONSABLES[entidad] || null;
  const correoResponsable = responsable ? adminCorreoResponsable_(entrada, responsable) : null;
  const nombreResponsable = correoResponsable ? adminNombreLider_(correoResponsable, adminFilas_('staff')) : '';
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    let secuencia = null;
    if (!original && ADMIN_CAMPOS_ID[entidad]) {
      const prefijo = entidad === 'pabellones' ? 'PAB' : entidad === 'stands' ? 'STD' : entidad === 'charlas' ? 'CHA' : 'PRG';
      secuencia = adminSiguienteId_(entidad, prefijo);
      registro[ADMIN_CAMPOS_ID[entidad]] = secuencia.id;
    }
    adminValidarUnicidad_(entidad, registro, original);
    // Se valida todo lo de Staff antes de escribir el registro: un rechazo no lo deja a medias.
    const plan = correoResponsable === null ? null : adminPlanResponsable_(responsable, correoResponsable, registro, original ? id_(original[responsable.campo]) : '', nombreResponsable);
    if (original) actualizarFila_(def.hoja, original._fila, registro);
    else agregarFila_(def.hoja, registro);
    if (secuencia) PropertiesService.getScriptProperties().setProperty(secuencia.propiedad, String(secuencia.numero));
    try {
      if (plan) adminAplicarResponsable_(plan);
    } catch (error) {
      throw new Error('Se guardó, pero no se pudo guardar a ' + responsable.articulo + ': ' + error.message);
    } finally {
      limpiarCache_();
    }
  } finally {
    bloqueo.releaseLock();
  }
  return obtenerAdminCatalogo();
}

/** Importa un arreglo JSON de preguntas en un stand o en una charla, generando sus claves y fechas en el servidor. */
function importarPreguntasAdmin(standId, preguntas) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede editar el catálogo.');
  const bancoId = id_(standId);
  const destino = adminFilas_('stands').find(s => s.stand_id === bancoId && adminBooleano_(s, 'activo'))
    || adminFilas_('charlas').find(c => c.charla_id === bancoId && adminBooleano_(c, 'activo'));
  if (!destino) throw new Error('El stand o el taller seleccionados no existen o están inactivos.');
  const stand = { stand_id: bancoId };
  if (!Array.isArray(preguntas) || !preguntas.length) throw new Error('El JSON debe contener un arreglo con al menos una pregunta.');
  if (preguntas.length > 200) throw new Error('Puedes importar como máximo 200 preguntas por archivo.');

  const camposEsperados = ['texto', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'correcta', 'puntos', 'activo'];
  const registros = preguntas.map((entrada, indice) => {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('La pregunta ' + (indice + 1) + ' debe ser un objeto JSON.');
    const faltan = camposEsperados.filter(campo => !Object.prototype.hasOwnProperty.call(entrada, campo));
    if (faltan.length) throw new Error('La pregunta ' + (indice + 1) + ' no tiene: ' + faltan.join(', ') + '.');
    const extras = Object.keys(entrada).filter(campo => camposEsperados.indexOf(campo) < 0);
    if (extras.length) throw new Error('La pregunta ' + (indice + 1) + ' contiene campos no permitidos: ' + extras.join(', ') + '.');
    if (typeof entrada.activo !== 'boolean') throw new Error('El campo activo de la pregunta ' + (indice + 1) + ' debe ser true o false.');
    if (typeof entrada.puntos !== 'number' || !isFinite(entrada.puntos)) throw new Error('El campo puntos de la pregunta ' + (indice + 1) + ' debe ser numérico.');
    const registro = adminNormalizar_('preguntas', Object.assign({}, entrada, { stand_id: stand.stand_id }));
    try { adminValidarRelaciones_('preguntas', registro, null); } catch (error) { throw new Error('Pregunta ' + (indice + 1) + ': ' + error.message); }
    return registro;
  });

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    registros.forEach(registro => {
      const secuencia = adminSiguienteId_('preguntas', 'PRG');
      registro.pregunta_id = secuencia.id;
      registro.stand_id = stand.stand_id;
      registro.creado_en = new Date();
      agregarFila_(HOJA.PREGUNTAS, registro);
      PropertiesService.getScriptProperties().setProperty(secuencia.propiedad, String(secuencia.numero));
    });
    limpiarCache_();
  } finally {
    bloqueo.releaseLock();
  }
  return { datos: obtenerAdminCatalogo(), importadas: registros.length, stand_id: stand.stand_id };
}

function borrarAdminRegistro(entidad, numeroDeFila) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede editar el catálogo.');
  entidad = texto_(entidad).toLowerCase();
  if (entidad === 'pabellones') return eliminarAdminPabellon(numeroDeFila);
  const def = adminDefinicion_(entidad);
  if (ADMIN_HOJAS_OPCIONALES[entidad] && !hojaSiExiste_(def.hoja)) throw new Error('La hoja ' + ADMIN_HOJAS_OPCIONALES[entidad] + ' no existe.');
  const fila = adminFilas_(entidad).find(f => f._fila === Number(numeroDeFila));
  if (!fila) throw new Error('El registro ya no existe. Actualiza la lista.');
  if (entidad === 'stands' && adminFilas_('preguntas').some(p => p.stand_id === fila.stand_id && adminBooleano_(p, 'activo'))) throw new Error('No puedes desactivar un stand con preguntas activas. Desactiva primero sus preguntas.');
  if (entidad === 'charlas' && adminFilas_('preguntas').some(p => p.stand_id === fila.charla_id && adminBooleano_(p, 'activo'))) throw new Error('No puedes desactivar un taller con preguntas activas. Desactiva primero sus preguntas.');
  if (entidad === 'staff' && texto_(fila.email).toLowerCase() === sesion.email) throw new Error('No puedes desactivar tu propio acceso de administrador.');
  if (entidad === 'permisos' && fila.rol === 'ADMIN' && fila.vista === 'PANEL_ADMIN' && adminFilas_('permisos').filter(p => p.rol === 'ADMIN' && p.vista === 'PANEL_ADMIN' && adminBooleano_(p, 'activo')).length < 2) throw new Error('Debe quedar al menos un permiso PANEL_ADMIN activo para ADMIN.');

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    if (entidad === 'config') hoja_(def.hoja).deleteRow(fila._fila);
    else actualizarFila_(def.hoja, fila._fila, { activo: false });
    limpiarCache_();
  } finally {
    bloqueo.releaseLock();
  }
  return obtenerAdminCatalogo();
}

/** Elimina un pabellón y todo su árbol de catálogo. El historial transaccional se conserva. */
function eliminarAdminPabellon(numeroDeFila) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede editar el catálogo.');
  const pabellon = adminFilas_('pabellones').find(f => f._fila === Number(numeroDeFila));
  if (!pabellon) throw new Error('El pabellón ya no existe. Actualiza la lista.');

  const stands = adminFilas_('stands').filter(s => s.pabellon_id === pabellon.pabellon_id);
  const standIds = stands.map(s => s.stand_id);
  const preguntas = adminFilas_('preguntas').filter(p => standIds.indexOf(p.stand_id) >= 0);
  const codigos = hojaSiExiste_(HOJA.CODIGOS) ? leerHoja_(HOJA.CODIGOS).filter(c => id_(c.unidad_id) === pabellon.pabellon_id && texto_(c.estado).toUpperCase() === 'ACTIVO') : [];

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const hojaPreguntas = hoja_(HOJA.PREGUNTAS);
    preguntas.sort((a, b) => b._fila - a._fila).forEach(p => hojaPreguntas.deleteRow(p._fila));
    const hojaStands = hoja_(HOJA.STANDS);
    stands.sort((a, b) => b._fila - a._fila).forEach(s => hojaStands.deleteRow(s._fila));
    hoja_(HOJA.PABELLONES).deleteRow(pabellon._fila);
    codigos.forEach(c => actualizarFila_(HOJA.CODIGOS, c._fila, { estado: 'ANULADO' }));
    limpiarCache_();
  } finally {
    bloqueo.releaseLock();
  }
  return {
    datos: obtenerAdminCatalogo(),
    borrado: { pabellones: 1, stands: stands.length, preguntas: preguntas.length, codigos: codigos.length },
  };
}

/**
 * Mueve un stand a otro pabellón con código. Su ID no cambia: sus preguntas (Preguntas.stand_id) y su expositor
 * (Staff.stand_id) lo siguen. Cambian Stands.pabellon_id, el pabellón de sus filas de Staff y su orden en el destino.
 * Codigos e Intentos no se tocan: son por pabellón y guardan el historial.
 */
function moverAdminStand(standId, pabellonDestinoId) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede mover stands.');
  const idStand = id_(standId);
  const idDestino = id_(pabellonDestinoId);
  const conCodigo = p => texto_(p.requiere_codigo) === '' || adminBooleano_(p, 'requiere_codigo');

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  let movido;
  try {
    const stand = adminFilas_('stands').find(s => id_(s.stand_id) === idStand && adminBooleano_(s, 'activo'));
    if (!stand) throw new Error('El stand ya no existe o está inactivo. Actualiza la lista.');
    if (id_(stand.pabellon_id) === idDestino) throw new Error('El stand ya está en ese pabellón.');
    const pabellones = adminFilas_('pabellones');
    const destino = pabellones.find(p => id_(p.pabellon_id) === idDestino && adminBooleano_(p, 'activo'));
    if (!destino) throw new Error('El pabellón de destino no existe o está inactivo.');
    if (!conCodigo(destino)) throw new Error('Solo se puede mover un stand a un pabellón con código.');
    const origen = pabellones.find(p => id_(p.pabellon_id) === id_(stand.pabellon_id));
    if (origen && !conCodigo(origen)) throw new Error('El quiz de entrada no cambia: su stand no se mueve.');

    const orden = adminFilas_('stands').filter(s => id_(s.pabellon_id) === idDestino)
      .reduce((mayor, s) => Math.max(mayor, Number(s.orden) || 0), 0) + 1;
    const expositores = adminFilas_('staff').filter(f => id_(f.stand_id) === idStand);
    const preguntas = adminFilas_('preguntas').filter(p => id_(p.stand_id) === idStand).length;

    actualizarFila_(HOJA.STANDS, stand._fila, { pabellon_id: idDestino, orden: orden });
    expositores.forEach(f => actualizarFila_(HOJA.STAFF, f._fila, { pabellon_id: idDestino }));
    SpreadsheetApp.flush();
    limpiarCache_();
    movido = { stand: idStand, de: id_(stand.pabellon_id), a: idDestino, preguntas: preguntas, expositores: expositores.length };
  } finally {
    bloqueo.releaseLock();
  }
  return { datos: obtenerAdminCatalogo(), movido: movido };
}
