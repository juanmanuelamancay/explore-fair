/**
 * Vista MAPA: puntaje del usuario, y los pabellones con su estado para esa persona.
 * El quiz es por pabellón: cada pabellón tiene un solo estado, no uno por stand. Los stands se muestran como información.
 * Lee sus intentos del índice (indice.gs), no de la hoja Intentos.
 */

/** Estado de una unidad para una persona, con lo que el navegador necesita para mostrarla. */
function estadoDeUnidad_(unidad, intento, ahora, puntosPorPregunta) {
  const vista = {
    id: unidad.id, nombre: unidad.nombre, requiereCodigo: unidad.requiereCodigo,
    numPreguntas: unidad.porQuiz, puntosMax: unidad.porQuiz * puntosPorPregunta,
    estado: 'PENDIENTE', correctas: 0, total: unidad.porQuiz, puntaje: 0,
  };
  if (!intento) return vista;
  if (intento.e === 'COMPLETADO') {
    vista.estado = 'COMPLETADO';
    vista.correctas = intento.c;
    vista.puntaje = intento.p;
    vista.total = intento.q.length;
  } else {
    // Un intento EN_CURSO cuyo tiempo ya pasó cuenta como vencido aunque nadie lo haya enviado.
    vista.estado = intento.e === 'EN_CURSO' && intento.v > ahora ? 'EN_CURSO' : 'VENCIDO';
  }
  return vista;
}

/** Puntos de todo lo completado: pabellones y charlas suman al mismo total. */
function puntosDe_(indice) {
  return Object.keys(indice).reduce((suma, id) => suma + (indice[id].e === 'COMPLETADO' ? Number(indice[id].p) || 0 : 0), 0);
}

function obtenerMapa() {
  const sesion = exigirVista_('MAPA');
  const catalogo = catalogo_();
  const ahora = Date.now();
  const puntosPorPregunta = catalogo.config.puntos_por_defecto;

  // El validador no responde: no tiene intentos, así que no lee ni escribe su índice ni la hoja Intentos.
  const soloLectura = sesion.rol === 'VALIDADOR';
  const mios = soloLectura ? {} : miIndice_(sesion);
  if (!soloLectura) sincronizarPendientes_(sesion, mios);

  const entrada = unidadDeEntrada_(catalogo);
  const pabellones = pabellonesDelMapa_(catalogo).map(p => Object.assign(
    estadoDeUnidad_(unidadPorId_(catalogo, p.id), mios[p.id], ahora, puntosPorPregunta),
    { nombreCorto: p.nombreCorto, indice: p.indice, stands: p.stands }));

  return {
    puntos: puntosDe_(mios),
    entrada: entrada ? estadoDeUnidad_(entrada, mios[entrada.id], ahora, puntosPorPregunta) : null,
    pabellones: pabellones,
    soloLectura: soloLectura,
  };
}
