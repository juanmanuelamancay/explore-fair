/**
 * Vista TABLA: la misma lista del ranking, pero para el celular del admin y el validador. A diferencia de la
 * pantalla de ranking (RANKING), esta sí trae el correo de cada persona, para buscarla por nombre y copiarlo.
 * No tiene su propio cálculo: reutiliza rankingCompleto_() de ranking.gs, con la misma caché.
 */

/** Todas las personas con al menos un quiz completado, en el mismo orden del ranking, con su puesto y su correo.
 * forzar = true (botón de actualizar) descarta la caché del ranking y la vuelve a calcular desde el Sheet. */
function obtenerTabla(forzar) {
  exigirVista_('TABLA');
  if (forzar) cacheQuitar_('ranking');
  return {
    filas: rankingCompleto_().map((f, i) =>
      ({ puesto: i + 1, nombre: f.nombre, puntos: f.puntos, email: f.email, seg: f.seg, unidades: f.unidades })),
  };
}
