/**
 * SIMULACIÓN DE PUNTAJES EN PARALELO: escribe intentos COMPLETADO en la hoja Intentos para ver cómo se mueve el tablero.
 * 50 personas simuladas (los mismos correos de simulacion.gs; limpiarSimulacion() los borra).
 *
 * Cada tanda escribe 3 intentos de 3 personas distintas, con puntajes distintos. Las tandas se separan unos segundos
 * y cada escritura toma el LockService: si varias llegan a la vez, una espera a que la otra termine.
 * El bloqueo solo dura lo que tarda escribir la tanda (no los segundos de espera), para no frenar a las personas reales.
 *
 * Duración: 5 minutos. Un disparador corre cada minuto y cada corrida hace varias tandas.
 *
 * Uso: iniciarPuntajes() para arrancar, detenerPuntajes() para parar.
 */

const PUNTAJES_MINUTOS = 5;                 // duración total de la simulación
const PUNTAJES_PERSONAS = 50;               // personas simuladas
const PUNTAJES_POR_TANDA = 3;               // intentos que se escriben juntos, de personas distintas
const PUNTAJES_TANDAS_POR_CORRIDA = 6;      // tandas dentro de cada corrida del disparador (una por minuto)
const PUNTAJES_SEGUNDOS_ENTRE_TANDAS = 9;   // espera entre tandas de una misma corrida

function iniciarPuntajes() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PUNTAJES_INICIO')) throw new Error('La simulación de puntajes ya está corriendo. Usa detenerPuntajes() para pararla.');
  borrarDisparadoresPuntajes_();
  // La marca de inicio se guarda solo si el disparador se creó: si falla, no queda una simulación a medias.
  ScriptApp.newTrigger('pasoPuntajes').timeBased().everyMinutes(1).create();
  props.setProperty('PUNTAJES_INICIO', String(Date.now()));
  pasoPuntajes();
}

function detenerPuntajes() {
  borrarDisparadoresPuntajes_();
  PropertiesService.getScriptProperties().deleteProperty('PUNTAJES_INICIO');
}

/** Lo que corre cada minuto: hace varias tandas separadas por unos segundos y se detiene a los 5 minutos. */
function pasoPuntajes() {
  const inicio = Number(PropertiesService.getScriptProperties().getProperty('PUNTAJES_INICIO'));
  if (!inicio) return borrarDisparadoresPuntajes_();
  if ((Date.now() - inicio) / 60000 >= PUNTAJES_MINUTOS) {
    detenerPuntajes();
    console.log('Simulación de puntajes terminada tras ' + PUNTAJES_MINUTOS + ' minutos.');
    return;
  }
  for (let t = 0; t < PUNTAJES_TANDAS_POR_CORRIDA; t++) {
    escribirTandaPuntajes_();
    if (t < PUNTAJES_TANDAS_POR_CORRIDA - 1) Utilities.sleep(PUNTAJES_SEGUNDOS_ENTRE_TANDAS * 1000);
  }
}

/** Una tanda: 3 intentos de 3 personas distintas, escritos dentro del bloqueo. */
function escribirTandaPuntajes_() {
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const catalogo = catalogo_();
    const puntosPorAcierto = Number(catalogo.config.puntos_por_defecto) || 10;
    // Una persona no repite el mismo stand: se revisa lo que ya existe, incluidas las tandas anteriores.
    const usados = new Set(leerHoja_(HOJA.INTENTOS).filter(esSimulado_)
      .map(f => texto_(f.email).toLowerCase() + '|' + id_(f.stand_id)));

    // Personas al azar, distintas entre sí, y solo las que todavía tienen un stand por hacer.
    const orden = Array.from({ length: PUNTAJES_PERSONAS }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    let escritos = 0;
    for (const i of orden) {
      if (escritos === PUNTAJES_POR_TANDA) break;
      const email = correoSim_(i);
      const pendientes = catalogo.stands.filter(s => !usados.has(email + '|' + s.id));
      if (!pendientes.length) continue;
      const stand = pendientes[Math.floor(Math.random() * pendientes.length)];
      usados.add(email + '|' + stand.id);

      // Puntaje distinto en cada intento: de 1 a 4 respuestas correctas.
      const correctas = 1 + Math.floor(Math.random() * PREGUNTAS_POR_QUIZ);
      agregarFila_(HOJA.INTENTOS, {
        intento_id: 'INT-' + String(hoja_(HOJA.INTENTOS).getLastRow()).padStart(4, '0'),
        email: email, stand_id: stand.id, pabellon_id: stand.pabellonId, codigo: '',
        preguntas_json: '[]', iniciado_en: new Date(Date.now() - 3 * 60000), vence_en: new Date(Date.now() + 2 * 60000),
        estado: 'COMPLETADO', respuestas_json: '[]',
        correctas: correctas, puntaje: correctas * puntosPorAcierto, completado_en: new Date(),
      });
      escritos++;
    }

    // El tablero se entera en el siguiente refresco, sin esperar la caché.
    cacheQuitar_('ranking');
    console.log('Tanda de puntajes: ' + escritos + ' intentos escritos.');
  } finally {
    bloqueo.releaseLock();
  }
}

function borrarDisparadoresPuntajes_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'pasoPuntajes')
    .forEach(t => ScriptApp.deleteTrigger(t));
}
