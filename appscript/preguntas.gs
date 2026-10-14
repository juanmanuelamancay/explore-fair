/**
 * Vista PREGUNTAS: el expositor de un stand o el ponente de una charla revisa y edita las preguntas de su banco,
 * incluida la respuesta correcta. El alcance sale de la hoja Staff (stand_id para el expositor, charla_id para el ponente).
 * El admin y el validador ven todos los bancos; el validador solo lee.
 */

// Cuánto se recuerda un lote ya guardado, para que un reintento no lo duplique (CacheService admite hasta 6 horas).
const SEGUNDOS_LOTE_GUARDADO = 21600;
// Marca de los errores que llegan antes de la primera escritura: nada cambió y la app puede dejar el borrador editable.
const MARCA_NO_GUARDADO = 'NO_GUARDADO|';

/**
 * Bancos de preguntas que esta persona puede ver o editar: un stand por banco en los pabellones y uno por charla.
 * "maximo" es el tope de preguntas activas que puede tener (y el mínimo con el que el quiz se abre).
 */
function bancosParaPreguntas_(sesion, catalogo) {
  const todos = [];
  pabellonesDelMapa_(catalogo).forEach(p => {
    const unidad = unidadPorId_(catalogo, p.id);
    unidad.bancos.forEach(b => todos.push({ id: b.id, nombre: b.nombre, pabellon: unidad.nombre, indice: p.indice, taller: false, maximo: Math.max(b.minimo, b.cuantas) }));
  });
  charlasDe_(catalogo).forEach((c, i) => {
    const b = c.bancos[0];
    todos.push({ id: b.id, nombre: c.nombre, pabellon: 'Taller', indice: i, taller: true, maximo: Math.max(b.minimo, b.cuantas) });
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
 * Crea o actualiza una sola pregunta. La vista usa guardarPreguntasLider; esto queda para las pruebas y para quien
 * llame con una pregunta suelta.
 */
function guardarPreguntaLider(entrada) {
  return guardarPreguntasLider([entrada]).banco;
}

/**
 * Guarda de una vez las preguntas que el expositor o ponente cambió en su borrador: editadas y nuevas.
 *
 * - Todo o nada: cada entrada se valida antes de escribir la primera, así que un error no deja cambios a medias.
 * - Idempotente con "idLote": si el mismo lote llega otra vez (la respuesta se perdió y la app reintenta), no se
 *   vuelve a escribir; se devuelven las mismas preguntas creadas. Sin idLote, cada llamada escribe.
 * - Los errores que pasan antes de la primera escritura llevan la marca MARCA_NO_GUARDADO: nada cambió.
 *
 * Solo cambia el enunciado, las opciones y la respuesta correcta; el puntaje y el estado activo los decide el admin.
 * Las preguntas nuevas cuentan para el tope junto con las activas que ya tiene el banco (el admin no tiene tope).
 * Devuelve el banco actualizado, los IDs de las preguntas creadas (en el mismo orden) y si el lote ya estaba guardado.
 */
function guardarPreguntasLider(entradas, idLote) {
  const avance = { escrito: false };
  try {
    return guardarPreguntasLiderEn_(entradas, idLote, avance);
  } catch (error) {
    throw new Error((avance.escrito ? '' : MARCA_NO_GUARDADO) + error.message);
  }
}

function guardarPreguntasLiderEn_(entradas, idLote, avance) {
  const sesion = exigirVista_('PREGUNTAS');
  if (sesion.rol === 'VALIDADOR') throw new Error('Tu rol solo puede ver las preguntas, no editarlas.');
  if (!Array.isArray(entradas) || !entradas.length) throw new Error('No hay cambios que guardar.');
  const lote = typeof idLote === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(idLote) ? idLote : '';
  const bancos = bancosParaPreguntas_(sesion, catalogo_());
  const alcance = bancos.map(b => b.id);

  // El turno es global: todo lo que va dentro tiene que ser corto. Se lee la hoja Preguntas una sola vez y de esa
  // lectura salen las preguntas originales, las activas de cada banco, los siguientes IDs y los encabezados para escribir.
  // El banco y el permiso ya están garantizados por "alcance" y exigirVista_ (catálogo en caché), así que no se
  // vuelven a leer Pabellones, Stands ni Permisos.
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    // Dentro del turno: dos reintentos a la vez no pueden escribir los dos.
    const previo = lote ? cacheLeer_('lote-preguntas:' + lote) : null;
    if (previo) return { banco: obtenerBancoPreguntas(), creadas: previo.creadas, repetido: true };

    const lectura = leerHojaCompleta_(HOJA.PREGUNTAS);
    const hoja = lectura.filas;

    // Activas que ya tiene cada banco. Cada pregunta nueva que se valida suma aquí, para que el tope cuente el lote entero.
    const activasPorBanco = {};
    hoja.forEach(p => {
      if (!esVerdadero_(p.activo)) return;
      const banco = id_(p.stand_id);
      activasPorBanco[banco] = (activasPorBanco[banco] || 0) + 1;
    });

    const listos = [];
    const vistos = {};
    entradas.forEach(entrada => {
      // Un error dice de qué pregunta viene, por el principio de su texto: en un lote no se sabe cuál es sin eso.
      const quien = entradas.length > 1 && entrada && entrada.texto ? '«' + texto_(entrada.texto).slice(0, 40) + '»: ' : '';
      try {
        if (!entrada || !Array.isArray(entrada.opciones) || entrada.opciones.length !== 4) throw new Error('La pregunta necesita cuatro opciones.');
        const original = entrada.id ? hoja.find(p => id_(p.pregunta_id) === id_(entrada.id)) : null;
        if (original && alcance.indexOf(id_(original.stand_id)) < 0) throw new Error('Esa pregunta no es de tus bancos.');
        if (original && vistos[id_(original.pregunta_id)]) throw new Error('Esa pregunta está dos veces en los cambios.');

        // Al editar, el banco no cambia: una pregunta se queda donde se creó.
        const bancoId = original ? id_(original.stand_id) : id_(entrada.standId);
        if (alcance.indexOf(bancoId) < 0) throw new Error('No puedes agregar preguntas a este banco.');

        // El líder no define el puntaje ni si la pregunta está activa: al editar se conservan los actuales.
        // Una pregunta nueva vale lo que diga Config.
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
          vistos[id_(original.pregunta_id)] = true;
        } else {
          const maximo = bancos.find(b => b.id === bancoId).maximo;
          if (sesion.rol !== 'ADMIN' && (activasPorBanco[bancoId] || 0) >= maximo) {
            throw new Error('Este banco ya tiene sus ' + maximo + ' preguntas activas. Edita una de las que ya hay: no se pueden agregar más.');
          }
          activasPorBanco[bancoId] = (activasPorBanco[bancoId] || 0) + 1;
        }
        listos.push({ original: original, registro: registro, bancoId: bancoId });
      } catch (error) {
        throw new Error(quien + error.message);
      }
    });

    // Toda la lista está validada: ahora sí se escribe. Las nuevas toman IDs consecutivos desde el siguiente libre.
    const nuevas = listos.filter(l => !l.original);
    const siguiente = nuevas.length ? adminSiguienteId_('preguntas', 'PRG', hoja) : null;
    nuevas.forEach((l, i) => {
      l.registro.pregunta_id = 'PRG-' + String(siguiente.numero + i).padStart(3, '0');
      l.registro.creado_en = new Date();
    });
    const creadas = nuevas.map(l => l.registro.pregunta_id);
    const bancosTocados = listos.map(l => l.bancoId).filter((b, i, todos) => todos.indexOf(b) === i);

    avance.escrito = true;
    listos.filter(l => l.original).forEach(l => actualizarFila_(HOJA.PREGUNTAS, l.original._fila, l.registro, lectura));
    if (nuevas.length) {
      agregarFilas_(HOJA.PREGUNTAS, nuevas.map(l => l.registro));
      PropertiesService.getScriptProperties().setProperty(siguiente.propiedad, String(siguiente.numero + nuevas.length - 1));
    }
    // Se recuerda el lote antes de soltar el turno: un reintento que llegue después ve que ya se escribió.
    if (lote) cachePoner_('lote-preguntas:' + lote, { creadas: creadas }, SEGUNDOS_LOTE_GUARDADO);

    // Sin esto, quien sigue en la cola del turno podría leer la hoja antes de que se confirme esta escritura.
    SpreadsheetApp.flush();
    bancosTocados.forEach(b => cacheQuitar_('preguntas:' + b));
    return { banco: obtenerBancoPreguntas(), creadas: creadas, repetido: false };
  } finally {
    bloqueo.releaseLock();
  }
}
