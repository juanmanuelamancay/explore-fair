// Mover un stand a otro pabellón: datos, quiz y rechazos. Requiere el simulador corriendo. node mover-stand.js [puerto]
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

(async () => {
  const admin = 'admin@demo.com', lider = 'lider.backend@demo.com', ana = 'ana.torres@demo.com', expo = 'expositor.apx@demo.com';

  // Pabellón nuevo, con código
  let x = await intenta(admin, 'guardarAdminRegistro', 'pabellones', { nombre: 'Nuevo', requiere_codigo: true, orden: 10, activo: true });
  ok(x.valor, 'se crea el pabellón nuevo', x.error);
  const nuevo = x.valor.pabellones.find(p => p.nombre === 'Nuevo').pabellon_id;

  const antes = await llamar(admin, 'obtenerAdminCatalogo');
  const preguntasAntes = antes.preguntas.filter(p => p.stand_id === 'STD-001').length;

  // Rechazos antes de tocar nada
  x = await intenta(admin, 'moverAdminStand', 'STD-001', 'PAB-001');
  ok(x.error && /ya está/.test(x.error), 'no mueve a su mismo pabellón', x);
  x = await intenta(admin, 'moverAdminStand', 'STD-001', 'PAB-000');
  ok(x.error && /pabellón con código/.test(x.error), 'no mueve a un pabellón sin código', x);
  x = await intenta(admin, 'moverAdminStand', 'STD-000', nuevo);
  ok(x.error && /quiz de entrada/.test(x.error), 'no mueve el stand del quiz de entrada', x);
  x = await intenta(admin, 'moverAdminStand', 'STD-001', 'PAB-999');
  ok(x.error && /no existe o está inactivo/.test(x.error), 'no mueve a un pabellón que no existe', x);
  x = await intenta(lider, 'moverAdminStand', 'STD-001', nuevo);
  ok(x.error, 'un líder no puede mover stands', x.valor);
  x = await intenta(admin, 'guardarAdminRegistro', 'stands', Object.assign({}, antes.stands.find(s => s.stand_id === 'STD-001'), { pabellon_id: nuevo, expositor_email: '' }));
  ok(x.error && /Mover hacia/.test(x.error), 'el formulario de edición no cambia el pabellón', x.valor);

  // Movimiento
  x = await intenta(admin, 'moverAdminStand', 'STD-001', nuevo);
  ok(x.valor && x.valor.movido.a === nuevo && x.valor.movido.de === 'PAB-001', 'mueve STD-001 de PAB-001 al nuevo', x.error || x.valor && x.valor.movido);
  const despues = x.valor ? x.valor.datos : await llamar(admin, 'obtenerAdminCatalogo');

  const stand = despues.stands.find(s => s.stand_id === 'STD-001');
  ok(stand.pabellon_id === nuevo, 'el stand queda en el pabellón nuevo con el mismo ID');
  ok(despues.preguntas.filter(p => p.stand_id === 'STD-001').length === preguntasAntes, 'sus preguntas no cambian ni se pierden', preguntasAntes);
  const filaExpo = despues.staff.find(f => f.email === expo);
  ok(filaExpo && filaExpo.pabellon_id === nuevo && filaExpo.stand_id === 'STD-001', 'su expositor sigue el stand al pabellón nuevo', filaExpo);
  ok(despues.stands.filter(s => s.pabellon_id === 'PAB-001').map(s => s.stand_id).join(',') === 'STD-002,STD-003', 'PAB-001 queda con sus otros stands');
  ok(despues.staff.find(f => f.email === 'lider.backend@demo.com').pabellon_id === 'PAB-001', 'el líder de PAB-001 no cambia');

  // Lo que ve cada uno
  const banco = await llamar(expo, 'obtenerBancoPreguntas');
  ok(banco.stands.some(b => b.id === 'STD-001') && banco.preguntas.length === preguntasAntes, 'el expositor sigue viendo y editando sus preguntas');

  // Quiz del pabellón nuevo: solo tiene STD-001 y debe abrir con sus preguntas
  const codigo = (await llamar(admin, 'generarCodigo', nuevo)).codigo;
  const quiz = await llamar(ana, 'iniciarQuiz', nuevo, codigo);
  ok(quiz.ok && quiz.preguntas.length === 2, 'el quiz del pabellón nuevo abre con las preguntas del stand movido', quiz);
  const ids = new Set(banco.preguntas.map(p => p.id));
  ok(quiz.preguntas.every(p => ids.has(p.id)), 'las preguntas del quiz son las del stand');

  // El pabellón de origen sigue abriendo con su código
  const codigoOrigen = (await llamar(lider, 'generarCodigo', 'PAB-001')).codigo;
  const quizOrigen = await llamar(ana, 'iniciarQuiz', 'PAB-001', codigoOrigen);
  ok(quizOrigen.ok && quizOrigen.preguntas.length === 4, 'PAB-001 sigue abriendo, con dos stands', quizOrigen);

  // Editar el stand sin cambiar de pabellón sigue funcionando
  x = await intenta(admin, 'guardarAdminRegistro', 'stands', Object.assign({}, stand, { _fila: stand._fila, nombre: 'APX v2', pabellon_id: nuevo, expositor_email: 'expositor.apx@demo.com' }));
  ok(x.valor && x.valor.stands.find(s => s.stand_id === 'STD-001').nombre === 'APX v2', 'editar el nombre del stand sigue funcionando', x.error);

  console.log(fallos ? '\n' + fallos + ' FALLAS' : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(2); });
