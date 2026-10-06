/**
 * Vista ESPERA: lo que ve el usuario antes del evento, mientras espera_activa está en TRUE.
 * Solo lee: no registra a nadie ni escribe en ninguna hoja.
 */

/** Premios activos, en orden. La hoja Premios es opcional: sin ella, la lista sale vacía. */
function premios_() {
  let premios = cacheLeer_('premios');
  if (!premios) {
    premios = !hojaSiExiste_('Premios') ? [] : leerHoja_('Premios')
      .filter(p => esVerdadero_(p.activo))
      .map(p => ({ orden: Number(p.orden) || 0, titulo: texto_(p.titulo), descripcion: texto_(p.descripcion) }))
      .sort((a, b) => a.orden - b.orden);
    cachePoner_('premios', premios, segundosDeCatalogo_(catalogo_().config));
  }
  return premios;
}

function obtenerEspera() {
  exigirVista_('ESPERA');
  const catalogo = catalogo_();
  return {
    ahora: Date.now(),
    fecha: catalogo.config.fecha_feria,
    lugar: catalogo.config.lugar_feria,
    mensaje: catalogo.config.espera_mensaje,
    premios: premios_(),
    pabellones: pabellonesDelMapa_(catalogo).map(p => ({
      nombre: p.nombre, indice: p.indice, stands: p.stands.map(s => s.nombre),
    })),
  };
}
