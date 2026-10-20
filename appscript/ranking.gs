/**
 * Vista RANKING. El ranking no es una hoja: se calcula desde Intentos y se guarda unos segundos en caché.
 */

/** Lista ordenada de quienes tienen al menos un quiz completado. Incluye el email: no devolver tal cual al navegador. */
function rankingCompleto_() {
  let ranking = cacheLeer_('ranking');
  if (ranking) return ranking;

  const porEmail = {};
  const vistos = {};   // persona + unidad (pabellón o charla): una fila repetida no suma dos veces
  leerHoja_(HOJA.INTENTOS, ['email', 'unidad_id', 'estado', 'puntaje', 'iniciado_en', 'completado_en']).forEach(i => {
    if (texto_(i.estado).toUpperCase() !== 'COMPLETADO') return;
    const email = texto_(i.email).toLowerCase();
    const clave = email + '|' + id_(i.unidad_id);
    if (vistos[clave]) return;
    vistos[clave] = true;
    const fila = porEmail[email] || (porEmail[email] = { email: email, puntos: 0, duracionMs: 0, unidades: 0 });
    fila.puntos += Number(i.puntaje) || 0;
    // Tiempo total: lo de cada quiz se suma, no se promedia. Dos quizzes de 6 y 8 segundos dan 14, no 7.
    fila.duracionMs += Math.max(0, (ms_(i.completado_en) || 0) - (ms_(i.iniciado_en) || 0));
    fila.unidades += 1;
  });

  const nombres = {};
  leerHoja_(HOJA.USUARIOS).forEach(u => { nombres[texto_(u.email).toLowerCase()] = texto_(u.nombre); });

  // En empate va primero quien respondió más rápido en total (la suma de lo que se demoró en cada quiz).
  ranking = Object.keys(porEmail).map(email => porEmail[email])
    .sort((a, b) => b.puntos - a.puntos || a.duracionMs - b.duracionMs)
    .map(f => ({
      email: f.email, nombre: nombreCorto_(nombres[f.email] || nombreDesdeEmail_(f.email)), puntos: f.puntos,
      // Segundos totales y pabellones/charlas resueltos, para mostrarlo en la pantalla solo cuando hay empate.
      seg: Math.round((f.duracionMs / 1000) * 10) / 10,
      unidades: f.unidades,
    }));

  cachePoner_('ranking', ranking, Math.max(5, Number(catalogo_().config.segundos_cache_ranking) || 60));
  return ranking;
}

/** Vista para proyectar, solo del admin. Con forzar = true (botón de actualizar) se descarta la caché y se lee el Sheet. Trae también el preset. */
function obtenerRanking(forzar) {
  exigirVista_('RANKING');
  if (forzar) cacheQuitar_('ranking');
  return { ...filasDelRanking_(), ajustes: ajustesPantalla_(catalogo_().config) };
}

/** Rangos permitidos para cada clave del preset: lo que llegue fuera de aquí se corrige al guardar. */
const RANGOS_PANTALLA_ = {
  rp_personas: [0, 300], rp_columnas: [1, 8], rp_alto: [40, 120], rp_espacio: [4, 24],
  rp_fuente: [12, 30], rp_puntos: [14, 40], rp_escala: [60, 160], rp_ancho_top: [40, 100], rp_tiempo: [10, 24],
};

/** Preset en el formato que usa la pantalla (los valores de Config, o los de CONFIG_DEFECTO si no hay nada guardado). */
function ajustesPantalla_(config) {
  return {
    personas: config.rp_personas, columnas: config.rp_columnas, alto: config.rp_alto, espacio: config.rp_espacio,
    fuente: config.rp_fuente, puntos: config.rp_puntos, escala: config.rp_escala, anchoTop: config.rp_ancho_top,
    tiempo: config.rp_tiempo,
    ocultarMenu: config.rp_ocultar_menu === true,
    modoOscuro: config.rp_modo_oscuro === true,
  };
}

/** Guarda el preset en la hoja Config. Solo escribe valores numéricos, dentro de rango. */
function guardarAjustesPantalla(ajustes) {
  exigirVista_('RANKING');
  const entrada = ajustes || {};
  const campos = { personas: 'rp_personas', columnas: 'rp_columnas', alto: 'rp_alto', espacio: 'rp_espacio',
    fuente: 'rp_fuente', puntos: 'rp_puntos', escala: 'rp_escala', anchoTop: 'rp_ancho_top', tiempo: 'rp_tiempo' };
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
    refrescarCatalogo_();
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

/** Las filas que ve la pantalla: nombre, puntos y el segundo por pregunta (para explicar un empate), sin el email. */
function filasDelRanking_() {
  return { filas: rankingCompleto_().map(f => ({ nombre: f.nombre, puntos: f.puntos, seg: f.seg })) };
}
