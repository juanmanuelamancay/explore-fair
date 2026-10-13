/**
 * Vista CHARLAS: la ruta de charlas y talleres previos al evento, con su horario.
 * Cada charla es una unidad con su banco de preguntas, su código (lo genera el ponente al terminar) y un intento por persona.
 * Los puntos suman al mismo ranking que el evento. Las fechas y los puntos salen de las hojas Charlas y Preguntas:
 * el código no conoce ninguna fecha.
 */

function obtenerCharlas() {
  const sesion = exigirVista_('CHARLAS');
  const catalogo = catalogo_();
  const ahora = Date.now();
  const puntosPorPregunta = catalogo.config.puntos_por_defecto;

  // Solo el usuario responde: el admin y el validador ven la ruta sin intentos, y no tocan su índice ni la hoja Intentos.
  const responde = sesion.rol === 'USUARIO';
  const mios = responde ? miIndice_(sesion) : {};
  if (responde) sincronizarPendientes_(sesion, mios);

  return {
    ahora: ahora,
    puntos: puntosDe_(mios),
    soloLectura: !responde,
    charlas: charlasDe_(catalogo).map(c => Object.assign(estadoDeUnidad_(c, mios[c.id], ahora, puntosPorPregunta), {
      ponente: c.ponente, descripcion: c.descripcion, inicio: c.inicio, fin: c.fin, cierre: c.cierre,
      // Pasada la hora de cierre ya no se puede empezar el quiz de esta charla (el que está en curso se termina).
      cerrada: charlaCerrada_(c, ahora),
      // Una charla sin fecha de inicio está abierta desde el principio.
      empezo: !c.inicio || ahora >= c.inicio,
    })),
  };
}
