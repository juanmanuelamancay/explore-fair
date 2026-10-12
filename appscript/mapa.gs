/**
 * Vista MAPA: puntaje del usuario, y los pabellones con el estado de cada stand para esa persona.
 * Lee sus intentos del índice (indice.gs), no de la hoja Intentos.
 */

function obtenerMapa() {
  const sesion = exigirVista_('MAPA');
  const catalogo = catalogo_();
  const ahora = Date.now();

  // El validador no responde: no tiene intentos, así que no lee ni escribe su índice ni la hoja Intentos.
  const soloLectura = sesion.rol === 'VALIDADOR';
  const mios = soloLectura ? {} : miIndice_(sesion);
  if (!soloLectura) sincronizarPendientes_(sesion, mios);

  let puntos = 0;
  const paraElMapa = stand => {
    const intento = mios[stand.id];
    const vista = {
      id: stand.id, nombre: stand.nombre, requiereCodigo: stand.requiereCodigo,
      numPreguntas: stand.numPreguntas, puntosMax: stand.numPreguntas * catalogo.config.puntos_por_defecto,
      estado: 'PENDIENTE', correctas: 0, total: stand.numPreguntas, puntaje: 0,
    };
    if (!intento) return vista;

    if (intento.e === 'COMPLETADO') {
      vista.estado = 'COMPLETADO';
      vista.correctas = intento.c;
      vista.puntaje = intento.p;
      vista.total = intento.q.length;
      puntos += vista.puntaje;
    } else {
      // Un intento EN_CURSO cuyo tiempo ya pasó cuenta como vencido aunque nadie lo haya enviado.
      vista.estado = intento.e === 'EN_CURSO' && intento.v > ahora ? 'EN_CURSO' : 'VENCIDO';
    }
    return vista;
  };

  // paraElMapa va sumando "puntos": hay que recorrer todos los stands antes de armar la respuesta.
  const entrada = catalogo.stands.find(s => !s.requiereCodigo);
  const entradaParaElMapa = entrada ? paraElMapa(entrada) : null;
  const pabellones = pabellonesDelMapa_(catalogo).map(p => ({
    id: p.id, nombre: p.nombre, nombreCorto: p.nombreCorto, indice: p.indice, stands: p.stands.map(paraElMapa),
  }));

  return { puntos: puntos, entrada: entradaParaElMapa, pabellones: pabellones, soloLectura: soloLectura };
}
