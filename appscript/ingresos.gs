/**
 * Vista INGRESOS: cuántas personas están registradas en la hoja Usuarios y a qué hora entró cada una.
 * Solo lee la hoja. No escribe en Usuarios ni toca el registro, y no manda correos al navegador: si una fila no tiene
 * nombre, se deduce aquí, del correo.
 */

/** Total de personas registradas y la lista, de la más reciente a la más antigua. Cada persona trae su nombre y su hora de ingreso (ms). */
function obtenerIngresos() {
  exigirVista_('INGRESOS');
  const vistos = {};
  const personas = [];
  leerHoja_(HOJA.USUARIOS, ['email', 'nombre', 'registrado_en']).forEach(u => {
    const email = texto_(u.email).toLowerCase();
    // Una persona con dos filas (escritas a mano) cuenta una sola vez.
    if (!email || vistos[email]) return;
    vistos[email] = true;
    personas.push({ nombre: texto_(u.nombre) || nombreDesdeEmail_(email), ms: fechaEnMs_(u.registrado_en) });
  });
  personas.sort((a, b) => b.ms - a.ms);
  return { total: personas.length, personas: personas };
}
