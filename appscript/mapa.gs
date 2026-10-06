/**
 * Vista MAPA: puntaje y puesto del usuario, y los pabellones con el estado de cada stand para esa persona.
 */

function obtenerMapa() {
  const sesion = exigirVista_('MAPA');
  const catalogo = catalogo_();
  const ahora = Date.now();

  const mios = {};
  leerHoja_(HOJA.INTENTOS).forEach(i => {
    if (texto_(i.email).toLowerCase() === sesion.email) mios[id_(i.stand_id)] = i;
  });

  let puntos = 0;
  const paraElMapa = stand => {
    const intento = mios[stand.id];
    const vista = {
      id: stand.id, nombre: stand.nombre, requiereCodigo: stand.requiereCodigo,
      numPreguntas: stand.numPreguntas, puntosMax: stand.numPreguntas * catalogo.config.puntos_por_defecto,
      estado: 'PENDIENTE', correctas: 0, total: stand.numPreguntas, puntaje: 0,
    };
    if (!intento) return vista;

    const estado = texto_(intento.estado).toUpperCase();
    if (estado === 'COMPLETADO') {
      vista.estado = 'COMPLETADO';
      vista.correctas = Number(intento.correctas) || 0;
      vista.puntaje = Number(intento.puntaje) || 0;
      try { vista.total = JSON.parse(intento.preguntas_json).length; } catch (e) { /* se queda con numPreguntas */ }
      puntos += vista.puntaje;
    } else {
      // Un intento EN_CURSO cuyo tiempo ya pasó cuenta como vencido aunque la hoja no lo diga.
      vista.estado = estado === 'EN_CURSO' && ms_(intento.vence_en) > ahora ? 'EN_CURSO' : 'VENCIDO';
    }
    return vista;
  };

  // paraElMapa va sumando "puntos": hay que recorrer todos los stands antes de armar la respuesta.
  const entrada = catalogo.stands.find(s => !s.requiereCodigo);
  const entradaParaElMapa = entrada ? paraElMapa(entrada) : null;
  const pabellones = pabellonesDelMapa_(catalogo).map(p => ({
    id: p.id, nombre: p.nombre, indice: p.indice, stands: p.stands.map(paraElMapa),
  }));

  return { puntos: puntos, puesto: puestoDe_(sesion.email), entrada: entradaParaElMapa, pabellones: pabellones };
}
