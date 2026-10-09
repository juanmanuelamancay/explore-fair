/**
 * SIMULACIÓN DEL DÍA DE LA FERIA. Escribe en las hojas reales Usuarios, Intentos y Codigos.
 *
 * 200 personas (correos @simulacion.ejemplo, sin registro en Staff, así que son usuarios de la feria)
 * responden el quiz de entrada y después stands con código, a distintas horas, durante 30 minutos.
 * Sigue las reglas de la app: un quiz en curso a la vez, el quiz de entrada primero, 4 preguntas,
 * 10 puntos (o lo que diga el banco) por respuesta correcta, códigos vigentes y tiempo de respuesta de Config.
 *
 * Uso:
 *  1. iniciarSimulacion()  -> arranca; un disparador corre cada minuto durante 30 minutos.
 *  2. detenerSimulacion()  -> la para antes de tiempo (los datos ya escritos se conservan).
 *  3. limpiarSimulacion()  -> borra todo lo simulado (Usuarios, Intentos y Codigos de la simulación).
 *
 * Apps Script corta cada ejecución a los 6 minutos; cada paso dura unos segundos, por eso se usa el disparador.
 */

const SIM_PERSONAS = 200;
const SIM_MINUTOS = 30;
const SIM_DOMINIO = '@simulacion.ejemplo';
const SIM_GENERADOR = 'SIMULACION';
const SIM_PROB_INICIO = 0.35;       // por minuto, si la persona no tiene un quiz abierto
const SIM_PROB_ACIERTO = 0.7;       // qué tan seguido elige la correcta
const SIM_NOMBRES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fernando', 'Gabriela', 'Héctor', 'Inés', 'Javier', 'Karla', 'Luis', 'Mariana', 'Nicolás', 'Olga', 'Pablo', 'Rosa', 'Sergio', 'Teresa', 'Víctor'];
const SIM_APELLIDOS = ['García', 'Pérez', 'López', 'Ramos', 'Torres', 'Díaz', 'Ruiz', 'Mora', 'Castro', 'Vega', 'Soto', 'Rojas', 'Silva', 'Paz', 'Reyes', 'Núñez', 'Ortiz', 'Méndez', 'Luna', 'Bravo'];

/** Arranca la simulación. Solo una a la vez. */
function iniciarSimulacion() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SIM_INICIO')) throw new Error('La simulación ya está corriendo. Usa detenerSimulacion() para pararla.');
  props.setProperty('SIM_INICIO', String(Date.now()));
  borrarDisparadoresSimulacion_();
  ScriptApp.newTrigger('pasoSimulacion').timeBased().everyMinutes(1).create();
  pasoSimulacion();
}

/** Para la simulación. Lo ya escrito se queda; para borrarlo usa limpiarSimulacion(). */
function detenerSimulacion() {
  borrarDisparadoresSimulacion_();
  PropertiesService.getScriptProperties().deleteProperty('SIM_INICIO');
}

/** Borra todo lo simulado de Usuarios, Intentos y Codigos. Los datos reales no se tocan. */
function limpiarSimulacion() {
  detenerSimulacion();
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const borrados = {
      Intentos: borrarFilasSim_(HOJA.INTENTOS, esSimulado_),
      Usuarios: borrarFilasSim_(HOJA.USUARIOS, esSimulado_),
      Codigos: borrarFilasSim_(HOJA.CODIGOS, f => texto_(f.generado_por) === SIM_GENERADOR),
    };
    limpiarCache();
    console.log('Simulación borrada: ' + JSON.stringify(borrados));
    return borrados;
  } finally {
    bloqueo.releaseLock();
  }
}

/** Lo que corre cada minuto. Termina sola al cumplirse los 30 minutos. */
function pasoSimulacion() {
  const props = PropertiesService.getScriptProperties();
  const inicio = Number(props.getProperty('SIM_INICIO'));
  if (!inicio) return borrarDisparadoresSimulacion_();
  const transcurridos = (Date.now() - inicio) / 60000;
  if (transcurridos >= SIM_MINUTOS) {
    detenerSimulacion();
    console.log('Simulación terminada tras ' + SIM_MINUTOS + ' minutos.');
    return;
  }

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const ahora = Date.now();
    const catalogo = catalogo_();
    const config = catalogo.config;
    const entrada = catalogo.stands.find(s => !s.requiereCodigo);
    const conCodigo = catalogo.stands.filter(s => s.requiereCodigo);

    // 1. Los quizzes en curso que ya debieron terminar, se completan con respuestas al azar.
    const intentos = leerHoja_(HOJA.INTENTOS).filter(esSimulado_);
    const cerrados = completarQuizzes_(intentos, ahora);

    // 2. Llegan personas nuevas, repartidas a lo largo de los 30 minutos.
    const yaLlegaron = leerHoja_(HOJA.USUARIOS).filter(esSimulado_).length;
    const llegan = llegadasSim_(yaLlegaron, transcurridos);
    for (let i = yaLlegaron + 1; i <= yaLlegaron + llegan; i++) {
      agregarFila_(HOJA.USUARIOS, { email: correoSim_(i), nombre: nombreSim_(i), registrado_en: new Date(ahora) });
    }
    const personas = yaLlegaron + llegan;

    // 3. Códigos vigentes por stand. El líder los genera en la app real; aquí se crean igual.
    const codigos = codigosVigentesSim_(conCodigo, config, ahora);

    // 4. Cada persona decide si empieza otro quiz en este minuto. Los bancos se leen una sola vez por corrida.
    const bancos = {};
    [entrada, ...conCodigo].forEach(s => { bancos[s.id] = preguntasDeStand_(s.id); });
    let iniciados = 0;
    for (let i = 1; i <= personas; i++) {
      const email = correoSim_(i);
      const suyos = intentos.filter(x => texto_(x.email).toLowerCase() === email);
      if (suyos.some(x => texto_(x.estado).toUpperCase() === 'EN_CURSO')) continue;

      const hechos = new Set(suyos.map(x => id_(x.stand_id)));
      const objetivo = 2 + (i % 5);      // cada persona recorre entre 2 y 6 quizzes
      if (hechos.size >= objetivo) continue;
      if (Math.random() > SIM_PROB_INICIO) continue;

      // El quiz de entrada va primero; después un stand al azar que no haya hecho.
      let siguiente = null;
      if (!hechos.has(entrada.id)) siguiente = entrada;
      else {
        const pendientes = conCodigo.filter(s => !hechos.has(s.id) && bancos[s.id].length >= PREGUNTAS_POR_QUIZ);
        if (pendientes.length) siguiente = pendientes[Math.floor(Math.random() * pendientes.length)];
      }
      if (!siguiente) continue;
      iniciarQuizSim_(email, siguiente, codigos[siguiente.id], bancos[siguiente.id], config, ahora);
      iniciados++;
    }

    console.log('Minuto ' + transcurridos.toFixed(1) + ': llegaron ' + llegan + ' (total ' + personas + '), iniciaron ' + iniciados + ', completaron ' + cerrados.completados + ', vencieron ' + cerrados.vencidos + '.');
  } finally {
    bloqueo.releaseLock();
  }
}

/* ---------- Pasos internos ---------- */

function borrarDisparadoresSimulacion_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'pasoSimulacion')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function esSimulado_(fila) {
  return texto_(fila.email).toLowerCase().endsWith(SIM_DOMINIO);
}

/**
 * Correo con el nombre de la persona: "ana.garcia094@...". El número evita repetidos y el ranking
 * puede sacar el nombre del correo cuando no hay fila en Usuarios (nombreDesdeEmail_ quita los dígitos).
 */
function correoSim_(i) {
  const nombre = SIM_NOMBRES[(i - 1) % SIM_NOMBRES.length];
  const apellido = SIM_APELLIDOS[Math.floor((i - 1) / SIM_NOMBRES.length) % SIM_APELLIDOS.length];
  return normal_(nombre) + '.' + normal_(apellido) + String(i).padStart(3, '0') + SIM_DOMINIO;
}

function nombreSim_(i) {
  const nombre = SIM_NOMBRES[(i - 1) % SIM_NOMBRES.length];
  const apellido = SIM_APELLIDOS[Math.floor((i - 1) / SIM_NOMBRES.length) % SIM_APELLIDOS.length];
  return nombre + ' ' + apellido;
}

/** Cuántas personas llegan en este minuto para llegar a 200 al final de los 30. */
function llegadasSim_(yaLlegaron, transcurridos) {
  const restantes = SIM_PERSONAS - yaLlegaron;
  if (restantes <= 0) return 0;
  const minutosRestantes = SIM_MINUTOS - transcurridos;
  if (minutosRestantes <= 1.5) return restantes;
  const ritmo = restantes / minutosRestantes;
  return Math.min(restantes, Math.round(ritmo * (0.6 + Math.random() * 0.8)));
}

/** Código vigente de cada stand; si no hay uno, se crea como lo haría el líder. */
function codigosVigentesSim_(stands, config, ahora) {
  const activos = leerHoja_(HOJA.CODIGOS).filter(c => texto_(c.estado).toUpperCase() === 'ACTIVO' && ms_(c.expira_en) > ahora);
  const usados = new Set(activos.map(c => texto_(c.codigo).toUpperCase()));
  const mapa = {};
  stands.forEach(s => {
    const vigente = activos.find(c => id_(c.stand_id) === s.id);
    if (vigente) { mapa[s.id] = texto_(vigente.codigo).toUpperCase(); return; }
    let codigo;
    do { codigo = codigoAlAzar_(); } while (usados.has(codigo));
    usados.add(codigo);
    mapa[s.id] = codigo;
    agregarFila_(HOJA.CODIGOS, {
      codigo: codigo, stand_id: s.id, generado_por: SIM_GENERADOR, creado_en: new Date(ahora),
      expira_en: new Date(ahora + config.minutos_vigencia_codigo * 60000), estado: 'ACTIVO',
    });
  });
  return mapa;
}

function iniciarQuizSim_(email, stand, codigo, banco, config, ahora) {
  const sorteadas = sortear_(banco, PREGUNTAS_POR_QUIZ);
  agregarFila_(HOJA.INTENTOS, {
    intento_id: 'INT-' + String(hoja_(HOJA.INTENTOS).getLastRow()).padStart(4, '0'),
    email: email, stand_id: stand.id, pabellon_id: stand.pabellonId,
    codigo: stand.requiereCodigo ? codigo : '',
    preguntas_json: JSON.stringify(sorteadas.map(p => p.id)),
    iniciado_en: new Date(ahora), vence_en: new Date(ahora + config.minutos_para_responder * 60000),
    estado: 'EN_CURSO',
  });
}

/**
 * Cierra los quizzes en curso: cada uno tarda entre 1 y 4 minutos (según su id, así es repetible).
 * Si ya pasó su tiempo sin terminar, queda VENCIDO.
 */
function completarQuizzes_(intentos, ahora) {
  const letras = ['A', 'B', 'C', 'D'];
  let completados = 0, vencidos = 0;
  intentos.filter(x => texto_(x.estado).toUpperCase() === 'EN_CURSO').forEach(x => {
    if (ms_(x.vence_en) <= ahora) {
      actualizarFila_(HOJA.INTENTOS, x._fila, { estado: 'VENCIDO', correctas: 0, puntaje: 0 });
      x.estado = 'VENCIDO';
      vencidos++;
      return;
    }
    const duracion = (60 + (hashSim_(x.intento_id) % 180)) * 1000;
    if (ms_(x.iniciado_en) + duracion > ahora) return;

    const banco = preguntasDeStand_(id_(x.stand_id));
    let correctas = 0, puntaje = 0;
    const detalle = JSON.parse(x.preguntas_json).map(id => {
      const pregunta = banco.find(p => p.id === id);
      let elegida;
      if (pregunta && Math.random() < SIM_PROB_ACIERTO) elegida = pregunta.correcta;
      else {
        const otras = letras.filter(l => !pregunta || l !== pregunta.correcta);
        elegida = otras[Math.floor(Math.random() * otras.length)];
      }
      const ok = !!pregunta && elegida === pregunta.correcta;
      if (ok) { correctas++; puntaje += pregunta.puntos; }
      return { p: id, r: elegida, ok: ok };
    });
    actualizarFila_(HOJA.INTENTOS, x._fila, {
      estado: 'COMPLETADO', respuestas_json: JSON.stringify(detalle),
      correctas: correctas, puntaje: puntaje, completado_en: new Date(ahora),
    });
    x.estado = 'COMPLETADO';
    completados++;
  });
  return { completados: completados, vencidos: vencidos };
}

/** Número estable a partir de un texto; sirve para que cada intento tarde lo mismo en cada corrida. */
function hashSim_(texto) {
  let h = 0;
  for (const c of String(texto)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Borra las filas que cumplen el criterio, dejando intactos los encabezados y las demás filas. */
function borrarFilasSim_(nombre, criterio) {
  const hoja = hoja_(nombre);
  const ultima = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (ultima < 2) return 0;
  const valores = hoja.getRange(1, 1, ultima, columnas).getValues();
  const encabezados = valores[0].map(normal_);
  const conservadas = [];
  let borradas = 0;
  for (let r = 1; r < valores.length; r++) {
    const fila = {};
    encabezados.forEach((e, c) => { if (e) fila[e] = valores[r][c]; });
    if (criterio(fila)) borradas++;
    else conservadas.push(valores[r]);
  }
  if (conservadas.length) hoja.getRange(2, 1, conservadas.length, columnas).setValues(conservadas);
  const sobran = ultima - 1 - conservadas.length;
  if (sobran > 0) hoja.getRange(2 + conservadas.length, 1, sobran, columnas).clearContent();
  return borradas;
}
