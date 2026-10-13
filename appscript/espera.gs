/**
 * Vista ESPERA: lo que ve el usuario antes del evento, mientras espera_activa está en TRUE.
 * Esta vista solo lee. A quien entra lo registra en Usuarios el navegador, en segundo plano (registro.gs).
 */

/** Premios activos, en orden. La hoja Premios es opcional: sin ella, la lista sale vacía. */
function premios_() {
  let premios = cacheLeer_('premios');
  if (!premios) {
    premios = leerPremios_();
    cachePoner_('premios', premios, segundosDeCatalogo_(catalogo_().config));
  }
  return premios;
}

/** Lee la hoja Premios sin pasar por la caché. */
function leerPremios_() {
  return !hojaSiExiste_('Premios') ? [] : leerHoja_('Premios')
    .filter(p => esVerdadero_(p.activo))
    .map(p => ({ orden: Number(p.orden) || 0, titulo: texto_(p.titulo), descripcion: texto_(p.descripcion) }))
    .sort((a, b) => a.orden - b.orden);
}

/**
 * El evento son las charlas y la feria, y los puntos de las dos se acumulan. La cuenta regresiva llega hasta lo primero que
 * empiece: la primera charla o la feria (fecha_feria en Config), lo que caiga antes. Todas las fechas salen de las hojas.
 */
function obtenerEspera() {
  exigirVista_('ESPERA');
  const catalogo = catalogo_();
  const charlas = charlasDe_(catalogo).filter(c => c.inicio).map(c => ({ titulo: c.nombre, ponente: c.ponente, inicio: c.inicio, fin: c.fin }));
  const inicios = [catalogo.config.fecha_feria].concat(charlas.map(c => c.inicio)).filter(Boolean);
  return {
    ahora: Date.now(),
    fecha: inicios.length ? Math.min.apply(null, inicios) : 0,
    fechaFeria: catalogo.config.fecha_feria,
    charlas: charlas,
    lugar: catalogo.config.lugar_feria,
    mensaje: catalogo.config.espera_mensaje,
    mensajePremios: catalogo.config.premios_mensaje,
    premios: premios_(),
    pabellones: pabellonesDelMapa_(catalogo).map(p => ({
      nombre: p.nombre, indice: p.indice, stands: p.stands.map(s => s.nombre),
    })),
  };
}
