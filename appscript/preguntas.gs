/**
 * Vista PREGUNTAS: el líder revisa y edita las preguntas de sus stands, incluida la respuesta correcta.
 * El alcance sale de la hoja Staff (pabellon_id / stand_id), igual que en GENERAR_CODIGO.
 */

/** Preguntas de los stands que esta persona puede editar, con la respuesta correcta. */
function obtenerBancoPreguntas() {
  const sesion = exigirVista_('PREGUNTAS');
  const stands = standsALiderar_(sesion, catalogo_());
  const ids = stands.map(s => s.id);
  return {
    maximo: PREGUNTAS_POR_BANCO,
    stands: stands.map(s => ({ id: s.id, nombre: s.nombre, pabellon: s.pabellon, indice: s.indice })),
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
 * Crea o actualiza una pregunta de un stand del líder. Solo cambia el enunciado, las opciones y la
 * respuesta correcta; el puntaje y el estado activo los decide el administrador.
 */
function guardarPreguntaLider(entrada) {
  const sesion = exigirVista_('PREGUNTAS');
  if (sesion.rol === 'VALIDADOR') throw new Error('Tu rol solo puede ver las preguntas, no editarlas.');
  const alcance = standsALiderar_(sesion, catalogo_()).map(s => s.id);
  if (!entrada || !Array.isArray(entrada.opciones) || entrada.opciones.length !== 4) throw new Error('La pregunta necesita cuatro opciones.');

  // El turno es global: todo lo que va dentro tiene que ser corto. Se lee la hoja Preguntas una sola vez y de esa
  // lectura salen la pregunta original, las activas del stand, el siguiente ID y los encabezados para escribir.
  // El stand y el permiso ya están garantizados por "alcance" y exigirVista_ (catálogo en caché), así que no se
  // vuelven a leer Pabellones, Stands ni Permisos.
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const lectura = leerHojaCompleta_(HOJA.PREGUNTAS);
    const hoja = lectura.filas;
    const original = entrada.id ? hoja.find(p => id_(p.pregunta_id) === id_(entrada.id)) : null;
    if (original && alcance.indexOf(id_(original.stand_id)) < 0) throw new Error('Esa pregunta no es de tus stands.');

    // Al editar, el stand no cambia: una pregunta se queda en el stand donde se creó.
    const standId = original ? id_(original.stand_id) : id_(entrada.standId);
    if (alcance.indexOf(standId) < 0) throw new Error('No puedes agregar preguntas a este stand.');

    // El líder no define el puntaje ni si la pregunta está activa: al editar se conservan los actuales.
    // Una pregunta nueva vale lo que diga Config y queda activa solo si todavía cabe en el banco del stand.
    const activasOtras = hoja.filter(p => id_(p.stand_id) === standId && esVerdadero_(p.activo) && (!original || p._fila !== original._fila)).length;
    const registro = adminNormalizar_('preguntas', {
      pregunta_id: original ? original.pregunta_id : '',
      stand_id: standId,
      texto: entrada.texto,
      opcion_a: entrada.opciones[0], opcion_b: entrada.opciones[1], opcion_c: entrada.opciones[2], opcion_d: entrada.opciones[3],
      correcta: entrada.correcta,
      puntos: original ? original.puntos : (Number(catalogo_().config.puntos_por_defecto) || 10),
      activo: original ? esVerdadero_(original.activo) : activasOtras < PREGUNTAS_POR_BANCO,
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
    cacheQuitar_('preguntas:' + standId);
  } finally {
    bloqueo.releaseLock();
  }
  return obtenerBancoPreguntas();
}
