// Staff con varias filas activas (líder + expositor + ponente a la vez). node doble-rol.js [puerto]
const PUERTO = process.argv[2] || '8135';
const base = 'http://localhost:' + PUERTO;
let fallos = 0;
const ok = (cond, msg, extra) => { if (!cond) { fallos++; console.log('FALLA  ' + msg, extra !== undefined ? JSON.stringify(extra) : ''); } else console.log('ok     ' + msg); };
async function llamar(email, funcion, ...argumentos) {
  const r = await fetch(base + '/run?como=' + encodeURIComponent(email), { method: 'POST', body: JSON.stringify({ funcion, argumentos }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.valor;
}
const intenta = async (...a) => { try { return { valor: await llamar(...a) }; } catch (e) { return { error: e.message }; } };
const ids = lista => lista.map(x => x.id).sort().join(',');

(async () => {
  const admin = 'admin@bbva.com', joan = 'joan@bbva.com', validador = 'validador@bbva.com', expo = 'expositor.apx@bbva.com';
  const staff = (email, rol, extra) => intenta(admin, 'guardarAdminRegistro', 'staff', Object.assign({ email, nombre: 'Joan', rol, activo: true }, extra));

  // Antes de darle filas, Joan es un usuario normal
  let acc = await llamar(joan, 'obtenerAcceso');
  ok(acc.rol === 'USUARIO' && acc.vistas.indexOf('GENERAR_CODIGO') < 0, 'sin filas en Staff es USUARIO', acc);

  let x = await staff(joan, 'LIDER', { pabellon_id: 'PAB-001' });
  ok(x.valor, 'fila LIDER', x.error);
  x = await staff(joan, 'EXPOSITOR', { pabellon_id: 'PAB-001', stand_id: 'STD-001' });
  ok(x.valor, 'segunda fila EXPOSITOR del mismo correo', x.error);
  x = await staff(joan, 'PONENTE', { charla_id: 'CHA-001' });
  ok(x.valor, 'tercera fila PONENTE del mismo correo', x.error);

  acc = await llamar(joan, 'obtenerAcceso');
  ok(acc.vistas.indexOf('GENERAR_CODIGO') >= 0 && acc.vistas.indexOf('PREGUNTAS') >= 0 && acc.vistas.indexOf('PANEL_ADMIN') < 0, 'las vistas son la unión: código y preguntas, nada más', acc.vistas);

  const cod = await llamar(joan, 'obtenerCodigos');
  ok(ids(cod.unidades) === 'CHA-001,PAB-001', 'genera código para su pabellón y su taller, y solo esos', ids(cod.unidades));
  x = await intenta(joan, 'generarCodigo', 'PAB-001');
  ok(x.valor && x.valor.codigo, 'genera el código de su pabellón', x.error);
  x = await intenta(joan, 'generarCodigo', 'CHA-001');
  ok(x.valor && x.valor.codigo, 'genera el código de su taller', x.error);
  x = await intenta(joan, 'generarCodigo', 'PAB-002');
  ok(x.error, 'no genera el código de otro pabellón');
  x = await intenta(joan, 'generarCodigo', 'CHA-002');
  ok(x.error, 'no genera el código de otro taller');

  const banco = await llamar(joan, 'obtenerBancoPreguntas');
  ok(ids(banco.stands) === 'CHA-001,STD-001', 've el banco de su stand y el de su taller, y solo esos', ids(banco.stands));
  ok(banco.preguntas.every(p => p.standId === 'STD-001' || p.standId === 'CHA-001'), 'solo recibe preguntas de esos dos bancos');
  const propia = banco.preguntas.find(p => p.standId === 'STD-001');
  x = await intenta(joan, 'guardarPreguntaLider', { id: propia.id, standId: 'STD-001', texto: 'Editada por Joan', opciones: ['a', 'b', 'c', 'd'], correcta: 'B' });
  ok(x.valor, 'edita una pregunta de su stand', x.error);
  const deCharla = banco.preguntas.find(p => p.standId === 'CHA-001');
  x = await intenta(joan, 'guardarPreguntaLider', { id: deCharla.id, standId: 'CHA-001', texto: 'Editada por Joan en su taller', opciones: ['a', 'b', 'c', 'd'], correcta: 'C' });
  ok(x.valor, 'edita una pregunta de su taller', x.error);
  x = await intenta(joan, 'guardarPreguntaLider', { standId: 'STD-002', texto: 'Ajena', opciones: ['a', 'b', 'c', 'd'], correcta: 'A' });
  ok(x.error, 'no agrega preguntas a un stand ajeno');
  const ajena = (await llamar(admin, 'obtenerAdminCatalogo')).preguntas.find(p => p.stand_id === 'STD-002');
  x = await intenta(joan, 'guardarPreguntaLider', { id: ajena.pregunta_id, standId: 'STD-002', texto: 'Ajena', opciones: ['a', 'b', 'c', 'd'], correcta: 'A' });
  ok(x.error, 'no edita una pregunta de un stand ajeno');

  // Staff y quiz: no responde quizzes aunque tenga varias filas
  x = await intenta(joan, 'iniciarQuiz', 'PAB-001', 'ZZZZ');
  ok((x.valor && !x.valor.ok) || x.error, 'sigue sin responder quizzes');

  // Quien tiene una sola fila no cambia
  const bancoExpo = await llamar(expo, 'obtenerBancoPreguntas');
  ok(ids(bancoExpo.stands) === 'STD-001', 'el expositor de una sola fila sigue viendo solo su stand', ids(bancoExpo.stands));

  // El validador va solo: una fila de más no le da permisos ni alcance
  x = await staff(validador, 'PONENTE', { charla_id: 'CHA-002' });
  ok(x.error, 'el panel rechaza una segunda fila para un validador', x.valor);
  x = await staff(joan, 'EXPOSITOR', { pabellon_id: 'PAB-001', stand_id: 'STD-002' });
  ok(x.error, 'el panel rechaza dos filas del mismo rol para un correo', x.valor);
  x = await staff(admin, 'LIDER', { pabellon_id: 'PAB-001' });
  ok(x.error, 'el panel rechaza una fila de más para el admin', x.valor);
  const accV = await llamar(validador, 'obtenerAcceso');
  ok(accV.rol === 'VALIDADOR' && accV.vistas.indexOf('GENERAR_CODIGO') < 0, 'el validador con una fila de más sigue siendo solo validador', accV);
  x = await intenta(validador, 'guardarPreguntaLider', { standId: 'CHA-002', texto: 'x', opciones: ['a', 'b', 'c', 'd'], correcta: 'A' });
  ok(x.error, 'ese validador no edita preguntas');

  console.log(fallos ? '\n' + fallos + ' FALLAS' : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(2); });
