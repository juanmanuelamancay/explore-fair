/**
 * Vista RANKING. El ranking no es una hoja: se calcula desde Intentos y se guarda unos segundos en caché.
 */

/** Lista ordenada de quienes tienen al menos un quiz completado. Incluye el email: no devolver tal cual al navegador. */
function rankingCompleto_() {
  let ranking = cacheLeer_('ranking');
  if (ranking) return ranking;

  const catalogo = catalogo_();
  const esEntrada = {};
  catalogo.stands.forEach(s => { if (!s.requiereCodigo) esEntrada[s.id] = true; });

  const porEmail = {};
  leerHoja_(HOJA.INTENTOS).forEach(i => {
    if (texto_(i.estado).toUpperCase() !== 'COMPLETADO') return;
    const email = texto_(i.email).toLowerCase();
    const fila = porEmail[email] || (porEmail[email] = { email: email, puntos: 0, stands: 0, ultimo: 0 });
    fila.puntos += Number(i.puntaje) || 0;
    if (!esEntrada[id_(i.stand_id)]) fila.stands++;
    fila.ultimo = Math.max(fila.ultimo, ms_(i.completado_en) || 0);
  });

  const nombres = {};
  leerHoja_(HOJA.USUARIOS).forEach(u => { nombres[texto_(u.email).toLowerCase()] = texto_(u.nombre); });

  // En empate va primero quien llegó antes a ese puntaje.
  ranking = Object.keys(porEmail).map(email => porEmail[email])
    .sort((a, b) => b.puntos - a.puntos || a.ultimo - b.ultimo)
    .map(f => ({ email: f.email, nombre: nombres[f.email] || nombreDesdeEmail_(f.email), puntos: f.puntos, stands: f.stands }));

  cachePoner_('ranking', ranking, Math.max(5, catalogo.config.segundos_refresco_board));
  return ranking;
}

/** Puesto de una persona, o null si todavía no tiene puntaje. */
function puestoDe_(email) {
  const indice = rankingCompleto_().findIndex(f => f.email === email);
  return indice < 0 ? null : indice + 1;
}

function obtenerRanking() {
  const sesion = exigirVista_('RANKING');
  return {
    filas: rankingCompleto_().map(f => ({ nombre: f.nombre, puntos: f.puntos, stands: f.stands, yo: f.email === sesion.email })),
  };
}
