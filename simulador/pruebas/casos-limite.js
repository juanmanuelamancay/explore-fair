// Casos límite: banco incompleto, banco con más del tope, roles que no responden. node t4.js [puerto]
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
  const ana = 'ana.torres@demo.com', lider = 'lider.backend@demo.com', admin = 'admin@demo.com', expo = 'expositor.apx@demo.com';
  // Entrada
  let r = await llamar(ana, 'iniciarQuiz', 'PAB-000', '');
  const resp = {}; r.preguntas.forEach(p => { resp[p.id] = 'A'; });
  await llamar(ana, 'enviarQuiz', r.intentoId, resp);

  // Un stand del pabellón PAB-002 se queda sin preguntas: el quiz del pabellón no abre y el mensaje dice cuál
  let cat = await llamar(admin, 'obtenerAdminCatalogo');
  const delStand = cat.preguntas.filter(p => p.stand_id === 'STD-005');
  for (const p of delStand.slice(0, 3)) {
    await llamar(admin, 'guardarAdminRegistro', 'preguntas', Object.assign({}, p, { activo: false }));
  }
  const g = await llamar('lider.backend@demo.com', 'obtenerCodigos');
  // El líder de demo es de PAB-001: el admin genera el de PAB-002
  const codigo = (await llamar(admin, 'generarCodigo', 'PAB-002')).codigo;
  r = await llamar(ana, 'iniciarQuiz', 'PAB-002', codigo);
  ok(!r.ok && r.motivo === 'SIN_PREGUNTAS' && /Glomo/.test(r.mensaje) && /necesita 12/.test(r.mensaje), 'un stand con 9 de 12 bloquea el pabellón y dice cuál', r);
  // El resto de pabellones sigue abierto
  const c1 = (await llamar(lider, 'generarCodigo', 'PAB-001')).codigo;
  r = await llamar(ana, 'iniciarQuiz', 'PAB-001', c1);
  ok(r.ok && r.preguntas.length === 6, 'otro pabellón abre igual');

  // Admin carga más de 12 en un stand: el quiz sigue sorteando 2 y el admin puede seguir agregando
  const extra = [{ texto: 'Extra', opcion_a: 'a', opcion_b: 'b', opcion_c: 'c', opcion_d: 'd', correcta: 'A', puntos: 10, activo: true }];
  let x = await intenta(admin, 'importarPreguntasAdmin', 'STD-001', extra);
  ok(x.valor && x.valor.importadas === 1, 'el admin puede pasar de 12 con el JSON');
  const banco = await llamar(expo, 'obtenerBancoPreguntas');
  const activas = banco.preguntas.filter(p => p.activo).length;
  ok(activas === 13 && banco.stands[0].maximo === 12, 'el expositor ve 13 activas y su máximo de 12', { activas });
  x = await intenta(expo, 'guardarPreguntaLider', { standId: 'STD-001', texto: 'Otra', opciones: ['a', 'b', 'c', 'd'], correcta: 'A' });
  ok(x.error && /12 preguntas activas/.test(x.error), 'con el banco lleno el expositor no agrega');
  x = await intenta(admin, 'guardarPreguntaLider', { standId: 'STD-001', texto: 'Del admin', opciones: ['a', 'b', 'c', 'd'], correcta: 'A' });
  ok(x.valor, 'el admin sí puede agregar desde la vista Preguntas', x.error);

  // Roles que no responden
  for (const quien of [lider, expo, admin, 'ponente.uno@demo.com']) {
    const y = await intenta(quien, 'iniciarQuiz', 'PAB-001', 'ZZZZ');
    ok((y.valor && !y.valor.ok) || y.error, quien + ' no responde quizzes', y);
  }

  // Pabellón sin stands activos no aparece ni abre
  x = await intenta(admin, 'guardarAdminRegistro', 'pabellones', { nombre: 'Vacío', requiere_codigo: true, orden: 50, activo: true });
  const vacio = x.valor && x.valor.pabellones.find(p => p.nombre === 'Vacío');
  const mapa = await llamar(ana, 'obtenerMapa');
  ok(vacio && !mapa.pabellones.some(p => p.id === vacio.pabellon_id), 'un pabellón sin stands no sale en el mapa');
  // Quiz de entrada solo uno
  x = await intenta(admin, 'guardarAdminRegistro', 'pabellones', Object.assign({}, vacio, { requiere_codigo: false }));
  ok(x.error && /sin código/.test(x.error), 'no deja un segundo pabellón sin código');

  // Charla creada con ponente existente rechazada; staff con rol y charla
  x = await intenta(admin, 'guardarAdminRegistro', 'staff', { email: 'nuevo@demo.com', nombre: 'Nuevo', rol: 'PONENTE', charla_id: 'CHA-002', activo: true });
  ok(x.valor && x.valor.staff.some(s => s.email === 'nuevo@demo.com' && s.charla_id === 'CHA-002'), 'staff PONENTE con su charla', x.error);
  x = await intenta(admin, 'guardarAdminRegistro', 'staff', { email: 'otro@demo.com', nombre: 'Otro', rol: 'EXPOSITOR', pabellon_id: 'PAB-002', stand_id: 'STD-001', activo: true });
  ok(x.error && /no pertenece/.test(x.error), 'staff EXPOSITOR con un stand de otro pabellón se rechaza', x);
  x = await intenta(admin, 'guardarAdminRegistro', 'staff', { email: 'otro@demo.com', nombre: 'Otro', rol: 'LIDER', activo: true });
  ok(x.error && /pabellón/.test(x.error), 'staff LIDER sin pabellón se rechaza', x);

  console.log(fallos ? '\n' + fallos + ' FALLAS' : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(2); });
