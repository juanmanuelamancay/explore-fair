/**
 * Vista PANEL_ADMIN: editor jerárquico del catálogo y reinicio de datos transaccionales.
 */

const PALABRA_DE_REINICIO = 'REINICIAR';
const PALABRA_DE_PREPARACION = 'PREPARAR';
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

function obtenerPanel() {
  exigirVista_('PANEL_ADMIN');
  return { conteos: conteos_(), ultimo: ultimoReinicio_(), registro: registro_() };
}

/** Escribe ahora en Usuarios las cartas pendientes, sin esperar a que entre otra persona. */
function registrarPendientes() {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede hacer esto.');
  repartir_(true);
  return registro_();
}

/** Descarta la caché, relee las hojas de catálogo y deja listas las preguntas de cada stand y los premios. Devuelve qué encontró. */
function actualizarCatalogo() {
  exigirVista_('PANEL_ADMIN');
  limpiarCache_();
  const catalogo = catalogo_();
  const standsListos = precargarPreguntasYPremios_();
  return {
    pabellones: catalogo.pabellones.length,
    stands: catalogo.stands.length,
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
    return { borradas: borradas, respaldo: 'respaldo_' + sello, conteos: conteos_(), ultimo: ultimo };
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
  pabellones: { hoja: HOJA.PABELLONES, campos: ['pabellon_id', 'nombre', 'nombre_corto', 'descripcion', 'orden', 'activo'] },
  stands: { hoja: HOJA.STANDS, campos: ['stand_id', 'pabellon_id', 'nombre', 'descripcion', 'requiere_codigo', 'num_preguntas', 'orden', 'activo'] },
  preguntas: { hoja: HOJA.PREGUNTAS, campos: ['pregunta_id', 'stand_id', 'texto', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'correcta', 'puntos', 'activo'] },
  staff: { hoja: HOJA.STAFF, campos: ['email', 'nombre', 'rol', 'pabellon_id', 'stand_id', 'activo'] },
  permisos: { hoja: HOJA.PERMISOS, campos: ['rol', 'vista', 'activo'] },
  config: { hoja: HOJA.CONFIG, campos: ['clave', 'valor', 'descripcion'] },
  premios: { hoja: HOJA.PREMIOS, campos: ['orden', 'titulo', 'descripcion', 'activo'] },
};

const ADMIN_CAMPOS_ID = {
  pabellones: 'pabellon_id',
  stands: 'stand_id',
  preguntas: 'pregunta_id',
};

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
  if (entidad === 'premios' && !hojaSiExiste_(def.hoja)) return [];
  return leerHoja_(def.hoja).map(fila => adminFila_(fila, def.campos));
}

/** Devuelve el catálogo editable sin fechas Date ni columnas internas innecesarias. */
function obtenerAdminCatalogo() {
  exigirVista_('PANEL_ADMIN');
  const datos = {};
  Object.keys(ADMIN_DEFINICIONES).forEach(entidad => { datos[entidad] = adminFilas_(entidad); });
  return datos;
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
    registro.orden = Number(registro.orden);
    registro.activo = adminBooleano_(registro, 'activo');
  } else if (entidad === 'stands') {
    registro.stand_id = id_(registro.stand_id);
    registro.pabellon_id = id_(registro.pabellon_id);
    registro.nombre = texto_(registro.nombre);
    registro.descripcion = texto_(registro.descripcion);
    registro.requiere_codigo = adminBooleano_(registro, 'requiere_codigo');
    registro.num_preguntas = PREGUNTAS_POR_QUIZ;
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
  if (entidad === 'preguntas') campos = ['pregunta_id'];
  if (entidad === 'staff') campos = ['email'];
  if (entidad === 'config') campos = ['clave'];
  if (entidad === 'permisos') {
    if (filas.some(f => f._fila !== (fila && fila._fila) && texto_(f.rol).toUpperCase() === registro.rol && texto_(f.vista).toUpperCase() === registro.vista)) {
      throw new Error('Ya existe ese permiso para el rol indicado.');
    }
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
  const pabellonActivo = id => pabellones.some(p => p.pabellon_id === id && adminBooleano_(p, 'activo'));
  const standActivo = id => stands.some(s => s.stand_id === id && adminBooleano_(s, 'activo'));

  if (entidad === 'pabellones') {
    if (!registro.nombre) throw new Error('Escribe un nombre para el pabellón.');
    adminNumero_(registro, 'orden', 0);
  }
  if (entidad === 'stands') {
    if (!registro.nombre || !registro.pabellon_id || !pabellonActivo(registro.pabellon_id)) throw new Error('El stand necesita un pabellón activo válido.');
    adminNumero_(registro, 'orden', 0);
  }
  if (entidad === 'preguntas') {
    if (!standActivo(registro.stand_id)) throw new Error('La pregunta necesita un stand activo válido.');
    adminValidarContenidoPregunta_(registro);
  }
  if (entidad === 'staff') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(registro.email)) throw new Error('Escribe un correo válido.');
    if (!registro.nombre || !registro.rol) throw new Error('Completa nombre y rol.');
    if (registro.activo && !permisos.some(p => p.rol === registro.rol && adminBooleano_(p, 'activo'))) throw new Error('Ese rol no tiene permisos activos. Configura primero al menos una vista.');
    // El admin y el validador ven todos los stands: no tienen pabellón ni stand asignado.
    if (registro.rol === 'ADMIN' || registro.rol === 'VALIDADOR') {
      registro.pabellon_id = '';
      registro.stand_id = '';
    } else {
      if (registro.pabellon_id && !pabellonActivo(registro.pabellon_id)) throw new Error('El pabellón asignado no está activo.');
      if (registro.stand_id) {
        const stand = stands.find(s => s.stand_id === registro.stand_id && adminBooleano_(s, 'activo'));
        if (!stand || (registro.pabellon_id && stand.pabellon_id !== registro.pabellon_id)) throw new Error('El stand no pertenece al pabellón asignado.');
        if (!registro.pabellon_id) registro.pabellon_id = stand.pabellon_id;
      }
    }
  }
  if (entidad === 'permisos') {
    if (!registro.rol || !registro.vista || registro.vista === 'ESPERA' || !Object.prototype.hasOwnProperty.call(ARCHIVO_DE_VISTA, registro.vista)) throw new Error('El rol o la vista no son válidos.');
    if (registro.rol === 'VALIDADOR' && VISTAS_DEL_VALIDADOR.indexOf(registro.vista) < 0) throw new Error('El validador solo puede tener las vistas ' + VISTAS_DEL_VALIDADOR.join(', ') + '.');
    if (registro.activo && registro.vista === 'QUIZ' && !permisos.some(p => p._fila !== (fila && fila._fila) && p.rol === registro.rol && p.vista === 'MAPA' && adminBooleano_(p, 'activo'))) throw new Error('QUIZ necesita también el permiso MAPA para ese rol.');
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

/* ---------- Líder de un stand ---------- */

/**
 * Líder que muestra y reemplaza el formulario del stand: la primera fila activa de Staff con rol LIDER y ese stand_id.
 * Si el Sheet tiene más (escritas a mano), se conservan: el formulario solo maneja una.
 */
function adminLiderDeStand_(staff, standId) {
  if (!standId) return null;
  return staff.find(f => texto_(f.rol).toUpperCase() === 'LIDER' && id_(f.stand_id) === id_(standId) && adminBooleano_(f, 'activo')) || null;
}

/** Correo del campo "líder" del formulario de un stand: null si el formulario no lo trae (no se toca Staff), '' si lo vació. */
function adminCorreoLider_(entrada) {
  if (!entrada || entrada.lider_email === undefined || entrada.lider_email === null) return null;
  const correo = texto_(entrada.lider_email).toLowerCase();
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new Error('Escribe un correo válido para el líder.');
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
 * Qué hay que cambiar en Staff para que "correo" sea el líder del stand (vacío = que no tenga). No escribe nada:
 * lee, valida y devuelve el plan, para que un rechazo llegue antes de tocar el Sheet.
 *  - "idAnterior" es el stand_id que tenía el stand antes de este guardado (vacío si es nuevo).
 *  - Un correo que ya está en Staff con otro rol, o que ya lidera otro stand, se rechaza: no se le quita nada a nadie.
 */
function adminPlanLider_(correo, stand, idAnterior, nombre) {
  const staff = adminFilas_('staff');
  const actual = adminLiderDeStand_(staff, idAnterior);
  const correoActual = actual ? texto_(actual.email).toLowerCase() : '';
  const plan = { desactivar: [], actualizar: null, agregar: null };
  // Mantiene la fila de un líder al día con el stand: si el stand cambió de pabellón o de ID, su líder lo sigue.
  const alDia = fila => {
    const cambios = {};
    if (id_(fila.pabellon_id) !== stand.pabellon_id) cambios.pabellon_id = stand.pabellon_id;
    if (id_(fila.stand_id) !== stand.stand_id) cambios.stand_id = stand.stand_id;
    if (Object.keys(cambios).length) plan.actualizar = { fila: fila._fila, cambios: cambios };
  };

  if (correo === correoActual) {
    if (actual) alDia(actual);
    return plan;
  }
  if (actual) plan.desactivar.push(actual._fila);
  if (!correo) return plan;

  if (!stand.activo) throw new Error('Activa el stand para asignarle un líder.');
  if (!stand.requiere_codigo) throw new Error('Este stand no usa código, así que no necesita líder.');
  if (!adminFilas_('permisos').some(p => texto_(p.rol).toUpperCase() === 'LIDER' && adminBooleano_(p, 'activo'))) {
    throw new Error('El rol LIDER no tiene permisos activos. Configura primero al menos una vista.');
  }

  const existente = staff.find(f => texto_(f.email).toLowerCase() === correo);
  if (!existente) {
    plan.agregar = { email: correo, nombre: nombre, rol: 'LIDER', pabellon_id: stand.pabellon_id, stand_id: stand.stand_id, activo: true };
    return plan;
  }
  const rol = texto_(existente.rol).toUpperCase();
  if (rol !== 'LIDER') throw new Error(correo + ' ya está en Staff como ' + rol + '. Si hace falta cambiarle el rol, hazlo desde la pestaña Staff.');
  if (adminBooleano_(existente, 'activo')) {
    if (id_(existente.stand_id) === stand.stand_id) {
      // Ya lidera este mismo stand (había dos líderes): solo se reemplaza al primero.
      alDia(existente);
      return plan;
    }
    // Solo en este camino de error se leen los nombres, para que el aviso diga dónde es líder.
    const nombreDe = (filas, campo, id) => { const f = filas.find(x => id_(x[campo]) === id_(id)); return f ? f.nombre + ' (' + id_(id) + ')' : id_(id); };
    const donde = existente.stand_id
      ? 'del stand ' + nombreDe(adminFilas_('stands'), 'stand_id', existente.stand_id)
      : 'de todo el pabellón ' + (existente.pabellon_id ? nombreDe(adminFilas_('pabellones'), 'pabellon_id', existente.pabellon_id) : '');
    throw new Error(correo + ' ya es líder ' + donde.trim() + '. Quítalo de ahí primero; si va a liderar varios stands, asígnale el pabellón entero desde la pestaña Staff.');
  }
  // Fila de un líder dado de baja: se reactiva con este stand. Conserva su nombre si lo tenía.
  const cambios = { pabellon_id: stand.pabellon_id, stand_id: stand.stand_id, activo: true };
  if (!texto_(existente.nombre)) cambios.nombre = nombre;
  plan.actualizar = { fila: existente._fila, cambios: cambios };
  return plan;
}

/** Escribe el plan en Staff. Quien llama tiene el turno global. Primero se da de alta al nuevo y al final se baja al anterior. */
function adminAplicarLider_(plan) {
  if (plan.actualizar) actualizarFila_(HOJA.STAFF, plan.actualizar.fila, plan.actualizar.cambios);
  if (plan.agregar) agregarFila_(HOJA.STAFF, plan.agregar);
  plan.desactivar.forEach(fila => actualizarFila_(HOJA.STAFF, fila, { activo: false }));
}

function guardarAdminRegistro(entidad, entrada) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede editar el catálogo.');
  entidad = texto_(entidad).toLowerCase();
  const def = adminDefinicion_(entidad);
  if (entidad === 'premios' && !hojaSiExiste_(def.hoja)) throw new Error('Crea primero la hoja Premios con sus encabezados.');
  const original = entrada && entrada._fila ? adminFilas_(entidad).find(f => f._fila === Number(entrada._fila)) : null;
  const registro = adminNormalizar_(entidad, entrada || {});
  // Sin la columna, actualizarFila_ y agregarFila_ descartan el valor en silencio: avisa antes de guardar.
  if (entidad === 'pabellones' && registro.nombre_corto && encabezados_(def.hoja).indexOf('nombre_corto') < 0) {
    throw new Error('Agrega la columna nombre_corto en la hoja Pabellones para guardar un nombre corto.');
  }
  adminValidarRelaciones_(entidad, registro, original);
  // El líder del stand va en el mismo formulario pero se guarda en Staff. La búsqueda del nombre usa la red, así que
  // se hace antes del turno global para no tenerlo ocupado mientras el directorio responde.
  const correoLider = entidad === 'stands' ? adminCorreoLider_(entrada) : null;
  const nombreLider = correoLider ? adminNombreLider_(correoLider, adminFilas_('staff')) : '';
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    let secuencia = null;
    if (!original && ADMIN_CAMPOS_ID[entidad]) {
      const prefijo = entidad === 'pabellones' ? 'PAB' : entidad === 'stands' ? 'STD' : 'PRG';
      secuencia = adminSiguienteId_(entidad, prefijo);
      registro[ADMIN_CAMPOS_ID[entidad]] = secuencia.id;
    }
    adminValidarUnicidad_(entidad, registro, original);
    // Se valida todo lo de Staff antes de escribir el stand: un rechazo no deja el stand a medias.
    const plan = correoLider === null ? null : adminPlanLider_(correoLider, registro, original ? id_(original.stand_id) : '', nombreLider);
    if (original) actualizarFila_(def.hoja, original._fila, registro);
    else agregarFila_(def.hoja, registro);
    if (secuencia) PropertiesService.getScriptProperties().setProperty(secuencia.propiedad, String(secuencia.numero));
    try {
      if (plan) adminAplicarLider_(plan);
    } catch (error) {
      throw new Error('El stand se guardó, pero no se pudo guardar al líder: ' + error.message);
    } finally {
      limpiarCache_();
    }
  } finally {
    bloqueo.releaseLock();
  }
  return obtenerAdminCatalogo();
}

/** Importa un arreglo JSON de preguntas en un stand, generando sus claves y fechas en el servidor. */
function importarPreguntasAdmin(standId, preguntas) {
  const sesion = exigirVista_('PANEL_ADMIN');
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede editar el catálogo.');
  const stand = adminFilas_('stands').find(s => s.stand_id === id_(standId) && adminBooleano_(s, 'activo'));
  if (!stand) throw new Error('El stand seleccionado no existe o está inactivo.');
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
  if (entidad === 'premios' && !hojaSiExiste_(def.hoja)) throw new Error('La hoja Premios no existe.');
  const fila = adminFilas_(entidad).find(f => f._fila === Number(numeroDeFila));
  if (!fila) throw new Error('El registro ya no existe. Actualiza la lista.');
  if (entidad === 'stands' && adminFilas_('preguntas').some(p => p.stand_id === fila.stand_id && adminBooleano_(p, 'activo'))) throw new Error('No puedes desactivar un stand con preguntas activas. Desactiva primero sus preguntas.');
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
  const codigos = hojaSiExiste_(HOJA.CODIGOS) ? leerHoja_(HOJA.CODIGOS).filter(c => standIds.indexOf(id_(c.stand_id)) >= 0 && texto_(c.estado).toUpperCase() === 'ACTIVO') : [];

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
