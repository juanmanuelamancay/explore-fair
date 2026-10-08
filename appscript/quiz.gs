/**
 * Vista QUIZ: validar el código, entregar las preguntas sin la respuesta correcta y corregir en el servidor.
 */

const GRACIA_DE_ENVIO_MS = 10000;   // tolerancia de red al enviar justo al límite

function falla_(motivo, mensaje) { return { ok: false, motivo: motivo, mensaje: mensaje }; }

/**
 * Crea el intento y devuelve las preguntas sorteadas. Si la persona ya tiene un intento
 * en curso para ese stand (cerró la app y volvió), devuelve las mismas preguntas sin pedir código.
 */
function iniciarQuiz(standId, codigo) {
  const resultado = iniciarQuiz_(standId, codigo);
  // Con la feria cerrada solo un admin llega a empezar: se le avisa para que no crea que el cierre falló.
  if (resultado.ok && !catalogo_().config.feria_abierta) {
    resultado.aviso = 'La feria está cerrada: entras porque eres admin. Los demás no pueden empezar quizzes.';
  }
  return resultado;
}

function iniciarQuiz_(standId, codigo) {
  const sesion = exigirVista_('QUIZ');
  const catalogo = catalogo_();
  const stand = catalogo.stands.find(s => s.id === id_(standId));
  if (!stand) return falla_('STAND', 'Este stand no está disponible.');
  if (!catalogo.config.feria_abierta && sesion.rol !== 'ADMIN') return falla_('CERRADA', 'La feria todavía no está abierta.');

  let banco = preguntasDeStand_(stand.id);
  const ahora = new Date();
  const esMio = i => texto_(i.email).toLowerCase() === sesion.email && id_(i.stand_id) === stand.id;

  const intentos = leerHoja_(HOJA.INTENTOS);
  const previo = intentos.find(esMio);
  if (previo) return retomar_(previo, banco, ahora);

  // El quiz de entrada va primero: ningún stand se abre hasta haberlo terminado (respondido o vencido).
  const entrada = catalogo.stands.find(s => !s.requiereCodigo);
  if (stand.requiereCodigo && entrada) {
    const deEntrada = intentos.find(i => texto_(i.email).toLowerCase() === sesion.email && id_(i.stand_id) === entrada.id);
    const enCurso = deEntrada && texto_(deEntrada.estado).toUpperCase() === 'EN_CURSO' && ms_(deEntrada.vence_en) > ahora.getTime();
    if (!deEntrada || enCurso) return falla_('ENTRADA', 'Primero responde el quiz de entrada.');
  }

  if (stand.requiereCodigo) {
    const ingresado = texto_(codigo).toUpperCase();
    const valido = leerHoja_(HOJA.CODIGOS).some(c =>
      texto_(c.codigo).toUpperCase() === ingresado && id_(c.stand_id) === stand.id &&
      texto_(c.estado).toUpperCase() === 'ACTIVO' && ms_(c.expira_en) > ahora.getTime());
    if (!ingresado || !valido) return falla_('CODIGO', 'Código inválido o vencido. Pídele uno nuevo al líder.');
  }

  // Puede ser la caché de antes de cargar las preguntas en el Sheet: se relee una vez antes de fallar.
  if (banco.length < stand.numPreguntas) banco = preguntasDeStand_(stand.id, true);
  if (banco.length < PREGUNTAS_POR_BANCO) {
    return falla_('SIN_PREGUNTAS', 'Este stand todavía no tiene sus preguntas listas: tiene ' + banco.length + ' activas y necesita ' + PREGUNTAS_POR_BANCO + '.');
  }
  const sorteadas = sortear_(banco, stand.numPreguntas);
  const venceEn = new Date(ahora.getTime() + catalogo.config.minutos_para_responder * 60000);
  asegurarUsuario_(sesion);

  let intentoId;
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    // Se vuelve a comprobar dentro del bloqueo: dos toques seguidos no deben crear dos intentos.
    const repetido = leerHoja_(HOJA.INTENTOS).find(esMio);
    if (repetido) return retomar_(repetido, banco, ahora);

    intentoId = 'INT-' + String(hoja_(HOJA.INTENTOS).getLastRow()).padStart(4, '0');
    agregarFila_(HOJA.INTENTOS, {
      intento_id: intentoId, email: sesion.email, stand_id: stand.id, pabellon_id: stand.pabellonId,
      codigo: stand.requiereCodigo ? texto_(codigo).toUpperCase() : '',
      preguntas_json: JSON.stringify(sorteadas.map(p => p.id)),
      iniciado_en: ahora, vence_en: venceEn, estado: 'EN_CURSO',
    });
  } finally {
    bloqueo.releaseLock();
  }
  return inicioDeQuiz_(intentoId, sorteadas, venceEn.getTime());
}

function retomar_(intento, banco, ahora) {
  const estado = texto_(intento.estado).toUpperCase();
  if (estado === 'COMPLETADO') return falla_('YA_RESPONDIDO', 'Ya respondiste este stand.');
  if (estado !== 'EN_CURSO' || ms_(intento.vence_en) <= ahora.getTime()) {
    return falla_('VENCIDO', 'Se te venció el tiempo en este stand. No se puede repetir.');
  }
  const ids = JSON.parse(intento.preguntas_json);
  const preguntas = ids.map(id => banco.find(p => p.id === id)).filter(Boolean);
  return inicioDeQuiz_(id_(intento.intento_id), preguntas, ms_(intento.vence_en));
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
 * Corrige y guarda. "respuestas" es un objeto pregunta_id -> letra elegida.
 * Si el intento ya estaba corregido (reintento por mala señal), devuelve el mismo resultado sin volver a guardar.
 */
function enviarQuiz(intentoId, respuestas) {
  const sesion = exigirVista_('QUIZ');
  const elegidas = respuestas || {};
  let resultado;

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const intento = leerHoja_(HOJA.INTENTOS).find(i =>
      id_(i.intento_id) === id_(intentoId) && texto_(i.email).toLowerCase() === sesion.email);
    if (!intento) return falla_('NO_EXISTE', 'No encontramos tu intento. Vuelve al mapa e inténtalo otra vez.');

    const estado = texto_(intento.estado).toUpperCase();
    if (estado === 'COMPLETADO') {
      const guardadas = JSON.parse(intento.respuestas_json || '[]');
      resultado = {
        ok: true, correctas: Number(intento.correctas) || 0, total: guardadas.length,
        puntaje: Number(intento.puntaje) || 0, aciertos: guardadas.map(r => !!r.ok),
      };
    } else if (estado !== 'EN_CURSO' || Date.now() > ms_(intento.vence_en) + GRACIA_DE_ENVIO_MS) {
      if (estado === 'EN_CURSO') actualizarFila_(HOJA.INTENTOS, intento._fila, { estado: 'VENCIDO', correctas: 0, puntaje: 0 });
      return falla_('VENCIDO', 'Se acabó el tiempo.');
    } else {
      const banco = preguntasDeStand_(id_(intento.stand_id));
      let correctas = 0, puntaje = 0;
      const detalle = JSON.parse(intento.preguntas_json).map(id => {
        const pregunta = banco.find(p => p.id === id);
        const elegida = texto_(elegidas[id]).toUpperCase();
        const acierto = !!pregunta && elegida !== '' && elegida === pregunta.correcta;
        if (acierto) { correctas++; puntaje += pregunta.puntos; }
        return { p: id, r: elegida, ok: acierto };
      });
      actualizarFila_(HOJA.INTENTOS, intento._fila, {
        estado: 'COMPLETADO', respuestas_json: JSON.stringify(detalle),
        correctas: correctas, puntaje: puntaje, completado_en: new Date(),
      });
      cacheQuitar_('ranking');
      resultado = { ok: true, correctas: correctas, total: detalle.length, puntaje: puntaje, aciertos: detalle.map(d => d.ok) };
    }
  } finally {
    bloqueo.releaseLock();
  }

  resultado.puesto = puestoDe_(sesion.email);
  return resultado;
}
