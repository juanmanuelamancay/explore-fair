/**
 * Vista PREGUNTAS: el expositor de un stand o el ponente de una charla revisa y edita las preguntas de su banco,
 * incluida la respuesta correcta. El alcance sale de la hoja Staff (stand_id para el expositor, charla_id para el ponente).
 * El admin y el validador ven todos los bancos; el validador solo lee.
 */

/**
 * Bancos de preguntas que esta persona puede ver o editar: un stand por banco en los pabellones y uno por charla.
 * "maximo" es el tope de preguntas activas que puede tener (y el mínimo con el que el quiz se abre).
 */
function bancosParaPreguntas_(sesion, catalogo) {
  const todos = [];
  pabellonesDelMapa_(catalogo).forEach(p => {
    const unidad = unidadPorId_(catalogo, p.id);
    unidad.bancos.forEach(b => todos.push({ id: b.id, nombre: b.nombre, pabellon: unidad.nombre, indice: p.indice, maximo: Math.max(b.minimo, b.cuantas) }));
  });
  charlasDe_(catalogo).forEach((c, i) => {
    const b = c.bancos[0];
    todos.push({ id: b.id, nombre: c.nombre, pabellon: 'Taller', indice: i, maximo: Math.max(b.minimo, b.cuantas) });
  });
  if (sesion.rol === 'ADMIN' || sesion.rol === 'VALIDADOR') return todos;
  // Una persona puede tener varias filas (expositor y ponente a la vez): el alcance es la suma de los de cada fila.
  const filas = filasDeSesion_(sesion);
  return todos.filter(b => filas.some(f =>
    (f.rol === 'EXPOSITOR' && b.id === f.standId) ||
    (f.rol === 'PONENTE' && b.id === f.charlaId)));
}

/** Preguntas de los bancos que esta persona puede editar, con la respuesta correcta. */
function obtenerBancoPreguntas() {
  const sesion = exigirVista_('PREGUNTAS');
  const bancos = bancosParaPreguntas_(sesion, catalogo_());
  const ids = bancos.map(b => b.id);
  return {
    stands: bancos,
    preguntas: leerHoja_(HOJA.PREGUNTAS)
      .filter(p => ids.indexOf(id_(p.stand_id)) >= 0)
      .map(preguntaParaLider_),
  };
}

function preguntaParaLider_(p) {
  return {
    id: id_(p.pregunta_id),
    standId: id_(p.stand_id),
    texto: texto_(p.texto),
    opciones: [texto_(p.opcion_a), texto_(p.opcion_b), texto_(p.opcion_c), texto_(p.opcion_d)],
    correcta: texto_(p.correcta).toUpperCase(),
    puntos: Number(p.puntos) || 0,
    activo: esVerdadero_(p.activo),
  };
}

/**
 * Crea o actualiza una pregunta de un banco del expositor o ponente. Solo cambia el enunciado, las opciones y la
 * respuesta correcta; el puntaje y el estado activo los decide el administrador.
 * Una pregunta nueva se rechaza si el banco ya tiene su tope de preguntas activas (el admin no tiene ese tope).
 */
function guardarPreguntaLider(entrada) {
  const sesion = exigirVista_('PREGUNTAS');
  if (sesion.rol === 'VALIDADOR') throw new Error('Tu rol solo puede ver las preguntas, no editarlas.');
  const bancos = bancosParaPreguntas_(sesion, catalogo_());
  const alcance = bancos.map(b => b.id);
  if (!entrada || !Array.isArray(entrada.opciones) || entrada.opciones.length !== 4) throw new Error('La pregunta necesita cuatro opciones.');

  // El turno es global: todo lo que va dentro tiene que ser corto. Se lee la hoja Preguntas una sola vez y de esa
  // lectura salen la pregunta original, las activas del banco, el siguiente ID y los encabezados para escribir.
  // El banco y el permiso ya están garantizados por "alcance" y exigirVista_ (catálogo en caché), así que no se
  // vuelven a leer Pabellones, Stands ni Permisos.
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const lectura = leerHojaCompleta_(HOJA.PREGUNTAS);
    const hoja = lectura.filas;
    const original = entrada.id ? hoja.find(p => id_(p.pregunta_id) === id_(entrada.id)) : null;
    if (original && alcance.indexOf(id_(original.stand_id)) < 0) throw new Error('Esa pregunta no es de tus bancos.');

    // Al editar, el banco no cambia: una pregunta se queda donde se creó.
    const bancoId = original ? id_(original.stand_id) : id_(entrada.standId);
    if (alcance.indexOf(bancoId) < 0) throw new Error('No puedes agregar preguntas a este banco.');

    // El líder no define el puntaje ni si la pregunta está activa: al editar se conservan los actuales.
    // Una pregunta nueva vale lo que diga Config y solo se crea si todavía cabe en el banco.
    const activasOtras = hoja.filter(p => id_(p.stand_id) === bancoId && esVerdadero_(p.activo) && (!original || p._fila !== original._fila)).length;
    const maximo = bancos.find(b => b.id === bancoId).maximo;
    if (!original && sesion.rol !== 'ADMIN' && activasOtras >= maximo) {
      throw new Error('Este banco ya tiene sus ' + maximo + ' preguntas activas. Edita una de las que ya hay: no se pueden agregar más.');
    }
    const registro = adminNormalizar_('preguntas', {
      pregunta_id: original ? original.pregunta_id : '',
      stand_id: bancoId,
      texto: entrada.texto,
      opcion_a: entrada.opciones[0], opcion_b: entrada.opciones[1], opcion_c: entrada.opciones[2], opcion_d: entrada.opciones[3],
      correcta: entrada.correcta,
      puntos: original ? original.puntos : (Number(catalogo_().config.puntos_por_defecto) || 10),
      activo: original ? esVerdadero_(original.activo) : true,
    });
    adminValidarContenidoPregunta_(registro);

    if (original) {
      actualizarFila_(HOJA.PREGUNTAS, original._fila, registro, lectura);
    } else {
      const secuencia = adminSiguienteId_('preguntas', 'PRG', hoja);
      registro.pregunta_id = secuencia.id;
      registro.creado_en = new Date();
      agregarFila_(HOJA.PREGUNTAS, registro, lectura.encabezados);
      PropertiesService.getScriptProperties().setProperty(secuencia.propiedad, String(secuencia.numero));
    }
    // Sin esto, quien sigue en la cola del turno podría leer la hoja antes de que se confirme esta escritura.
    SpreadsheetApp.flush();
    cacheQuitar_('preguntas:' + bancoId);
  } finally {
    bloqueo.releaseLock();
  }
  return obtenerBancoPreguntas();
}
