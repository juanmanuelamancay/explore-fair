/**
 * Vista QUIZ: validar el código, entregar las preguntas sin la respuesta correcta y corregir en el servidor.
 * Se responde una unidad: un pabellón (cada uno de sus stands aporta unas pocas preguntas de su banco) o una charla
 * (un solo banco). El intento, el código, el índice y el puntaje van por unidad (ver catalogo_().unidades en datos.gs).
 * Los intentos de cada persona se leen y escriben en su índice (indice.gs); la hoja Intentos se escribe
 * dos veces por intento: al empezar y al enviar. Las dos veces en la misma fila, que es del bloque de la
 * persona: no se agrega nada al final de la hoja, así que no hace falta el turno global.
 */

const GRACIA_DE_ENVIO_MS = 10000;   // tolerancia de red al enviar justo al límite

function falla_(motivo, mensaje) { return { ok: false, motivo: motivo, mensaje: mensaje }; }

/**
 * ¿La charla ya cerró? Es la hora de la columna "cierre" de Charlas: desde ahí nadie empieza su quiz, aunque tenga un
 * código válido, y el ponente ya no genera códigos. Sin "cierre" escrito, la charla no se cierra nunca. Los pabellones no cierran.
 */
function charlaCerrada_(unidad, ahoraMs) {
  return unidad.tipo === 'CHARLA' && !!unidad.cierre && ahoraMs > unidad.cierre;
}

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

/** Vista que da acceso a cada tipo de unidad: los pabellones se abren desde el mapa y las charlas, desde su ruta. */
const VISTA_DE_UNIDAD = { PABELLON: 'MAPA', CHARLA: 'CHARLAS' };

function exigirAccesoAUnidad_(sesion, unidad) {
  if (sesion.vistas.indexOf(VISTA_DE_UNIDAD[unidad.tipo]) < 0) throw new Error('No tienes permiso para esta acción.');
}

/** Las preguntas activas de cada banco de la unidad (un stand por banco en un pabellón; la charla tiene uno solo). */
function bancosDeUnidad_(unidad, sinCache) {
  return unidad.bancos.map(b => ({ banco: b, preguntas: preguntasDeStand_(b.id, sinCache) }));
}

/** Todas las preguntas activas de la unidad en una lista, cada una con el ID de su banco. */
function preguntasDeUnidad_(unidad, bancos) {
  const todas = [];
  (bancos || bancosDeUnidad_(unidad)).forEach(b => b.preguntas.forEach(p => todas.push(Object.assign({ bancoId: b.banco.id }, p))));
  return todas;
}

/** Primer banco al que le faltan preguntas activas, o null si todos están completos. Una unidad sin bancos tampoco está lista. */
function bancoIncompleto_(bancos) {
  if (!bancos.length) return { sinBancos: true };
  const falta = bancos.find(b => b.preguntas.length < Math.max(b.banco.minimo, b.banco.cuantas));
  return falta ? { banco: falta.banco, tiene: falta.preguntas.length } : null;
}

function mensajeBancoIncompleto_(unidad, falta) {
  if (falta.sinBancos) return unidad.tipo === 'CHARLA' ? 'Esta charla todavía no tiene su banco de preguntas.' : 'Este pabellón todavía no tiene stands activos.';
  const necesita = Math.max(falta.banco.minimo, falta.banco.cuantas);
  return 'Este quiz todavía no tiene sus preguntas listas: "' + falta.banco.nombre + '" tiene ' + falta.tiene + ' activas y necesita ' + necesita + '.';
}

/**
 * Crea el intento y devuelve las preguntas sorteadas: cuantas preguntas de cada banco de la unidad. Si la persona ya tiene
 * un intento en curso para esa unidad (cerró la app y volvió), devuelve las mismas preguntas sin pedir código.
 *
 * Solo el usuario (quien no está en Staff) tiene número de orden y bloque en Intentos. Admin, líder, expositor y ponente no
 * responden quizzes: no reciben número ni fila en Usuarios, y sin número no hay dónde escribir el intento.
 */
function iniciarQuiz(unidadId, codigo) {
  const sesion = exigirVista_('QUIZ');
  if (sesion.rol !== 'USUARIO') return falla_('STAFF', 'Tu rol no responde quizzes.');
  const catalogo = catalogo_();
  const unidad = unidadPorId_(catalogo, unidadId);
  if (!unidad) return falla_('STAND', 'Este quiz no está disponible.');
  exigirAccesoAUnidad_(sesion, unidad);
  const ahora = new Date();
  if (unidad.tipo === 'PABELLON' && !catalogo.config.feria_abierta) return falla_('CERRADA', 'La feria todavía no está abierta.');
  if (unidad.tipo === 'CHARLA' && unidad.inicio && ahora.getTime() < unidad.inicio) {
    const respuesta = falla_('AUN_NO', 'Esta charla todavía no empieza.');
    respuesta.empiezaEn = unidad.inicio;
    return respuesta;
  }

  let bancos = bancosDeUnidad_(unidad);

  const mios = miIndice_(sesion);
  if (mios[unidad.id]) return retomarIndice_(mios[unidad.id], unidad, bancos, ahora);

  // Con el quiz ya en curso (arriba) se puede terminar aunque pase el cierre; empezar uno nuevo, no. Va antes del código
  // para que un intento tardío no cuente como código fallado.
  if (charlaCerrada_(unidad, ahora.getTime())) {
    const cerrada = falla_('CIERRE', 'La hora para responder esta charla se venció.');
    cerrada.cerroEn = unidad.cierre;
    return cerrada;
  }

  // El quiz de entrada va primero: ningún pabellón con código se abre hasta haberlo terminado (respondido o vencido).
  // Las charlas son aparte: no lo piden.
  const entrada = unidadDeEntrada_(catalogo);
  if (unidad.tipo === 'PABELLON' && unidad.requiereCodigo && entrada) {
    const deEntrada = mios[entrada.id];
    const enCurso = deEntrada && deEntrada.e === 'EN_CURSO' && deEntrada.v > ahora.getTime();
    if (!deEntrada || enCurso) return falla_('ENTRADA', 'Primero responde el quiz de entrada.');
  }

  if (unidad.requiereCodigo) {
    const rechazo = revisarCodigo_(unidad.id, codigo);
    if (rechazo) return rechazo;
  }

  // Puede ser la caché de antes de cargar las preguntas en el Sheet: se relee una vez antes de fallar.
  let falta = bancoIncompleto_(bancos);
  if (falta && !falta.sinBancos) { bancos = bancosDeUnidad_(unidad, true); falta = bancoIncompleto_(bancos); }
  if (falta) return falla_('SIN_PREGUNTAS', mensajeBancoIncompleto_(unidad, falta));

  const sorteadas = [];
  bancos.forEach(b => sortear_(b.preguntas, b.banco.cuantas).forEach(pregunta => sorteadas.push(pregunta)));
  const venceEn = new Date(ahora.getTime() + catalogo.config.minutos_para_responder * 60000);
  const intento = {
    id: nuevoIntentoId_(), e: 'EN_CURSO', i: ahora.getTime(), v: venceEn.getTime(),
    q: sorteadas.map(p => p.id), r: [], a: [], c: 0, p: 0, t: 0, s: 0,
    f: 0, k: unidad.requiereCodigo ? texto_(codigo).toUpperCase() : '',
  };

  const creado = conBloqueoPropio_(() => {
    // Con el bloqueo el índice se lee de nuevo: dos toques seguidos no deben crear dos intentos.
    const indice = miIndice_(sesion);
    if (indice[unidad.id]) return { repetido: indice[unidad.id] };
    const encabezados = encabezados_(HOJA.INTENTOS);
    if (encabezados.indexOf('unidad_id') < 0) throw new Error('Falta la columna "unidad_id" en la hoja Intentos. Avisa a un administrador.');
    const reservadas = Object.keys(indice).map(s => indice[s].f).filter(Boolean);
    intento.f = filaLibreDe_(miOrden_(sesion), sesion.email, encabezados, reservadas);
    // Primero el índice: si la hoja falla después, el reintento encuentra este mismo intento con su fila ya reservada.
    guardarEnIndice_(unidad.id, intento);
    escribirInicio_(sesion.email, unidad, intento, encabezados);
    intento.s = 1;
    guardarEnIndice_(unidad.id, intento);
    return { nuevo: intento };
  });
  if (creado.repetido) return retomarIndice_(creado.repetido, unidad, bancos, ahora);
  return inicioDeQuiz_(intento.id, sorteadas, venceEn.getTime());
}

/** Lo que lleva la fila de un intento al empezar. pabellon_id es una copia: solo los pabellones la llevan. */
function filaDeInicio_(email, unidad, intento) {
  return {
    intento_id: intento.id, email: email, unidad_id: unidad.id, pabellon_id: unidad.tipo === 'PABELLON' ? unidad.id : '', codigo: intento.k || '',
    preguntas_json: JSON.stringify(intento.q),
    iniciado_en: new Date(intento.i), vence_en: new Date(intento.v), estado: 'EN_CURSO',
  };
}

/** Escribe la fila de inicio en la fila reservada del intento y la confirma. Esa fila es del bloque de la persona: nadie más escribe ahí. */
function escribirInicio_(email, unidad, intento, encabezados) {
  escribirFila_(HOJA.INTENTOS, intento.f, filaDeInicio_(email, unidad, intento), encabezados);
  SpreadsheetApp.flush();
}

/** Intento que ya existe en el índice: no crea nada, solo vuelve a mostrar sus preguntas o dice por qué no se puede. */
function retomarIndice_(intento, unidad, bancos, ahora) {
  if (intento.e === 'COMPLETADO') return falla_('YA_RESPONDIDO', 'Ya respondiste este quiz.');
  if (intento.e !== 'EN_CURSO' || intento.v <= ahora.getTime()) {
    return falla_('VENCIDO', 'Se te venció el tiempo en este quiz. No se puede repetir.');
  }
  const todas = preguntasDeUnidad_(unidad, bancos);
  const preguntas = intento.q.map(id => todas.find(p => p.id === id)).filter(Boolean);
  return inicioDeQuiz_(intento.id, preguntas, intento.v);
}

/** Lo que viaja al celular: enunciado y opciones. La respuesta correcta se queda en el servidor. */
function inicioDeQuiz_(intentoId, preguntas, venceEnMs) {
  return {
    ok: true, intentoId: intentoId, venceEn: venceEnMs, ahora: Date.now(),
    preguntas: preguntas.map(p => ({ id: p.id, texto: p.texto, opciones: p.opciones })),
  };
}

/**
 * Vista QUIZ del VALIDADOR: recorre las preguntas de una unidad sin responderlas. No pide código, no crea intento
 * ni reloj y no escribe en Intentos, Usuarios ni en su índice. Recibe todas las preguntas activas de la unidad
 * (en el evento cada usuario recibe solo "porQuiz" de ellas, al azar), sin la respuesta correcta.
 */
function verQuiz(unidadId) {
  const sesion = exigirVista_('QUIZ');
  if (sesion.rol !== 'VALIDADOR') return falla_('NO_VALIDADOR', 'Esta pantalla es solo para el validador.');
  const unidad = unidadPorId_(catalogo_(), unidadId);
  if (!unidad) return falla_('STAND', 'Este quiz no está disponible.');
  exigirAccesoAUnidad_(sesion, unidad);
  let bancos = bancosDeUnidad_(unidad);
  // Puede ser la caché de antes de cargar las preguntas en el Sheet: se relee una vez antes de fallar.
  if (!bancos.some(b => b.preguntas.length)) bancos = bancosDeUnidad_(unidad, true);
  const preguntas = preguntasDeUnidad_(unidad, bancos);
  if (!preguntas.length) return falla_('SIN_PREGUNTAS', 'Este quiz todavía no tiene preguntas activas.');
  const nombreDeBanco = {};
  unidad.bancos.forEach(b => { nombreDeBanco[b.id] = b.nombre; });
  return {
    ok: true, porQuiz: unidad.porQuiz,
    preguntas: preguntas.map(p => ({ id: p.id, texto: p.texto, opciones: p.opciones, origen: unidad.bancos.length > 1 ? nombreDeBanco[p.bancoId] : '' })),
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

const FALLOS_DE_CODIGO_MAX = 3;
const SEGUNDOS_BLOQUEO_CODIGO = 120;
const CLAVE_FALLOS_CODIGO = 'fallos-codigo';

/**
 * Valida el código con un límite por persona: 3 fallos bloquean a esa persona 120 segundos, para que nadie pruebe
 * códigos en bucle. Los fallos se cuentan en su caché propia y se olvidan al acertar o 120 segundos después del último.
 * Todo va dentro del bloqueo de la persona: sin él, varias llamadas en paralelo leerían "0 fallos" a la vez y ninguna
 * quedaría contada. Mientras dura el bloqueo no se mira el código ni se alarga la espera.
 * Devuelve null si el código vale, o la respuesta de rechazo.
 */
function revisarCodigo_(unidadId, codigo) {
  // Un campo vacío no es un intento: no se cuenta.
  if (!texto_(codigo)) return falla_('CODIGO', 'Ingresa el código que te dio el líder.');
  const bloqueo = LockService.getUserLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const cacheMia = CacheService.getUserCache();
    const ahora = Date.now();
    let estado = { n: 0, hasta: 0 };
    try {
      const guardado = JSON.parse(cacheMia.get(CLAVE_FALLOS_CODIGO) || 'null');
      if (guardado) estado = { n: Number(guardado.n) || 0, hasta: Number(guardado.hasta) || 0 };
    } catch (error) { /* valor ilegible: se empieza de cero */ }
    if (estado.hasta && estado.hasta <= ahora) estado = { n: 0, hasta: 0 };   // el bloqueo ya terminó
    if (estado.hasta > ahora) return bloqueadoPorCodigo_(estado.hasta - ahora);

    if (codigoValido_(unidadId, codigo, ahora)) {
      cacheMia.remove(CLAVE_FALLOS_CODIGO);
      return null;
    }
    estado.n += 1;
    if (estado.n >= FALLOS_DE_CODIGO_MAX) estado.hasta = ahora + SEGUNDOS_BLOQUEO_CODIGO * 1000;
    cacheMia.put(CLAVE_FALLOS_CODIGO, JSON.stringify(estado), SEGUNDOS_BLOQUEO_CODIGO);
    if (estado.hasta) return bloqueadoPorCodigo_(SEGUNDOS_BLOQUEO_CODIGO * 1000);
    return falla_('CODIGO', 'Código inválido o vencido. Pídele uno nuevo al líder.');
  } finally {
    bloqueo.releaseLock();
  }
}

function bloqueadoPorCodigo_(milisegundos) {
  const segundos = Math.max(1, Math.ceil(milisegundos / 1000));
  const respuesta = falla_('BLOQUEADO', 'Fallaste el código ' + FALLOS_DE_CODIGO_MAX + ' veces. Espera ' + segundos + (segundos === 1 ? ' segundo' : ' segundos') + ' para volver a intentarlo.');
  respuesta.esperaSegundos = segundos;
  return respuesta;
}

/**
 * ¿Es válido el código de esta unidad? Primero mira el que se generó hace poco (la caché lo guarda al crearlo);
 * solo lee la hoja Codigos si no lo encuentra o si no coincide.
 */
function codigoValido_(unidadId, codigo, ahoraMs) {
  const ingresado = texto_(codigo).toUpperCase();
  if (!ingresado) return false;
  const vigente = cacheLeer_('codigo:' + unidadId);
  if (vigente && vigente.codigo === ingresado && vigente.expiraEn > ahoraMs) return true;
  return leerHoja_(HOJA.CODIGOS).some(c =>
    texto_(c.codigo).toUpperCase() === ingresado && id_(c.unidad_id) === unidadId &&
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
function registrarResultado_(sesion, unidadId, intento) {
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
  const unidad = vacia ? (unidadPorId_(catalogo_(), unidadId) || { id: unidadId, tipo: '' }) : null;
  const datos = Object.assign(vacia ? filaDeInicio_(sesion.email, unidad, intento) : {}, cambios);
  encabezados.forEach((e, c) => { if (e in datos) valores[c] = datos[e]; });
  hoja.getRange(fila, 1, 1, encabezados.length).setValues([valores]);
  SpreadsheetApp.flush();
}

/**
 * Los resultados corregidos que todavía no llegaron a la hoja (s = 0) se escriben al volver a la app.
 * Un fallo aquí no debe romper el mapa: se intenta otra vez en la siguiente visita.
 */
function sincronizarPendientes_(sesion, indice) {
  Object.keys(indice).forEach(unidadId => {
    if (indice[unidadId].e !== 'COMPLETADO' || indice[unidadId].s) return;
    try {
      conBloqueoPropio_(() => {
        // Con el bloqueo se mira de nuevo: otra petición de la misma persona pudo escribirlo mientras tanto.
        const intento = miIndice_(sesion)[unidadId];
        if (!intento || intento.e !== 'COMPLETADO' || intento.s) return;
        registrarResultado_(sesion, unidadId, intento);
        intento.s = 1;
        guardarEnIndice_(unidadId, intento);
        indice[unidadId] = intento;
      });
    } catch (error) {
      console.warn('No se pudo sincronizar el resultado de ' + unidadId + ': ' + error.message);
    }
  });
}

/** Solo el total: qué preguntas acertó (intento.a) se queda en el servidor, para que no se pase de una persona a otra. */
function resultadoDe_(intento) {
  return { ok: true, correctas: intento.c, total: intento.q.length, puntaje: intento.p };
}

/**
 * Corrige y guarda. "respuestas" es un objeto pregunta_id -> letra elegida.
 * Si el intento ya estaba corregido (reintento por mala señal), devuelve el mismo resultado sin volver a guardar.
 */
function enviarQuiz(intentoId, respuestas) {
  const sesion = exigirVista_('QUIZ');
  if (sesion.rol !== 'USUARIO') return falla_('STAFF', 'Tu rol no responde quizzes.');
  const elegidas = respuestas || {};
  const llegada = primeraLlegada_(intentoId);
  const buscado = id_(intentoId);

  return conBloqueoPropio_(() => {
    const indice = miIndice_(sesion);
    const unidadId = Object.keys(indice).find(s => indice[s].id === buscado);
    if (!unidadId) return falla_('NO_EXISTE', 'No encontramos tu intento. Vuelve al inicio e inténtalo otra vez.');
    const intento = indice[unidadId];

    if (intento.e === 'COMPLETADO') {
      // Reintento: si la hoja todavía no tiene el resultado, se escribe ahora.
      if (!intento.s) {
        registrarResultado_(sesion, unidadId, intento);
        intento.s = 1;
        guardarEnIndice_(unidadId, intento);
      }
      return resultadoDe_(intento);
    }
    if (intento.e !== 'EN_CURSO' || llegada > intento.v + GRACIA_DE_ENVIO_MS) {
      // La hoja queda como está: el mapa calcula el vencimiento a partir de la hora de vencimiento.
      intento.e = 'VENCIDO';
      guardarEnIndice_(unidadId, intento);
      return falla_('VENCIDO', 'Se acabó el tiempo.');
    }

    const unidad = unidadPorId_(catalogo_(), unidadId);
    if (!unidad) return falla_('NO_EXISTE', 'Este quiz ya no está disponible.');
    const banco = preguntasDeUnidad_(unidad);
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
    guardarEnIndice_(unidadId, intento);
    registrarResultado_(sesion, unidadId, intento);
    intento.s = 1;
    guardarEnIndice_(unidadId, intento);
    return resultadoDe_(intento);
  });
}
