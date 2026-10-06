/**
 * Vista GENERAR_CODIGO: el líder genera el código temporal de su stand al terminar la charla.
 */

// Solo consonantes y dígitos, sin 0/O, 1/I/L. Sin vocales no se forman palabras ni valores
// que Sheets convierta solo (TRUE, fechas, notación científica como 2E45).
const LETRAS_DE_CODIGO = 'BCDFGHJKMNPQRSTVWXYZ';
const CARACTERES_DE_CODIGO = LETRAS_DE_CODIGO + '23456789';
const LARGO_DE_CODIGO = 4;

/** Stands para los que esta persona puede generar código, según su fila en Staff. */
function standsALiderar_(sesion, catalogo) {
  const pabellones = pabellonesDelMapa_(catalogo);
  const todos = [];
  pabellones.forEach(p => p.stands.forEach(s => todos.push({ id: s.id, nombre: s.nombre, pabellon: p.nombre, pabellonId: p.id, indice: p.indice })));
  if (sesion.rol === 'ADMIN') return todos;
  if (!sesion.staff) return [];
  if (sesion.staff.standId) return todos.filter(s => s.id === sesion.staff.standId);
  return todos.filter(s => s.pabellonId === sesion.staff.pabellonId);
}

function estaVigente_(codigo, ahoraMs) {
  return texto_(codigo.estado).toUpperCase() === 'ACTIVO' && ms_(codigo.expira_en) > ahoraMs;
}

function obtenerCodigos() {
  const sesion = exigirVista_('GENERAR_CODIGO');
  const ahora = Date.now();
  const vigentes = {};
  leerHoja_(HOJA.CODIGOS).forEach(c => {
    if (estaVigente_(c, ahora)) vigentes[id_(c.stand_id)] = { codigo: texto_(c.codigo), expiraEn: ms_(c.expira_en) };
  });
  return {
    ahora: ahora,
    stands: standsALiderar_(sesion, catalogo_()).map(s => ({
      id: s.id, nombre: s.nombre, pabellon: s.pabellon, indice: s.indice, activo: vigentes[s.id] || null,
    })),
  };
}

/** Crea un código nuevo para el stand. El que estuviera activo deja de funcionar. */
function generarCodigo(standId) {
  const sesion = exigirVista_('GENERAR_CODIGO');
  const catalogo = catalogo_();
  const stand = standsALiderar_(sesion, catalogo).find(s => s.id === id_(standId));
  if (!stand) throw new Error('No puedes generar códigos para este stand.');

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(SEGUNDOS_BLOQUEO);
  try {
    const ahora = new Date();
    const enUso = {};
    leerHoja_(HOJA.CODIGOS).forEach(c => {
      if (texto_(c.estado).toUpperCase() !== 'ACTIVO') return;
      if (id_(c.stand_id) === stand.id) {
        const estado = ms_(c.expira_en) > ahora.getTime() ? 'ANULADO' : 'EXPIRADO';
        actualizarFila_(HOJA.CODIGOS, c._fila, { estado: estado });
      } else {
        enUso[texto_(c.codigo).toUpperCase()] = true;
      }
    });

    let codigo;
    do { codigo = codigoAlAzar_(); } while (enUso[codigo]);

    const expiraEn = new Date(ahora.getTime() + catalogo.config.minutos_vigencia_codigo * 60000);
    agregarFila_(HOJA.CODIGOS, {
      codigo: codigo, stand_id: stand.id, generado_por: sesion.email,
      creado_en: ahora, expira_en: expiraEn, estado: 'ACTIVO',
    });
    return { codigo: codigo, expiraEn: expiraEn.getTime(), ahora: Date.now() };
  } finally {
    bloqueo.releaseLock();
  }
}

/** Empieza siempre con letra, así Sheets nunca lo guarda como número. */
function codigoAlAzar_() {
  const alAzar = caracteres => caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  let codigo = alAzar(LETRAS_DE_CODIGO);
  while (codigo.length < LARGO_DE_CODIGO) codigo += alAzar(CARACTERES_DE_CODIGO);
  return codigo;
}
