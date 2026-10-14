/**
 * Para ejecutar a mano desde el editor: escribe en la hoja Responsables qué pabellones tienen líder y qué stands tienen expositor y preguntas.
 */

const HOJA_RESPONSABLES = 'Responsables';

function reporteResponsables() {
  exigirAdmin_();
  const pabellones = leerHoja_(HOJA.PABELLONES).filter(p => esVerdadero_(p.activo));
  const stands = leerHoja_(HOJA.STANDS).filter(s => esVerdadero_(s.activo));
  const staff = leerHoja_(HOJA.STAFF).filter(f => esVerdadero_(f.activo));
  const preguntas = leerHoja_(HOJA.PREGUNTAS).filter(p => esVerdadero_(p.activo));

  const nombrePabellon = {};
  pabellones.forEach(p => { nombrePabellon[id_(p.pabellon_id)] = texto_(p.nombre); });
  const correosDe = (rol, campo, id) => staff
    .filter(f => texto_(f.rol).toUpperCase() === rol && id_(f[campo]) === id)
    .map(f => texto_(f.email).toLowerCase());
  const activasDe = {};
  preguntas.forEach(p => { const id = id_(p.stand_id); activasDe[id] = (activasDe[id] || 0) + 1; });

  const filasPabellones = pabellones.map(p => {
    const id = id_(p.pabellon_id);
    const sinCodigo = texto_(p.requiere_codigo) !== '' && !esVerdadero_(p.requiere_codigo);
    const lideres = correosDe('LIDER', 'pabellon_id', id);
    const tieneLider = sinCodigo ? 'No aplica' : (lideres.length ? 'SI' : 'NO');
    return [id, texto_(p.nombre), sinCodigo ? 'Sin código (quiz de entrada)' : 'Con código', tieneLider, lideres.join(', ')];
  });

  const filasStands = stands.map(s => {
    const id = id_(s.stand_id);
    const pabellonId = id_(s.pabellon_id);
    const expositores = correosDe('EXPOSITOR', 'stand_id', id);
    const activas = activasDe[id] || 0;
    return [
      id, texto_(s.nombre), pabellonId, nombrePabellon[pabellonId] || '',
      expositores.length ? 'SI' : 'NO', expositores.join(', '),
      activas, activas > 0 ? 'SI' : 'NO', Math.max(0, PREGUNTAS_BANCO_STAND - activas),
    ];
  });

  const conCodigo = filasPabellones.filter(f => f[3] !== 'No aplica').length;
  const conLider = filasPabellones.filter(f => f[3] === 'SI').length;
  const conExpositor = filasStands.filter(f => f[4] === 'SI').length;
  const conPreguntas = filasStands.filter(f => f[7] === 'SI').length;

  const filas = [
    ['Revisión de responsables', 'Generado', new Date()],
    ['Pabellones con código y líder', conLider + ' de ' + conCodigo],
    ['Stands con expositor', conExpositor + ' de ' + stands.length],
    ['Stands con preguntas activas', conPreguntas + ' de ' + stands.length],
    [],
    ['Pabellón', 'Nombre', 'Código', 'Tiene líder', 'Líder(es)'],
    ...filasPabellones,
    [],
    ['Stand', 'Nombre', 'Pabellón', 'Nombre del pabellón', 'Tiene expositor', 'Expositor(es)', 'Preguntas activas', 'Tiene preguntas', 'Faltan para ' + PREGUNTAS_BANCO_STAND],
    ...filasStands,
  ];
  const ancho = Math.max(...filas.map(f => f.length));
  const datos = filas.map(f => f.concat(Array(ancho - f.length).fill('')));

  const libro = libro_();
  const hoja = libro.getSheetByName(HOJA_RESPONSABLES) || libro.insertSheet(HOJA_RESPONSABLES);
  hoja.clear();
  hoja.getRange(1, 1, datos.length, ancho).setValues(datos);
  SpreadsheetApp.flush();

  const resumen = {
    pabellonesConCodigo: conCodigo, pabellonesConLider: conLider,
    stands: stands.length, standsConExpositor: conExpositor, standsConPreguntas: conPreguntas,
  };
  console.log('Responsables: líder en ' + conLider + ' de ' + conCodigo + ' pabellones con código; expositor en ' + conExpositor + ' de ' + stands.length + ' stands; preguntas en ' + conPreguntas + ' de ' + stands.length + '.');
  const etiqueta = f => f[0] + ' ' + f[1];
  console.log('Pabellones sin líder: ' + (filasPabellones.filter(f => f[3] === 'NO').map(etiqueta).join(', ') || 'ninguno'));
  console.log('Stands sin expositor: ' + (filasStands.filter(f => f[4] === 'NO').map(etiqueta).join(', ') || 'ninguno'));
  console.log('Stands sin preguntas: ' + (filasStands.filter(f => f[7] === 'NO').map(etiqueta).join(', ') || 'ninguno'));
  return resumen;
}
