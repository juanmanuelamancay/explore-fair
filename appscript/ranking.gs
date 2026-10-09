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

/** Con forzar = true (botón de actualizar) se descarta la caché antes de leer, para traer lo que hay en el Sheet ahora. */
function obtenerRanking(forzar) {
  const sesion = exigirVista_('RANKING');
  if (forzar) limpiarCache();
  return rankingParaSesion_(sesion);
}

/** Misma lista para la vista de pantalla grande, con su propio permiso (solo admin, en Permisos). Trae también el preset. */
function obtenerRankingPantalla(forzar) {
  const sesion = exigirVista_('RANKING_PANTALLA');
  if (forzar) limpiarCache();
  return { ...rankingParaSesion_(sesion), ajustes: ajustesPantalla_(catalogo_().config) };
}

/** Rangos permitidos para cada clave del preset: lo que llegue fuera de aquí se corrige al guardar. */
const RANGOS_PANTALLA_ = {
  rp_personas: [0, 300], rp_columnas: [1, 8], rp_alto: [40, 120], rp_espacio: [4, 24],
  rp_fuente: [12, 30], rp_puntos: [14, 40], rp_escala: [60, 160], rp_ancho_top: [40, 100],
};

/** Preset en el formato que usa la pantalla (los valores de Config, o los de CONFIG_DEFECTO si no hay nada guardado). */
function ajustesPantalla_(config) {
  return {
    personas: config.rp_personas, columnas: config.rp_columnas, alto: config.rp_alto, espacio: config.rp_espacio,
    fuente: config.rp_fuente, puntos: config.rp_puntos, escala: config.rp_escala, anchoTop: config.rp_ancho_top,
    ocultarMenu: config.rp_ocultar_menu === true,
    modoOscuro: config.rp_modo_oscuro === true,
  };
}

/** Guarda el preset en la hoja Config. Solo escribe valores numéricos, dentro de rango. */
function guardarAjustesPantalla(ajustes) {
  exigirVista_('RANKING_PANTALLA');
  const entrada = ajustes || {};
  const campos = { personas: 'rp_personas', columnas: 'rp_columnas', alto: 'rp_alto', espacio: 'rp_espacio',
    fuente: 'rp_fuente', puntos: 'rp_puntos', escala: 'rp_escala', anchoTop: 'rp_ancho_top' };
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    if (typeof entrada.ocultarMenu === 'boolean') configPonerRanking_('rp_ocultar_menu', entrada.ocultarMenu);
    if (typeof entrada.modoOscuro === 'boolean') configPonerRanking_('rp_modo_oscuro', entrada.modoOscuro);
    Object.keys(campos).forEach(campo => {
      const clave = campos[campo];
      const valor = Number(entrada[campo]);
      if (!isFinite(valor)) return;
      const [minimo, maximo] = RANGOS_PANTALLA_[clave];
      configPonerRanking_(clave, Math.round(Math.min(maximo, Math.max(minimo, valor))));
    });
    limpiarCache();
  } finally {
    bloqueo.releaseLock();
  }
  return ajustesPantalla_(catalogo_().config);
}

/** Actualiza la fila de la clave en Config, o la agrega si todavía no existe. */
function configPonerRanking_(clave, valor) {
  const fila = leerHoja_(HOJA.CONFIG).find(f => normal_(f.clave) === clave);
  if (fila) actualizarFila_(HOJA.CONFIG, fila._fila, { valor: valor });
  else agregarFila_(HOJA.CONFIG, { clave: clave, valor: valor, descripcion: 'Preset de la pantalla de ranking' });
}

function rankingParaSesion_(sesion) {
  return {
    filas: rankingCompleto_().map(f => ({ nombre: f.nombre, puntos: f.puntos, stands: f.stands, yo: f.email === sesion.email })),
  };
}
