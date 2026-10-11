/**
 * Vista QUIZ: validar el código, entregar las preguntas sin la respuesta correcta y corregir en el servidor.
 * Los intentos de cada persona se leen y escriben en su índice (indice.gs); la hoja Intentos se escribe
 * dos veces por intento: al empezar y al enviar. Las dos veces en la misma fila, que es del bloque de la
 * persona: no se agrega nada al final de la hoja, así que no hace falta el turno global.
 */

const GRACIA_DE_ENVIO_MS = 10000;   // tolerancia de red al enviar justo al límite

function falla_(motivo, mensaje) { return { ok: false, motivo: motivo, mensaje: mensaje }; }

/**
 * Identificador único sin mirar cuántas filas tiene la hoja. Con bloqueos por persona, dos personas
 * podrían leer la misma cantidad de filas y recibir el mismo número.
 */
function nuevoIntentoId_() {
  return 'INT-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}

/**
 * Hora en que este envío llegó por primera vez al servidor. Los reintentos del celular conservan esa hora,
 * para que una mala señal no haga vencer un quiz que se respondió a tiempo.
 */
function primeraLlegada_(intentoId) {
  const cacheMia = CacheService.getUserCache();
  const clave = 'llegada:' + id_(intentoId);
  const guardada = Number(cacheMia.get(clave));
  if (guardada) return guardada;
  const ahora = Date.now();
  cacheMia.put(clave, String(ahora), 900);
  return ahora;
}

/**
 * Crea el intento y devuelve las preguntas sorteadas. Si la persona ya tiene un intento
 * en curso para ese stand (cerró la app y volvió), devuelve las mismas preguntas sin pedir código.
 */
/**
 * Solo el usuario (quien no está en Staff) tiene número de orden y bloque en Intentos. Admin y líder no responden
 * quizzes: no reciben número ni fila en Usuarios, y sin número no hay dónde escribir el intento.
 */
function iniciarQuiz(standId, codigo) {
  const sesion = exigirVista_('QUIZ');
  if (sesion.rol !== 'USUARIO') return falla_('STAFF', 'Tu rol no responde quizzes.');
  const catalogo = catalogo_();
  const stand = catalogo.stands.find(s => s.id === id_(standId));
  if (!stand) return falla_('STAND', 'Este stand no está disponible.');
  if (!catalogo.config.feria_abierta) return falla_('CERRADA', 'La feria todavía no está abierta.');

  let banco = preguntasDeStand_(stand.id);
  const ahora = new Date();

  const mios = miIndice_(sesion);
  if (mios[stand.id]) return retomarIndice_(mios[stand.id], banco, ahora);

  // El quiz de entrada va primero: ningún stand se abre hasta haberlo terminado (respondido o vencido).
  const entrada = catalogo.stands.find(s => !s.requiereCodigo);
  if (stand.requiereCodigo && entrada) {
    const deEntrada = mios[entrada.id];
    const enCurso = deEntrada && deEntrada.e === 'EN_CURSO' && deEntrada.v > ahora.getTime();
    if (!deEntrada || enCurso) return falla_('ENTRADA', 'Primero responde el quiz de entrada.');
  }

  if (stand.requiereCodigo && !codigoValido_(stand.id, codigo, ahora.getTime())) {
    return falla_('CODIGO', 'Código inválido o vencido. Pídele uno nuevo al líder.');
  }

  // Puede ser la caché de antes de cargar las preguntas en el Sheet: se relee una vez antes de fallar.
  if (banco.length < PREGUNTAS_POR_BANCO) banco = preguntasDeStand_(stand.id, true);
  if (banco.length < PREGUNTAS_POR_BANCO) {
    return falla_('SIN_PREGUNTAS', 'Este stand todavía no tiene sus preguntas listas: tiene ' + banco.length + ' activas y necesita ' + PREGUNTAS_POR_BANCO + '.');
  }
  const sorteadas = sortear_(banco, stand.numPreguntas);
  const venceEn = new Date(ahora.getTime() + catalogo.config.minutos_para_responder * 60000);
  const intento = {
    id: nuevoIntentoId_(), e: 'EN_CURSO', i: ahora.getTime(), v: venceEn.getTime(),
    q: sorteadas.map(p => p.id), r: [], a: [], c: 0, p: 0, t: 0, s: 0,
    f: 0, k: stand.requiereCodigo ? texto_(codigo).toUpperCase() : '',
  };

  const creado = conBloqueoPropio_(() => {
    // Con el bloqueo el índice se lee de nuevo: dos toques seguidos no deben crear dos intentos.
    const indice = miIndice_(sesion);
    if (indice[stand.id]) return { repetido: indice[stand.id] };
    const encabezados = encabezados_(HOJA.INTENTOS);
    const reservadas = Object.keys(indice).map(s => indice[s].f).filter(Boolean);
    intento.f = filaLibreDe_(miOrden_(sesion), sesion.email, encabezados, reservadas);
    // Primero el índice: si la hoja falla después, el reintento encuentra este mismo intento con su fila ya reservada.
    guardarEnIndice_(stand.id, intento);
    escribirInicio_(sesion.email, stand, intento, encabezados);
    intento.s = 1;
    guardarEnIndice_(stand.id, intento);
    return { nuevo: intento };
  });
  if (creado.repetido) return retomarIndice_(creado.repetido, banco, ahora);
  return inicioDeQuiz_(intento.id, sorteadas, venceEn.getTime());
}

/** Lo que lleva la fila de un intento al empezar. */
function filaDeInicio_(email, standId, pabellonId, intento) {
  return {
    intento_id: intento.id, email: email, stand_id: standId, pabellon_id: pabellonId, codigo: intento.k || '',
    preguntas_json: JSON.stringify(intento.q),
    iniciado_en: new Date(intento.i), vence_en: new Date(intento.v), estado: 'EN_CURSO',
  };
}

/** Escribe la fila de inicio en la fila reservada del intento y la confirma. Esa fila es del bloque de la persona: nadie más escribe ahí. */
function escribirInicio_(email, stand, intento, encabezados) {
  escribirFila_(HOJA.INTENTOS, intento.f, filaDeInicio_(email, stand.id, stand.pabellonId, intento), encabezados);
  SpreadsheetApp.flush();
}

/** Intento que ya existe en el índice: no crea nada, solo vuelve a mostrar sus preguntas o dice por qué no se puede. */
function retomarIndice_(intento, banco, ahora) {
  if (intento.e === 'COMPLETADO') return falla_('YA_RESPONDIDO', 'Ya respondiste este stand.');
  if (intento.e !== 'EN_CURSO' || intento.v <= ahora.getTime()) {
    return falla_('VENCIDO', 'Se te venció el tiempo en este stand. No se puede repetir.');
  }
  const preguntas = intento.q.map(id => banco.find(p => p.id === id)).filter(Boolean);
  return inicioDeQuiz_(intento.id, preguntas, intento.v);
}

/** Lo que viaja al celular: enunciado y opciones. La respuesta correcta se queda en el servidor. */
function inicioDeQuiz_(intentoId, preguntas, venceEnMs) {
  return {
    ok: true, intentoId: intentoId, venceEn: venceEnMs, ahora: Date.now(),
    preguntas: preguntas.map(p => ({ id: p.id, texto: p.texto, opciones: p.opciones })),
  };
}

function sortear_(lista, cantidad) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temporal = copia[i]; copia[i] = copia[j]; copia[j] = temporal;
  }
  return copia.slice(0, cantidad);
}

/**
 * ¿Es válido el código de este stand? Primero mira el que se generó hace poco (la caché lo guarda al crearlo);
 * solo lee la hoja Codigos si no lo encuentra o si no coincide.
 */
function codigoValido_(standId, codigo, ahoraMs) {
  const ingresado = texto_(codigo).toUpperCase();
  if (!ingresado) return false;
  const vigente = cacheLeer_('codigo:' + standId);
  if (vigente && vigente.codigo === ingresado && vigente.expiraEn > ahoraMs) return true;
  return leerHoja_(HOJA.CODIGOS).some(c =>
    texto_(c.codigo).toUpperCase() === ingresado && id_(c.stand_id) === standId &&
    texto_(c.estado).toUpperCase() === 'ACTIVO' && ms_(c.expira_en) > ahoraMs);
}

/** Fila de un intento en la hoja, buscada por su identificador sin descargar la hoja. 0 si no está. */
function filaDeIntento_(intentoId) {
  const hoja = hoja_(HOJA.INTENTOS);
  const columna = encabezados_(HOJA.INTENTOS).indexOf('intento_id') + 1;
  const filas = Math.max(1, hoja.getLastRow() - 1);
  const celda = hoja.getRange(2, columna, filas, 1).createTextFinder(intentoId).matchEntireCell(true).findNext();
  return celda ? celda.getRow() : 0;
}

/**
 * Deja el resultado en la fila del intento y lo confirma antes de volver: quien llama marca el índice (s = 1)
 * solo después, así nunca da por guardado algo que no llegó a la hoja. Escribe siempre lo mismo, así que
 * repetirla no duplica nada.
 */
function registrarResultado_(sesion, standId, intento) {
  const detalle = intento.q.map((pregunta, k) => ({ p: pregunta, r: intento.r[k], ok: intento.a[k] }));
  const cambios = {
    estado: 'COMPLETADO', respuestas_json: JSON.stringify(detalle),
    correctas: intento.c, puntaje: intento.p, completado_en: new Date(intento.t),
  };
  const hoja = hoja_(HOJA.INTENTOS);
  const encabezados = encabezados_(HOJA.INTENTOS);
  const columnaId = encabezados.indexOf('intento_id');
  const leer = fila => hoja.getRange(fila, 1, 1, encabezados.length).getValues()[0];

  let fila = intento.f || 0;
  let valores = fila ? leer(fila) : null;
  let vacia = false;
  if (!valores || id_(valores[columnaId]) !== intento.id) {
    // En su fila no está el intento: o la fila de inicio nunca llegó a la hoja, o alguien movió filas a mano.
    // Antes de escribir se busca por su identificador, para no dejar el mismo intento en dos filas.
    const encontrada = filaDeIntento_(intento.id);
    if (encontrada) {
      fila = encontrada;
      valores = leer(fila);
      intento.f = fila;
    } else if (valores && valores[columnaId] === '') {
      vacia = true;
    } else {
      throw new Error('No encontramos la fila del intento ' + intento.id + ' en la hoja Intentos.');
    }
  }
  // Fila vacía: la de inicio no llegó a la hoja. Es de su bloque y la tiene reservada, así que se escribe completa ahora.
  const stand = vacia ? (catalogo_().stands.find(s => s.id === standId) || {}) : null;
  const datos = Object.assign(vacia ? filaDeInicio_(sesion.email, standId, stand.pabellonId || '', intento) : {}, cambios);
  encabezados.forEach((e, c) => { if (e in datos) valores[c] = datos[e]; });
  hoja.getRange(fila, 1, 1, encabezados.length).setValues([valores]);
  SpreadsheetApp.flush();
}

/**
 * Los resultados corregidos que todavía no llegaron a la hoja (s = 0) se escriben al volver a la app.
 * Un fallo aquí no debe romper el mapa: se intenta otra vez en la siguiente visita.
 */
function sincronizarPendientes_(sesion, indice) {
  Object.keys(indice).forEach(standId => {
    if (indice[standId].e !== 'COMPLETADO' || indice[standId].s) return;
    try {
      conBloqueoPropio_(() => {
        // Con el bloqueo se mira de nuevo: otra petición de la misma persona pudo escribirlo mientras tanto.
        const intento = miIndice_(sesion)[standId];
        if (!intento || intento.e !== 'COMPLETADO' || intento.s) return;
        registrarResultado_(sesion, standId, intento);
        intento.s = 1;
        guardarEnIndice_(standId, intento);
        indice[standId] = intento;
      });
    } catch (error) {
      console.warn('No se pudo sincronizar el resultado de ' + standId + ': ' + error.message);
    }
  });
}

function resultadoDe_(intento) {
  return { ok: true, correctas: intento.c, total: intento.q.length, puntaje: intento.p, aciertos: intento.a };
}

/**
 * Corrige y guarda. "respuestas" es un objeto pregunta_id -> letra elegida.
 * Si el intento ya estaba corregido (reintento por mala señal), devuelve el mismo resultado sin volver a guardar.
 */
function enviarQuiz(intentoId, respuestas) {
  const sesion = exigirVista_('QUIZ');
  const elegidas = respuestas || {};
  const llegada = primeraLlegada_(intentoId);
  const buscado = id_(intentoId);

  return conBloqueoPropio_(() => {
    const indice = miIndice_(sesion);
    const standId = Object.keys(indice).find(s => indice[s].id === buscado);
    if (!standId) return falla_('NO_EXISTE', 'No encontramos tu intento. Vuelve al mapa e inténtalo otra vez.');
    const intento = indice[standId];

    if (intento.e === 'COMPLETADO') {
      // Reintento: si la hoja todavía no tiene el resultado, se escribe ahora.
      if (!intento.s) {
        registrarResultado_(sesion, standId, intento);
        intento.s = 1;
        guardarEnIndice_(standId, intento);
      }
      return resultadoDe_(intento);
    }
    if (intento.e !== 'EN_CURSO' || llegada > intento.v + GRACIA_DE_ENVIO_MS) {
      // La hoja queda como está: el mapa calcula el vencimiento a partir de la hora de vencimiento.
      intento.e = 'VENCIDO';
      guardarEnIndice_(standId, intento);
      return falla_('VENCIDO', 'Se acabó el tiempo.');
    }

    const banco = preguntasDeStand_(standId);
    let correctas = 0, puntaje = 0;
    intento.r = [];
    intento.a = [];
    intento.q.forEach(id => {
      const pregunta = banco.find(p => p.id === id);
      const elegida = texto_(elegidas[id]).toUpperCase();
      const acierto = !!pregunta && elegida !== '' && elegida === pregunta.correcta;
      if (acierto) { correctas++; puntaje += pregunta.puntos; }
      intento.r.push(elegida);
      intento.a.push(acierto);
    });
    Object.assign(intento, { e: 'COMPLETADO', c: correctas, p: puntaje, t: Date.now(), s: 0 });
    // Primero el índice: la corrección no se pierde si la hoja falla; el celular reintenta.
    guardarEnIndice_(standId, intento);
    registrarResultado_(sesion, standId, intento);
    intento.s = 1;
    guardarEnIndice_(standId, intento);
    return resultadoDe_(intento);
  });
}
