/**
 * Prueba de carga de la feria: varias ejecuciones a la vez hacen lo que haría cada persona el día del evento.
 * Para ejecutar a mano desde el editor de Apps Script, sobre una copia del Sheet. No forma parte de la app:
 * todas las funciones exigen admin o terminan en "_".
 *
 * Cada ejecución imita a una persona tras otra, sin descanso: se registra y recibe su número de orden (registro.gs),
 * arma su índice, responde el quiz de entrada y después dos stands con código, escribiendo cada intento en su bloque
 * de filas (indice.gs). En todo lo que las personas comparten usa las funciones reales de la app: las hojas Intentos
 * y Usuarios, el registro por lotes con su turno global, el buzón y la caché. Lo que es de cada persona (su índice,
 * su bloqueo, su caché) no se puede imitar con una sola cuenta: se reemplaza por operaciones del mismo costo sobre la
 * cuenta que ejecuta la prueba.
 *
 * Uso:
 *  1. iniciarPruebaCarga()   -> mide primero a una persona sola y programa 20 ejecuciones que arrancan a la misma hora.
 *     iniciarPruebaCarga10() e iniciarPruebaCarga5() hacen lo mismo con 10 y con 5 ejecuciones.
 *  2. Esperar hasta la hora que indica el registro (unos 7 minutos).
 *  3. revisarPruebaCarga()   -> veredicto de datos (nada perdido, nada repetido, cada fila en el bloque de su dueño),
 *     tiempos y errores, en un solo registro. Se puede ejecutar más de una vez: no borra nada.
 *  4. limpiarPruebaCarga()   -> borra las filas, las cartas, los informes y los códigos de prueba.
 *
 * Con más cuentas: después del paso 1 y antes de la hora que indica el registro, otro admin ejecuta
 * sumarmeAPruebaCarga() y agrega sus propias 20 ejecuciones. Al terminar ejecuta quitarMisDisparadoresDeCarga().
 *
 * Qué no cubre: abrir la página (doGet), la pantalla de permisos de Google y cientos de cuentas distintas a la vez.
 * Cada corrida de 20 ejecuciones gasta cerca de 70 de los 360 minutos diarios de disparadores de una cuenta de Workspace.
 * Cada persona de mentira gasta un número de orden: después de las pruebas, prepararFeria() vuelve a numerar desde 1.
 *
 * Cada ejecución de la prueba dura minutos y lee las hojas muchas veces. Dentro de una misma ejecución, una segunda
 * lectura puede no mostrar lo que otra ejecución escribió entretanto; una petición real dura uno o dos segundos y lee
 * cada cosa una vez. Por eso la revisión final se hace desde una ejecución nueva (revisarPruebaCarga).
 */

const CARGA_PREFIJO = 'carga-';                   // correos de mentira: carga-<ejecución>-<n>@simulacion.ejemplo
const CARGA_PLAN = 'PRUEBA_CARGA';
const CARGA_INFORME = 'prueba-carga-informe:';
const CARGA_OPERACIONES = 'prueba-carga-ops:';
const CARGA_EJECUCIONES = 20;                     // el límite es 20 disparadores por usuario
const CARGA_ESPERA_MS = 240000;                   // todas arrancan a la misma hora, 4 minutos después
const CARGA_MARGEN_MS = 90000;                    // los disparadores se programan este tiempo antes de la hora común
const CARGA_DURACION_MS = 120000;                 // cuánto dura la carga
const CARGA_COLA_MS = 60000;                      // lo que se espera después, para que terminen las operaciones en curso
const CARGA_TOPE_MS = 300000;                     // Apps Script corta cada ejecución a los 6 minutos: a los 5 deja de empezar operaciones
const CARGA_STANDS = 2;                           // stands con código que responde cada persona después del quiz de entrada
const CARGA_PENSAR_MS = [1000, 3000];             // lo que tarda en responder un quiz; en la feria son minutos, aquí se comprime
const CARGA_PROB_ACIERTO = 0.7;
const CARGA_PROB_CODIGO_MALO = 0.05;              // personas que escriben mal el código la primera vez
const CARGA_REINTENTOS_MS = [1500, 3000, 6000];   // los mismos de servidorInsistente (comun-script.html)
const CARGA_MINUTOS_CODIGO = 30;
const CARGA_PERSONAS_SOLAS = 2;                   // personas que se miden sin competencia antes de la carga
const CARGA_OPS_POR_PROPIEDAD = 150;              // una propiedad admite 9 KB
const CARGA_OPS_MAXIMAS = 600;

/* ---------- Piezas comunes ---------- */

/** ¿El correo es de esta prueba? Con "yo", solo los de esa ejecución. */
function esDeCarga_(email, yo) {
  return texto_(email).toLowerCase().indexOf(CARGA_PREFIJO + (yo ? yo + '-' : '')) === 0;
}

function planDeCarga_() {
  const guardado = PropertiesService.getScriptProperties().getProperty(CARGA_PLAN);
  return guardado ? JSON.parse(guardado) : null;
}

function horaDeCarga_(ms) {
  return Utilities.formatDate(new Date(ms), Session.getScriptTimeZone(), 'HH:mm:ss');
}

/** Estado de una ejecución de la prueba: a quién imita, hasta cuándo y lo que va anotando. */
function nuevaCarga_(yo, plan, salida, fin, tope) {
  // Los stands vienen en el plan y no del catálogo: así la ejecución no abre el Sheet antes de su primera petición.
  return {
    yo: yo, salida: salida, fin: fin, tope: tope, entrada: plan.entrada, conCodigo: plan.stands,
    retraso: 0, personas: 0, cartas: 0, sinEmpezar: 0, cartero: { pasada: 0, ocupada: 0, descanso: 0 },
    quizzes: [], ops: [], opsPerdidas: 0, errores: {}, artefactos: 0, sinPausas: false, sola: false,
  };
}

function sigueLaCarga_(ctx) {
  const ahora = Date.now();
  return ahora < ctx.fin && ahora < ctx.tope;
}

/** Cada petición real empieza con las variables globales limpias: la prueba las limpia antes de imitar una. */
function peticionDeCarga_() {
  LIBRO_ = null;
  CATALOGO_ = null;
  GENERACION_ = null;
  EPOCA_ = null;
}

/**
 * Anota una operación como [tipo, décimas de segundo desde la salida, ms, a, b, falló, extra].
 *  i  iniciar un quiz          a = ms en leer la cabecera y su bloque · b = ms en escribir su fila y confirmar
 *                              extra = 1 tuvo que pedir su número de orden en ese momento
 *  o  pedir el número de orden al empezar un quiz (la persona todavía no estaba registrada)
 *  e  enviar un quiz           a = ms en leer su fila, escribir y confirmar · extra = 1 el inicio no llegó a escribir su fila,
 *                              2 reintento que encontró el resultado ya guardado
 *  r  registrarme              a = ms en leer su nombre de Usuarios, al confirmar · extra = 1 ya tiene su número
 *  m  primer mapa              extra = filas propias encontradas en Intentos
 *  p  pasada del cartero       a = ms con el turno · b = filas escritas · extra = cartas leídas
 *  b  preguntas sin caché      se releyó la hoja Preguntas
 *  c  código mal escrito       se leyó la hoja Codigos
 */
function anotarOp_(ctx, tipo, inicio, ms, a, b, fallo, extra) {
  if (ctx.ops.length >= CARGA_OPS_MAXIMAS) { ctx.opsPerdidas++; return; }
  ctx.ops.push([tipo, Math.round((inicio - ctx.salida) / 100), ms, a || 0, b || 0, fallo ? 1 : 0, extra || 0]);
}

function anotarErrorDeCarga_(ctx, donde, error) {
  const clave = donde + ' · ' + String((error && error.message) || error).slice(0, 110);
  if (clave in ctx.errores || Object.keys(ctx.errores).length < 12) ctx.errores[clave] = (ctx.errores[clave] || 0) + 1;
}

function pausaDeCarga_(ctx, rango) {
  if (!ctx.sinPausas) Utilities.sleep(rango[0] + Math.floor(Math.random() * (rango[1] - rango[0])));
}

/** Lo que avisa el cartero (repartir_) mientras la prueba lo usa: cuenta cada aviso y anota las pasadas. */
function carteroDeCarga_(ctx) {
  return (evento, datos) => {
    ctx.cartero[evento]++;
    if (evento !== 'pasada') return;
    anotarOp_(ctx, 'p', Date.now() - datos.ms, datos.ms, datos.msConTurno, datos.escritas, !!datos.fallo, datos.cartas);
    // La pasada entregó los números pero no pudo escribir las filas en Usuarios: nadie se queda sin jugar, pero se anota.
    if (datos.fallo) anotarErrorDeCarga_(ctx, 'registro (filas de Usuarios, se reintenta)', datos.fallo);
  };
}

/** Deja la carta de una persona de mentira, igual que dejarCarta_ con una real. */
function dejarCartaDeCarga_(ctx, email) {
  const clave = PREFIJO_CARTA + email;
  if (buzon_().getProperty(clave)) return;
  buzon_().setProperty(clave, JSON.stringify({ n: 'Carga ' + email.split('@')[0].slice(CARGA_PREFIJO.length), t: Date.now() }));
  ctx.cartas++;
}

/* ---------- Lo que es de cada persona, imitado con la cuenta que ejecuta ---------- */

/** Lo que cuesta leer el índice de una persona (miIndice_): sus propiedades, el pedido de releer y la época. */
function costoDeIndice_(ctx, email) {
  try { PropertiesService.getUserProperties().getProperties(); } catch (error) { ctx.artefactos++; }
  cacheLeer_('releer:' + email);
  epoca_();
}

/** Lo que cuesta guardar algo en el índice (guardarEnIndice_, guardarOrden_). Cada ejecución escribe en una clave propia. */
function costoDeGuardar_(ctx, valor) {
  try { PropertiesService.getUserProperties().setProperty('prueba-carga:' + ctx.yo, JSON.stringify(valor)); } catch (error) { ctx.artefactos++; }
}

/**
 * Lo que cuesta tomar y soltar el bloqueo propio (conBloqueoPropio_). No se retiene: todas las ejecuciones de la
 * prueba usan la misma cuenta y se esperarían entre sí, cosa que no pasa entre personas distintas.
 */
function costoDeBloqueo_(ctx) {
  try {
    const bloqueo = LockService.getUserLock();
    if (bloqueo.tryLock(50)) bloqueo.releaseLock();
  } catch (error) {
    ctx.artefactos++;
    anotarErrorDeCarga_(ctx, 'bloqueo propio (solo de la prueba)', error);
  }
}

/* ---------- Lo que hace cada persona ---------- */

function personaDeCarga_(ctx, n) {
  // "orden" y "filas" son lo que la persona real tendría en su índice: su número y las filas que ya reservó.
  const persona = { email: CARGA_PREFIJO + ctx.yo + '-' + n + SIM_DOMINIO, orden: 0, filas: [] };
  ctx.personas++;
  const registrar = () => { if (!persona.orden && sigueLaCarga_(ctx)) registroDeCarga_(ctx, persona); };

  // La primera persona de cada ejecución pulsa "Empezar" sin esperar a su registro: recibe su número en ese momento.
  // Las demás se registran al abrir la app, como hace el navegador.
  if (n > 1) { registrar(); mapaDeCarga_(ctx, persona); }
  quizDeCarga_(ctx, persona, ctx.entrada);
  if (n === 1) mapaDeCarga_(ctx, persona);
  // El navegador vuelve a preguntar por su registro unos segundos después de entrar.
  registrar();
  sortear_(ctx.conCodigo, CARGA_STANDS).forEach(stand => { if (sigueLaCarga_(ctx)) quizDeCarga_(ctx, persona, stand); });
}

/** Lo que hace registrarme(): mirar si ya tiene número y, si no, dejar la carta e intentar una pasada. Al confirmarlo lee su nombre de Usuarios. */
function registroDeCarga_(ctx, persona) {
  const inicio = Date.now();
  let msHoja = 0;
  try {
    peticionDeCarga_();
    catalogo_();
    let orden = ordenDe_(persona.email);
    if (!orden) {
      dejarCartaDeCarga_(ctx, persona.email);
      orden = (repartir_(false, carteroDeCarga_(ctx)) || {})[persona.email] || 0;
    }
    if (orden) {
      persona.orden = orden;
      costoDeGuardar_(ctx, { orden: orden });
      const antesDeLaHoja = Date.now();
      usuariosEnHoja_();
      msHoja = Date.now() - antesDeLaHoja;
    }
    anotarOp_(ctx, 'r', inicio, Date.now() - inicio, msHoja, 0, false, orden ? 1 : 0);
  } catch (error) {
    anotarOp_(ctx, 'r', inicio, Date.now() - inicio, msHoja, 0, true);
    anotarErrorDeCarga_(ctx, 'registro', error);
  }
}

/** Primera visita al mapa: la persona arma su índice con sus filas de Intentos y el número de su marcador (reconstruirIndice_). */
function mapaDeCarga_(ctx, persona) {
  const inicio = Date.now();
  try {
    peticionDeCarga_();
    catalogo_();
    costoDeIndice_(ctx, persona.email);
    const filas = filasDeEmail_(persona.email).length;
    const orden = ordenDe_(persona.email);
    if (orden) persona.orden = orden;
    costoDeGuardar_(ctx, { epoca: epoca_(), orden: persona.orden });
    anotarOp_(ctx, 'm', inicio, Date.now() - inicio, 0, 0, false, filas);
  } catch (error) {
    anotarOp_(ctx, 'm', inicio, Date.now() - inicio, 0, 0, true);
    anotarErrorDeCarga_(ctx, 'mapa', error);
  }
}

/** Un quiz completo. Cada uno queda en el informe como [intento_id, inicio, envío, puntaje] (ver revisarPruebaCarga). */
function quizDeCarga_(ctx, persona, stand) {
  const quiz = ['', 0, 0, 0];
  const intento = inicioDeCarga_(ctx, persona, stand, quiz);
  if (!intento) return;
  ctx.quizzes.push(quiz);
  pausaDeCarga_(ctx, CARGA_PENSAR_MS);
  envioDeCarga_(ctx, persona, stand, intento, quiz);
}

/**
 * Empezar un quiz, con los reintentos del celular. Devuelve el intento, o null si ni así llegó a existir
 * (el celular mostraría "No pudimos empezar el quiz").
 */
function inicioDeCarga_(ctx, persona, stand, quiz) {
  for (let vez = 0; vez <= CARGA_REINTENTOS_MS.length; vez++) {
    if (Date.now() > ctx.tope) return null;
    const resultado = intentoDeInicio_(ctx, persona, stand, quiz);
    if (resultado.bien) return resultado.intento;
    if (vez < CARGA_REINTENTOS_MS.length && !ctx.sinPausas) Utilities.sleep(CARGA_REINTENTOS_MS[vez]);
    // Si el intento alcanzó a quedar en el índice, el reintento del celular lo retoma: su fila se escribirá al enviar.
    if (resultado.intento) return resultado.intento;
  }
  ctx.sinEmpezar++;
  return null;
}

/**
 * Lo que hace iniciarQuiz con alguien que todavía no respondió ese stand, en el mismo orden que la app: validar,
 * averiguar su número de orden, reservar una fila de su bloque, guardar el intento en el índice y escribir la fila.
 */
function intentoDeInicio_(ctx, persona, stand, quiz) {
  const inicio = Date.now();
  const resultado = { intento: null, bien: false };
  let msBloque = 0, msEscribir = 0, pidioNumero = 0;
  try {
    peticionDeCarga_();
    const catalogo = catalogo_();
    const enCache = !!cacheLeer_('preguntas:' + stand.id);
    const antesDelBanco = Date.now();
    const banco = preguntasDeStand_(stand.id);
    if (!enCache) anotarOp_(ctx, 'b', antesDelBanco, Date.now() - antesDelBanco);
    costoDeIndice_(ctx, persona.email);

    const ahora = new Date();
    let codigo = '';
    if (stand.requiereCodigo) {
      if (Math.random() < CARGA_PROB_CODIGO_MALO) {
        const antesDelCodigo = Date.now();
        codigoValido_(stand.id, 'ZZZZ', ahora.getTime());
        anotarOp_(ctx, 'c', antesDelCodigo, Date.now() - antesDelCodigo);
      }
      codigo = (cacheLeer_('codigo:' + stand.id) || {}).codigo || '';
      if (!codigoValido_(stand.id, codigo, ahora.getTime())) throw new Error('El código de prueba de ' + stand.id + ' ya no está vigente.');
    }
    if (banco.length < PREGUNTAS_POR_QUIZ) throw new Error('El stand ' + stand.id + ' se quedó sin preguntas.');

    const venceEn = new Date(ahora.getTime() + catalogo.config.minutos_para_responder * 60000);
    const intento = {
      id: nuevoIntentoId_(), e: 'EN_CURSO', i: ahora.getTime(), v: venceEn.getTime(),
      q: sortear_(banco, PREGUNTAS_POR_QUIZ).map(p => p.id), r: [], a: [], c: 0, p: 0, t: 0, s: 0, f: 0, k: codigo,
    };
    // Con el bloqueo propio, la app vuelve a leer el índice.
    costoDeBloqueo_(ctx);
    costoDeIndice_(ctx, persona.email);
    if (!persona.orden) {
      // miOrden_: sin número en el índice, se pide a su marcador y, si todavía no tiene, al registro por lotes.
      pidioNumero = 1;
      const antesDelNumero = Date.now();
      persona.orden = ordenUrgente_(persona.email, () => dejarCartaDeCarga_(ctx, persona.email), carteroDeCarga_(ctx));
      anotarOp_(ctx, 'o', antesDelNumero, Date.now() - antesDelNumero, 0, 0, !persona.orden);
      if (!persona.orden) throw new Error('Todavía no pudimos reservar tus filas. Inténtalo de nuevo en unos segundos.');
      costoDeGuardar_(ctx, { orden: persona.orden });
    }
    const antesDelBloque = Date.now();
    const encabezados = encabezados_(HOJA.INTENTOS);
    intento.f = filaLibreDe_(persona.orden, persona.email, encabezados, persona.filas);
    msBloque = Date.now() - antesDelBloque;
    // Primero el índice, después la hoja: el mismo orden que la app.
    persona.filas.push(intento.f);
    resultado.intento = intento;
    quiz[0] = intento.id;
    costoDeGuardar_(ctx, intento);
    const antesDeEscribir = Date.now();
    escribirInicio_(persona.email, stand, intento, encabezados);
    msEscribir = Date.now() - antesDeEscribir;
    intento.s = 1;
    costoDeGuardar_(ctx, intento);
    quiz[1] = 1;
    resultado.bien = true;
    anotarOp_(ctx, 'i', inicio, Date.now() - inicio, msBloque, msEscribir, false, pidioNumero);
  } catch (error) {
    anotarOp_(ctx, 'i', inicio, Date.now() - inicio, msBloque, msEscribir, true, pidioNumero);
    anotarErrorDeCarga_(ctx, 'inicio', error);
  }
  return resultado;
}

/**
 * Lo que hace enviarQuiz: corregir, guardar en el índice y dejar el resultado en la hoja, en el mismo orden que la app.
 * Si falla, reintenta como el celular. Al final anota en quiz[2]: 1 confirmado, 2 "No pudimos guardar tus respuestas",
 * 3 la prueba terminó antes de agotar los reintentos.
 */
function envioDeCarga_(ctx, persona, stand, intento, quiz) {
  for (let vez = 0; vez <= CARGA_REINTENTOS_MS.length; vez++) {
    if (Date.now() > ctx.tope) { quiz[2] = 3; return; }
    const inicio = Date.now();
    let msHoja = 0;
    const sinFila = quiz[1] ? 0 : 1;
    try {
      peticionDeCarga_();
      catalogo_();
      costoDeBloqueo_(ctx);
      costoDeIndice_(ctx, persona.email);
      if (intento.e === 'COMPLETADO' && intento.s) {
        // Reintento con el índice ya marcado: la app devuelve el resultado sin volver a escribir en la hoja.
        anotarOp_(ctx, 'e', inicio, Date.now() - inicio, 0, 0, false, 2);
        quiz[2] = 1;
        return;
      }
      if (intento.e !== 'COMPLETADO') {
        const banco = preguntasDeStand_(stand.id);
        let correctas = 0, puntaje = 0;
        intento.r = [];
        intento.a = [];
        intento.q.forEach(id => {
          const pregunta = banco.find(p => p.id === id);
          const elegida = pregunta && Math.random() < CARGA_PROB_ACIERTO ? pregunta.correcta : 'ABCD'.charAt(Math.floor(Math.random() * 4));
          const acierto = !!pregunta && elegida === pregunta.correcta;
          if (acierto) { correctas++; puntaje += pregunta.puntos; }
          intento.r.push(elegida);
          intento.a.push(acierto);
        });
        Object.assign(intento, { e: 'COMPLETADO', c: correctas, p: puntaje, t: Date.now(), s: 0 });
        quiz[3] = puntaje;
        costoDeGuardar_(ctx, intento);
      }
      // registrarResultado_ lee su fila, escribe y confirma. El índice se marca solo después.
      const antesDeLaHoja = Date.now();
      registrarResultado_({ email: persona.email }, stand.id, intento);
      msHoja = Date.now() - antesDeLaHoja;
      intento.s = 1;
      costoDeGuardar_(ctx, intento);
      // conBloqueoPropio_ confirma otra vez al soltar el bloqueo; a esta altura ya no queda nada pendiente.
      SpreadsheetApp.flush();
      anotarOp_(ctx, 'e', inicio, Date.now() - inicio, msHoja, 0, false, sinFila);
      quiz[2] = 1;
      return;
    } catch (error) {
      anotarOp_(ctx, 'e', inicio, Date.now() - inicio, msHoja, 0, true, sinFila);
      anotarErrorDeCarga_(ctx, 'envío', error);
    }
    if (vez < CARGA_REINTENTOS_MS.length && !ctx.sinPausas) Utilities.sleep(CARGA_REINTENTOS_MS[vez]);
  }
  quiz[2] = 2;
}

/* ---------- Ejecuciones ---------- */

/** Deja el informe de la ejecución en las propiedades del script, para revisarPruebaCarga. Primero el resumen, después el detalle. */
function guardarInformeDeCarga_(ctx, arranque, fatal) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(CARGA_INFORME + ctx.yo, JSON.stringify({
    yo: ctx.yo, sola: !!ctx.sola, retraso: ctx.retraso || 0, seg: Math.round((Date.now() - arranque) / 1000),
    personas: ctx.personas || 0, cartas: ctx.cartas || 0, sinEmpezar: ctx.sinEmpezar || 0, cartero: ctx.cartero || {}, quizzes: ctx.quizzes || [],
    errores: ctx.errores || {}, artefactos: ctx.artefactos || 0, opsPerdidas: ctx.opsPerdidas || 0, fatal: fatal || '',
  }));
  const ops = ctx.ops || [];
  try {
    for (let k = 0; k * CARGA_OPS_POR_PROPIEDAD < ops.length; k++) {
      props.setProperty(CARGA_OPERACIONES + ctx.yo + ':' + k, JSON.stringify(ops.slice(k * CARGA_OPS_POR_PROPIEDAD, (k + 1) * CARGA_OPS_POR_PROPIEDAD)));
    }
  } catch (error) {
    console.warn('No se pudo guardar el detalle de operaciones de ' + ctx.yo + ': ' + error.message);
  }
  try { PropertiesService.getUserProperties().deleteProperty('prueba-carga:' + ctx.yo); } catch (error) { /* no afecta al informe */ }
}

/** Lo que corre cada disparador: espera la hora común e imita a una persona tras otra hasta que termina la carga. */
function pasoPruebaCarga_() {
  const arranque = Date.now();
  const plan = planDeCarga_();
  if (!plan || !plan.salida) return;
  const yo = Utilities.getUuid().slice(0, 6);
  let ctx = null, fatal = '';
  try {
    ctx = nuevaCarga_(yo, plan, plan.salida, plan.fin, arranque + CARGA_TOPE_MS);
    const espera = plan.salida - Date.now();
    if (espera > 0) Utilities.sleep(espera);
    ctx.retraso = Math.max(0, Date.now() - plan.salida);
    let n = 0;
    while (sigueLaCarga_(ctx)) personaDeCarga_(ctx, ++n);
  } catch (error) {
    fatal = String(error.message).slice(0, 200);
    console.error('La ejecución ' + yo + ' se detuvo: ' + error.message);
  }
  guardarInformeDeCarga_(ctx || { yo: yo }, arranque, fatal);
  if (ctx) console.log('Ejecución ' + yo + ' · arrancó ' + (ctx.retraso / 1000).toFixed(1) + ' s tarde · personas ' + ctx.personas + ' · quizzes ' + ctx.quizzes.length + ' · operaciones ' + ctx.ops.length);
}

function crearDisparadoresDeCarga_(plan, cuantos) {
  const existentes = ScriptApp.getProjectTriggers();
  if (existentes.length + cuantos > 20) {
    throw new Error('Tu cuenta ya tiene ' + existentes.length + ' disparadores en este proyecto (' + existentes.map(t => t.getHandlerFunction()).join(', ') +
      ') y el límite es 20. Bórralos o usa menos ejecuciones.');
  }
  const cuando = new Date(Math.max(Date.now() + 5000, plan.salida - CARGA_MARGEN_MS));
  for (let i = 0; i < cuantos; i++) ScriptApp.newTrigger('pasoPruebaCarga_').timeBased().at(cuando).create();
}

function quitarMisDisparadoresDeCarga_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pasoPruebaCarga_').forEach(t => ScriptApp.deleteTrigger(t));
}

/** Para quien se sumó con sumarmeAPruebaCarga: los disparadores de cada cuenta solo los puede borrar esa cuenta. */
function quitarMisDisparadoresDeCarga() {
  exigirAdmin_();
  quitarMisDisparadoresDeCarga_();
}

/* ---------- 1. Iniciar ---------- */

function iniciarPruebaCarga() { iniciarPruebaCarga_(CARGA_EJECUCIONES); }
function iniciarPruebaCarga10() { iniciarPruebaCarga_(10); }
function iniciarPruebaCarga5() { iniciarPruebaCarga_(5); }

function iniciarPruebaCarga_(ejecuciones) {
  exigirAdmin_();
  if (encabezados_(HOJA.USUARIOS).indexOf('orden') < 0) throw new Error('Falta la columna "orden" en la hoja Usuarios. Agrégala antes de probar.');
  if (buzon_().getProperty(CLAVE_ULTIMO_ORDEN) === null) throw new Error('El registro todavía no tiene su contador de orden. Con Intentos vacía, ejecuta prepararFeria y vuelve a lanzar la prueba.');
  const borradas = limpiarPruebaCarga_();
  console.log('===== Prueba de carga de la feria: ' + ejecuciones + ' ejecuciones a la vez =====');
  if (borradas.Intentos || borradas.Usuarios) console.log('Restos de una prueba anterior borrados: ' + JSON.stringify(borradas));

  // El catálogo y las preguntas se releen ahora, para que la caché empiece la prueba recién puesta.
  const catalogo = refrescarCatalogo_();
  const completo = s => preguntasDeStand_(s.id, true).length >= PREGUNTAS_POR_BANCO;
  const entrada = catalogo.stands.find(s => !s.requiereCodigo);
  if (!entrada || !completo(entrada)) throw new Error('El quiz de entrada no existe o no tiene sus ' + PREGUNTAS_POR_BANCO + ' preguntas activas. Revisa con probarTodo.');
  const conCodigo = catalogo.stands.filter(s => s.requiereCodigo && completo(s));
  if (conCodigo.length < CARGA_STANDS) throw new Error('Hacen falta al menos ' + CARGA_STANDS + ' stands con código y con sus ' + PREGUNTAS_POR_BANCO + ' preguntas activas.');

  // Un código vigente por stand, en la caché, como lo deja generarCodigo. No se escribe en la hoja Codigos.
  const expiraEn = Date.now() + CARGA_MINUTOS_CODIGO * 60000;
  conCodigo.forEach(s => cachePoner_('codigo:' + s.id, { codigo: codigoAlAzar_(), expiraEn: expiraEn }, CARGA_MINUTOS_CODIGO * 60));

  const segundosDeCache = segundosDeCatalogo_(catalogo.config);
  const paraElPlan = s => ({ id: s.id, pabellonId: s.pabellonId, requiereCodigo: s.requiereCodigo });
  const plan = {
    ejecuciones: ejecuciones, entrada: paraElPlan(entrada), stands: conCodigo.map(paraElPlan),
    filasAntes: filasConDato_(HOJA.INTENTOS), ordenAntes: ultimoOrden_(), segundosDeCache: segundosDeCache,
  };
  console.log('Stands: ' + entrada.id + ' (entrada) y ' + conCodigo.length + ' con código · Intentos tiene ' + plan.filasAntes + ' filas con dato · bloques de ' +
    FILAS_POR_PERSONA + ' filas · último número de orden entregado: ' + plan.ordenAntes + ' · la caché del catálogo dura ' + segundosDeCache + ' s');
  if (segundosDeCache * 1000 < CARGA_ESPERA_MS + CARGA_DURACION_MS) {
    console.log('AVISO: con segundos_cache_catalogo en ' + segundosDeCache + ' la caché vence durante la prueba y las ejecuciones releerán las hojas, igual que pasaría en la feria.');
  }

  // Una persona tras otra, sin competencia: lo que tarda cada operación cuando nadie más escribe.
  const arranque = Date.now();
  const sola = nuevaCarga_('sola', plan, arranque, arranque + 60000, arranque + 60000);
  sola.sola = true;
  sola.sinPausas = true;
  for (let n = 1; n <= CARGA_PERSONAS_SOLAS; n++) personaDeCarga_(sola, n);
  guardarInformeDeCarga_(sola, arranque, '');
  console.log('Sin competencia (ms): ' + tiemposPorTipoDeCarga_(sola.ops));
  // Si ni una persona sola completa su recorrido, no tiene sentido gastar disparadores en veinte.
  if (sola.ops.some(op => op[5]) || sola.quizzes.some(quiz => quiz[2] !== 1)) {
    throw new Error('La medición sin competencia tuvo fallos, así que no se programó la carga. Errores: ' + (Object.keys(sola.errores).join(' | ') || 'quizzes sin completar'));
  }

  plan.salida = Date.now() + CARGA_ESPERA_MS;
  plan.fin = plan.salida + CARGA_DURACION_MS;
  PropertiesService.getScriptProperties().setProperty(CARGA_PLAN, JSON.stringify(plan));
  crearDisparadoresDeCarga_(plan, ejecuciones);
  console.log(ejecuciones + ' ejecuciones programadas: arrancan a las ' + horaDeCarga_(plan.salida) + ' y la carga dura ' + CARGA_DURACION_MS / 1000 + ' s.');
  console.log('Ejecuta revisarPruebaCarga a partir de las ' + horaDeCarga_(plan.fin + CARGA_COLA_MS) + '.');
  console.log('Otro admin puede sumar sus ejecuciones con sumarmeAPruebaCarga antes de las ' + horaDeCarga_(plan.salida - CARGA_MARGEN_MS) + '.');
}

/** Agrega las ejecuciones de otra cuenta a una prueba ya iniciada. No borra ni reinicia nada. */
function sumarmeAPruebaCarga() {
  exigirAdmin_();
  const plan = planDeCarga_();
  if (!plan || !plan.salida || plan.salida - Date.now() < 45000) {
    throw new Error('No hay una prueba por arrancar o faltan menos de 45 segundos. Quien la inicia ejecuta iniciarPruebaCarga y avisa.');
  }
  crearDisparadoresDeCarga_(plan, CARGA_EJECUCIONES);
  plan.ejecuciones += CARGA_EJECUCIONES;
  PropertiesService.getScriptProperties().setProperty(CARGA_PLAN, JSON.stringify(plan));
  console.log('Sumadas ' + CARGA_EJECUCIONES + ' ejecuciones: ahora son ' + plan.ejecuciones + ' y arrancan a las ' + horaDeCarga_(plan.salida) + '. Al terminar, ejecuta quitarMisDisparadoresDeCarga.');
}

/* ---------- 2. Revisar ---------- */

/** "n 40 · p50 310 · p90 820 · p95 990 · máx 1500" */
function tiemposDeCarga_(lista) {
  if (!lista.length) return 'ninguna';
  const orden = lista.slice().sort((a, b) => a - b);
  const p = q => orden[Math.min(orden.length - 1, Math.floor(q * orden.length))];
  return 'n ' + orden.length + ' · p50 ' + p(0.5) + ' · p90 ' + p(0.9) + ' · p95 ' + p(0.95) + ' · máx ' + orden[orden.length - 1];
}

function medianaDeCarga_(lista) {
  if (!lista.length) return 0;
  const orden = lista.slice().sort((a, b) => a - b);
  return orden[Math.floor(orden.length / 2)];
}

/** Resumen de una sola línea, para la medición sin competencia. */
function tiemposPorTipoDeCarga_(ops) {
  const bien = tipo => ops.filter(op => op[0] === tipo && !op[5]);
  const mediana = (tipo, campo) => medianaDeCarga_(bien(tipo).map(op => op[campo]));
  const fallidas = ops.filter(op => op[5]).length;
  return 'inicio ' + mediana('i', 2) + ' (leer su bloque ' + mediana('i', 3) + ', escribir ' + mediana('i', 4) + ') · envío ' + mediana('e', 2) + ' · registro ' + mediana('r', 2) +
    ' · primer mapa ' + mediana('m', 2) + ' · medianas de ' + bien('i').length + ' quizzes' + (fallidas ? ' · ' + fallidas + ' operaciones fallaron' : '');
}

function listaDeCarga_(lista) {
  return lista.length ? lista.length + ' -> ' + lista.slice(0, 8).join(', ') + (lista.length > 8 ? ' …' : '') : '0';
}

/** ¿La fila completada tiene lo que la persona envió? Devuelve el problema, o '' si está bien. */
function problemaDeFila_(fila, preguntas, puntajeEnviado) {
  let sorteadas, detalle;
  try {
    sorteadas = JSON.parse(fila.preguntas_json || '[]');
    detalle = JSON.parse(fila.respuestas_json || '[]');
  } catch (error) {
    return 'JSON ilegible';
  }
  if (detalle.length !== sorteadas.length || detalle.some((d, k) => id_(d.p) !== id_(sorteadas[k]))) return 'las respuestas no son de sus preguntas';
  let correctas = 0, puntaje = 0;
  detalle.forEach(d => {
    const pregunta = preguntas[id_(d.p)];
    if (pregunta && texto_(d.r).toUpperCase() === pregunta.correcta) { correctas++; puntaje += pregunta.puntos; }
  });
  if (correctas !== (Number(fila.correctas) || 0) || puntaje !== (Number(fila.puntaje) || 0)) return 'guardado ' + fila.puntaje + ' pts, recalculado ' + puntaje;
  if (puntaje !== puntajeEnviado) return 'la persona envió ' + puntajeEnviado + ' pts y la hoja tiene ' + puntaje;
  return '';
}

/** Compara lo que cada ejecución dio por hecho con lo que quedó en Intentos y Usuarios. */
function datosDeCarga_(informes) {
  const todas = leerHoja_(HOJA.INTENTOS);
  const filas = todas.filter(f => esDeCarga_(f.email));
  const porId = {};
  const porPersonaYStand = {};
  filas.forEach(f => {
    const id = id_(f.intento_id);
    (porId[id] = porId[id] || []).push(f);
    const clave = texto_(f.email).toLowerCase() + '|' + id_(f.stand_id);
    porPersonaYStand[clave] = (porPersonaYStand[clave] || 0) + 1;
  });
  const porDefecto = catalogo_().config.puntos_por_defecto;
  const preguntas = {};
  leerHoja_(HOJA.PREGUNTAS).forEach(p => {
    preguntas[id_(p.pregunta_id)] = { correcta: texto_(p.correcta).toUpperCase(), puntos: Number(p.puntos) || porDefecto };
  });

  const d = {
    filas: filas.length, quizzes: 0, iniciosConfirmados: 0, iniciosPerdidos: [], iniciosSinFila: 0, enviosConfirmados: 0, enviosPerdidos: [],
    noCoinciden: [], deOtraPersona: [], recuperadosAlEnviar: 0, noGuardados: 0, cortados: 0, sinEnviar: 0, duplicados: [], repetidos: [], sinDueno: [],
    ordenRepetido: [], ordenDistinto: [], sinConfirmar: [], fueraDeBloque: [], bloquesCompartidos: [],
  };
  const conocidos = {};
  informes.forEach(informe => (informe.quizzes || []).forEach(quiz => {
    const id = quiz[0], inicio = quiz[1], envio = quiz[2];
    const suyas = porId[id] || [];
    conocidos[id] = true;
    d.quizzes++;
    if (suyas.some(f => !esDeCarga_(f.email, informe.yo))) d.deOtraPersona.push(id);
    if (inicio === 1) {
      d.iniciosConfirmados++;
      if (!suyas.length) d.iniciosPerdidos.push(id);
    } else {
      d.iniciosSinFila++;
    }
    if (envio === 1) {
      d.enviosConfirmados++;
      const fila = suyas[0];
      if (!fila || texto_(fila.estado).toUpperCase() !== 'COMPLETADO') { d.enviosPerdidos.push(id); return; }
      const problema = problemaDeFila_(fila, preguntas, quiz[3]);
      if (problema) d.noCoinciden.push(id + ' (' + problema + ')');
      if (inicio !== 1) d.recuperadosAlEnviar++;
    } else if (envio === 2) d.noGuardados++;
    else if (envio === 3) d.cortados++;
    else d.sinEnviar++;
  }));
  d.duplicados = Object.keys(porId).filter(id => porId[id].length > 1);
  d.repetidos = Object.keys(porPersonaYStand).filter(clave => porPersonaYStand[clave] > 1);
  d.sinDueno = Object.keys(porId).filter(id => !conocidos[id]);

  // Filas propias: nadie comparte número de orden, cada fila está en el bloque de su dueño y en cada bloque hay un solo correo.
  // El número de cada persona es el de su marcador en las propiedades del script; la columna de Usuarios tiene que decir lo mismo.
  const propiedades = buzon_().getProperties();
  const numeroDe = email => parseInt(propiedades[PREFIJO_ORDEN + email], 10) || 0;
  const vecesPorOrden = {};
  Object.keys(propiedades).forEach(clave => {
    if (clave.indexOf(PREFIJO_ORDEN) !== 0) return;
    const orden = parseInt(propiedades[clave], 10) || 0;
    vecesPorOrden[orden] = (vecesPorOrden[orden] || 0) + 1;
    if (esDeCarga_(clave.slice(PREFIJO_ORDEN.length)) && propiedades[clave].slice(-1) === ORDEN_SIN_FILA) d.sinConfirmar.push(clave.slice(PREFIJO_ORDEN.length));
  });
  d.ordenRepetido = Object.keys(vecesPorOrden).filter(orden => vecesPorOrden[orden] > 1);
  leerHoja_(HOJA.USUARIOS, ['email', 'orden']).forEach(u => {
    const email = texto_(u.email).toLowerCase();
    if (esDeCarga_(email) && (Number(u.orden) || 0) !== numeroDe(email)) d.ordenDistinto.push(email + ' (hoja ' + u.orden + ', entregado ' + numeroDe(email) + ')');
  });
  filas.forEach(f => {
    const orden = numeroDe(texto_(f.email).toLowerCase());
    if (!orden || ordenDeFila_(f._fila) !== orden) d.fueraDeBloque.push(id_(f.intento_id) + ' (fila ' + f._fila + ', orden ' + (orden || 'sin número') + ')');
  });
  const correosPorBloque = {};
  todas.forEach(f => {
    const bloque = ordenDeFila_(f._fila);
    const email = texto_(f.email).toLowerCase();
    const lista = correosPorBloque[bloque] || (correosPorBloque[bloque] = []);
    if (lista.indexOf(email) < 0) lista.push(email);
  });
  // Solo cuentan los bloques donde aparece alguien de la prueba: lo demás puede ser relleno o datos anteriores.
  d.bloquesCompartidos = Object.keys(correosPorBloque).filter(bloque => correosPorBloque[bloque].length > 1 && correosPorBloque[bloque].some(email => esDeCarga_(email)));
  return d;
}

function revisarPruebaCarga() {
  exigirAdmin_();
  const todas = PropertiesService.getScriptProperties().getProperties();
  const plan = todas[CARGA_PLAN] ? JSON.parse(todas[CARGA_PLAN]) : null;
  if (!plan || !plan.salida) throw new Error('No hay ninguna prueba de carga que revisar. Empieza con iniciarPruebaCarga.');
  const falta = plan.fin + CARGA_COLA_MS - Date.now();
  if (falta > 0) throw new Error('La prueba todavía no termina. Vuelve a ejecutar revisarPruebaCarga dentro de ' + Math.ceil(falta / 1000) + ' segundos.');
  quitarMisDisparadoresDeCarga_();

  const informes = Object.keys(todas).filter(clave => clave.indexOf(CARGA_INFORME) === 0).map(clave => JSON.parse(todas[clave]));
  const opsDe = informe => {
    const lista = [];
    for (let k = 0; todas[CARGA_OPERACIONES + informe.yo + ':' + k]; k++) JSON.parse(todas[CARGA_OPERACIONES + informe.yo + ':' + k]).forEach(op => lista.push(op));
    return lista;
  };
  const sola = informes.find(informe => informe.sola);
  const deCarga = informes.filter(informe => !informe.sola);
  const suma = campo => deCarga.reduce((total, informe) => total + (informe[campo] || 0), 0);
  const ops = [];
  deCarga.forEach(informe => opsDe(informe).forEach(op => ops.push(op)));

  // Lo que en la app haría la siguiente persona que entre: una pasada del cartero con lo que quedó en el buzón.
  const cartasPendientes = leerBuzon_().filter(c => esDeCarga_(c.email)).length;
  let pasadaFinal = '';
  try {
    repartir_(true, (evento, datos) => { pasadaFinal = frasePasada_(evento, datos); });
  } catch (error) {
    pasadaFinal = 'ERROR: ' + error.message;
  }
  const d = datosDeCarga_(informes);
  const enUsuarios = leerHoja_(HOJA.USUARIOS, ['email']).map(u => texto_(u.email).toLowerCase()).filter(e => esDeCarga_(e));
  const usuariosRepetidos = enUsuarios.length - distintos_(enUsuarios);
  const cartasDejadas = informes.reduce((total, informe) => total + (informe.cartas || 0), 0);
  const enBuzon = leerBuzon_().filter(c => esDeCarga_(c.email)).length;
  const terminaron = deCarga.length === plan.ejecuciones && !!sola;

  // Sin todos los informes no se sabe qué dio por hecho cada ejecución: lo que no cuadra por eso no cuenta como falla.
  const fallas = d.iniciosPerdidos.length + d.enviosPerdidos.length + d.noCoinciden.length + d.deOtraPersona.length +
    d.duplicados.length + d.repetidos.length + d.ordenRepetido.length + d.ordenDistinto.length + d.sinConfirmar.length +
    d.fueraDeBloque.length + d.bloquesCompartidos.length + usuariosRepetidos + enBuzon +
    (terminaron ? d.sinDueno.length + Math.abs(enUsuarios.length - cartasDejadas) : 0);

  console.log('===== Prueba de carga de la feria · ' + plan.ejecuciones + ' ejecuciones a la vez · ' + (plan.fin - plan.salida) / 1000 + ' s · salida ' + horaDeCarga_(plan.salida) + ' =====');
  console.log('Versión ' + VERSION_DEL_CODIGO + ' · filas propias, bloques de ' + FILAS_POR_PERSONA + ' · Intentos tenía ' + plan.filasAntes + ' filas con dato · último orden antes de la prueba ' + plan.ordenAntes +
    ' · caché del catálogo ' + plan.segundosDeCache + ' s');
  console.log('DATOS: ' + (fallas ? 'FALLA' : 'OK') + (terminaron ? '' : ' · INCOMPLETO: terminaron ' + deCarga.length + ' de ' + plan.ejecuciones + ' ejecuciones' + (sola ? '' : ' y falta la medición sin competencia') + '. Si siguen corriendo, vuelve a revisar en un minuto.'));
  const retrasos = deCarga.map(informe => Math.round((informe.retraso || 0) / 1000));
  console.log('Ejecuciones: ' + deCarga.length + ' de ' + plan.ejecuciones + ' · arrancaron tarde (s): ' + tiemposDeCarga_(retrasos) + ' · personas imitadas: ' + suma('personas') +
    ' · minutos de disparador usados: ' + Math.round(suma('seg') / 60));

  console.log('--- Datos: lo que cada persona dio por hecho contra lo que quedó en la hoja ---');
  console.log('Quizzes: ' + d.quizzes + ' · filas de prueba en Intentos: ' + d.filas);
  console.log('Inicios confirmados: ' + d.iniciosConfirmados + ' · sin su fila (PERDIDOS): ' + listaDeCarga_(d.iniciosPerdidos));
  console.log('Envíos confirmados: ' + d.enviosConfirmados + ' · sin quedar COMPLETADO en la hoja (PERDIDOS): ' + listaDeCarga_(d.enviosPerdidos));
  console.log('Completados con contenido distinto al enviado: ' + listaDeCarga_(d.noCoinciden));
  console.log('Filas con el correo de otra persona: ' + listaDeCarga_(d.deOtraPersona));
  console.log('intento_id en más de una fila (DUPLICADOS): ' + listaDeCarga_(d.duplicados) + ' · persona y stand repetidos: ' + listaDeCarga_(d.repetidos));
  console.log('Filas de prueba que ninguna ejecución reconoce: ' + listaDeCarga_(d.sinDueno));
  console.log('Números de orden entregados a más de una persona: ' + listaDeCarga_(d.ordenRepetido));
  console.log('Personas con otro número en la hoja Usuarios que el entregado: ' + listaDeCarga_(d.ordenDistinto) + ' · con número pero sin fila confirmada: ' + listaDeCarga_(d.sinConfirmar));
  console.log('Filas fuera del bloque de su dueño: ' + listaDeCarga_(d.fueraDeBloque) + ' · bloques con más de un correo: ' + listaDeCarga_(d.bloquesCompartidos));
  console.log('Inicios que no llegaron a escribir su fila (el quiz siguió con el índice): ' + d.iniciosSinFila + ' · de esos, completados al enviar: ' + d.recuperadosAlEnviar);
  console.log('Quizzes que el celular habría dado por no empezados ("No pudimos empezar el quiz"): ' + suma('sinEmpezar'));
  console.log('Envíos que el celular habría dado por no guardados ("No pudimos guardar tus respuestas"): ' + d.noGuardados + ' · reintentos cortados por el fin de la prueba: ' + d.cortados + ' · quizzes sin enviar: ' + d.sinEnviar);
  console.log('Usuarios: cartas dejadas ' + cartasDejadas + ' · filas ' + enUsuarios.length + ' · repetidas ' + usuariosRepetidos + ' · cartas sin recoger al terminar ' + cartasPendientes + ' · en el buzón tras la pasada final ' + enBuzon);
  console.log('Pasada final del cartero: ' + (pasadaFinal || 'no hizo falta'));

  const de = (tipo, filtro) => ops.filter(op => op[0] === tipo && (!filtro || filtro(op)));
  const bien = op => !op[5];
  const mal = op => !!op[5];
  console.log('--- Tiempos en ms (n · p50 · p90 · p95 · máx) ---');
  if (sola) console.log('Sin competencia, antes de la carga: ' + tiemposPorTipoDeCarga_(opsDe(sola)));
  console.log('Iniciar un quiz, total: ' + tiemposDeCarga_(de('i', bien).map(op => op[2])));
  console.log('  ya con su número de orden: ' + tiemposDeCarga_(de('i', op => !op[5] && !op[6]).map(op => op[2])));
  console.log('  pidiendo su número en ese momento (acaba de llegar): ' + tiemposDeCarga_(de('i', op => !op[5] && op[6] === 1).map(op => op[2])));
  console.log('  leer la cabecera y su bloque: ' + tiemposDeCarga_(de('i', bien).map(op => op[3])));
  console.log('  escribir su fila y confirmar: ' + tiemposDeCarga_(de('i', bien).map(op => op[4])));
  console.log('Pedir el número de orden al empezar: ' + tiemposDeCarga_(de('o', bien).map(op => op[2])) + ' · no lo consiguieron ' + de('o', mal).length);
  console.log('Inicios fallidos (cada reintento cuenta): ' + tiemposDeCarga_(de('i', mal).map(op => op[2])));
  console.log('Enviar un quiz, total: ' + tiemposDeCarga_(de('e', bien).map(op => op[2])));
  console.log('  leer su fila, escribir y confirmar: ' + tiemposDeCarga_(de('e', op => !op[5] && op[6] !== 2).map(op => op[3])));
  console.log('  envíos de quizzes cuyo inicio no llegó a escribir su fila (la escriben completa): ' + tiemposDeCarga_(de('e', op => !op[5] && op[6] === 1).map(op => op[2])));
  console.log('  reintentos que encontraron el resultado ya guardado (la respuesta anterior falló después de escribir): ' + de('e', op => !op[5] && op[6] === 2).length);
  console.log('Envíos fallidos (cada reintento cuenta): ' + tiemposDeCarga_(de('e', mal).map(op => op[2])));
  console.log('Registrarme: ' + tiemposDeCarga_(de('r', bien).map(op => op[2])) + ' · fallidos ' + de('r', mal).length);
  console.log('Primer mapa (armar el índice): ' + tiemposDeCarga_(de('m', bien).map(op => op[2])) + ' · fallidos ' + de('m', mal).length);
  console.log('Pasadas del cartero, con el turno: ' + tiemposDeCarga_(de('p').map(op => op[3])) + ' · filas por pasada: ' + tiemposDeCarga_(de('p').map(op => op[4])));
  console.log('Cartero: pasó ' + deCarga.reduce((t, i) => t + ((i.cartero || {}).pasada || 0), 0) + ' veces · turno ocupado ' + deCarga.reduce((t, i) => t + ((i.cartero || {}).ocupada || 0), 0) +
    ' · en descanso ' + deCarga.reduce((t, i) => t + ((i.cartero || {}).descanso || 0), 0));
  console.log('Preguntas releídas de la hoja por falta de caché: ' + tiemposDeCarga_(de('b').map(op => op[2])));
  console.log('Códigos mal escritos (leen la hoja Codigos): ' + tiemposDeCarga_(de('c').map(op => op[2])));

  const duracion = plan.fin - plan.salida;
  const enVentana = op => op[1] >= 0 && op[1] * 100 < duracion;
  const minutos = duracion / 60000;
  const msConTurno = de('p', enVentana).reduce((t, op) => t + op[3], 0);
  console.log('--- Capacidad ---');
  console.log('Inicios logrados por minuto: ' + Math.round(de('i', op => !op[5] && enVentana(op)).length / minutos) + ' · envíos logrados por minuto: ' + Math.round(de('e', op => !op[5] && enVentana(op)).length / minutos) +
    ' · inicios fallidos por minuto: ' + Math.round(de('i', op => op[5] && enVentana(op)).length / minutos));
  console.log('Turno global ocupado el ' + Math.round(100 * msConTurno / duracion) + ' % del tiempo. Ahora solo lo usa el registro por lotes: empezar y enviar un quiz ya no lo piden.');

  console.log('--- Errores (mensaje y veces) ---');
  const errores = {};
  deCarga.forEach(informe => Object.keys(informe.errores || {}).forEach(clave => { errores[clave] = (errores[clave] || 0) + informe.errores[clave]; }));
  if (!Object.keys(errores).length) console.log('ninguno');
  Object.keys(errores).sort((a, b) => errores[b] - errores[a]).forEach(clave => console.log(errores[clave] + ' × ' + clave));
  deCarga.filter(informe => informe.fatal).forEach(informe => console.log('La ejecución ' + informe.yo + ' se detuvo: ' + informe.fatal));
  const artefactos = suma('artefactos');
  if (artefactos) console.log('Fallos al imitar lo propio de cada persona (no son de la app): ' + artefactos);
  const opsPerdidas = suma('opsPerdidas');
  if (opsPerdidas || ops.length === 0) console.log('AVISO: faltan operaciones en el detalle (' + opsPerdidas + ' no cupieron); los tiempos de arriba son parciales.');

  console.log('--- Cada 10 s: inicios bien/mal · inicio p50/máx · envíos bien/mal · envío p50/máx ---');
  const maximo = lista => (lista.length ? Math.max.apply(null, lista) : 0);
  for (let tramo = 0; tramo * 10000 < duracion + CARGA_COLA_MS; tramo++) {
    const suyo = op => Math.floor(op[1] / 100) === tramo;
    const inicios = de('i', suyo), envios = de('e', suyo);
    if (!inicios.length && !envios.length) continue;
    const msInicios = inicios.filter(bien).map(op => op[2]), msEnvios = envios.filter(bien).map(op => op[2]);
    console.log('+' + tramo * 10 + ' s · inicios ' + inicios.filter(bien).length + '/' + inicios.filter(mal).length + ' · inicio ' + medianaDeCarga_(msInicios) + '/' + maximo(msInicios) +
      ' · envíos ' + envios.filter(bien).length + '/' + envios.filter(mal).length + ' · envío ' + medianaDeCarga_(msEnvios) + '/' + maximo(msEnvios));
  }

  console.log('--- Por ejecución ---');
  deCarga.forEach(informe => {
    const quizzes = informe.quizzes || [];
    console.log(informe.yo + ' · arrancó ' + ((informe.retraso || 0) / 1000).toFixed(1) + ' s tarde · duró ' + informe.seg + ' s · personas ' + informe.personas +
      ' · inicios ' + quizzes.filter(q => q[1] === 1).length + ' con fila, ' + quizzes.filter(q => q[1] !== 1).length + ' sin fila, ' + (informe.sinEmpezar || 0) + ' sin empezar' +
      ' · envíos ' + quizzes.filter(q => q[2] === 1).length + ' confirmados, ' + quizzes.filter(q => q[2] === 2).length + ' no guardados' + (informe.fatal ? ' · SE DETUVO' : ''));
  });
  console.log('Las filas de prueba se conservan para revisarlas. Al terminar, ejecuta limpiarPruebaCarga.');
}

/* ---------- 3. Limpiar ---------- */

/** Borra disparadores, plan, informes, cartas, códigos y filas de prueba. Devuelve las filas borradas de cada hoja. */
function limpiarPruebaCarga_() {
  quitarMisDisparadoresDeCarga_();
  const props = PropertiesService.getScriptProperties();
  const todas = props.getProperties();
  const plan = todas[CARGA_PLAN] ? JSON.parse(todas[CARGA_PLAN]) : null;
  Object.keys(todas).forEach(clave => {
    const esCarta = clave.indexOf(PREFIJO_CARTA + CARGA_PREFIJO) === 0;
    if (esCarta || clave === CARGA_PLAN || clave.indexOf(CARGA_INFORME) === 0 || clave.indexOf(CARGA_OPERACIONES) === 0) props.deleteProperty(clave);
  });
  if (plan) (plan.stands || []).forEach(s => cacheQuitar_('codigo:' + s.id));
  borrarMarcadores_(email => esDeCarga_(email));

  const borradas = { Intentos: 0, Usuarios: 0 };
  const turno = LockService.getScriptLock();
  turno.waitLock(SEGUNDOS_BLOQUEO);
  try {
    // En Intentos las filas de prueba se vacían en su lugar; en Usuarios las que quedan se juntan arriba (borrarFilasSim_).
    // borrarFilasSim_ lee la hoja entera: primero se mira solo la columna de correo, por si no hay nada que borrar.
    [HOJA.INTENTOS, HOJA.USUARIOS].forEach(nombre => {
      if (leerHoja_(nombre, ['email']).some(f => esDeCarga_(f.email))) borradas[nombre] = borrarFilasSim_(nombre, f => esDeCarga_(f.email));
    });
    SpreadsheetApp.flush();
  } finally {
    turno.releaseLock();
  }
  return borradas;
}

function limpiarPruebaCarga() {
  exigirAdmin_();
  console.log('Filas de prueba borradas: ' + JSON.stringify(limpiarPruebaCarga_()));
}
