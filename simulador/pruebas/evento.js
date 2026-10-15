// Prueba de punta a punta contra el simulador (modo evento). node t1.js [puerto]
const PUERTO = process.argv[2] || '8123';
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
const hoja = async nombre => (await (await fetch(base + '/hoja?nombre=' + nombre)).json());

(async () => {
  const ana = 'ana.torres@bbva.com', lider = 'lider.backend@bbva.com', expo = 'expositor.apx@bbva.com', val = 'validador@bbva.com', admin = 'admin@bbva.com';

  const acceso = await llamar(ana, 'obtenerAcceso');
  ok(acceso.rol === 'USUARIO' && acceso.vistas.includes('MAPA') && acceso.vistas.includes('QUIZ'), 'usuario: vistas MAPA y QUIZ', acceso);

  let mapa = await llamar(ana, 'obtenerMapa');
  ok(mapa.entrada && mapa.entrada.id === 'PAB-000' && mapa.entrada.numPreguntas === 4 && mapa.entrada.requiereCodigo === false, 'entrada: PAB-000, 4 preguntas, sin código', mapa.entrada);
  ok(mapa.pabellones.length === 6, '6 pabellones con código en el mapa', mapa.pabellones.map(p => p.id));
  const p1 = mapa.pabellones.find(p => p.id === 'PAB-001');
  ok(p1.numPreguntas === 6 && p1.stands.length === 3 && p1.puntosMax === 60, 'PAB-001: 3 stands × 2 = 6 preguntas, hasta 60 pts', { n: p1.numPreguntas, st: p1.stands.length, max: p1.puntosMax });

  // Pabellón antes de la entrada
  let r = await llamar(ana, 'iniciarQuiz', 'PAB-001', 'ZZZZ');
  ok(!r.ok && r.motivo === 'ENTRADA', 'no deja abrir un pabellón antes del quiz de entrada', r);

  // Entrada
  r = await llamar(ana, 'iniciarQuiz', 'PAB-000', '');
  ok(r.ok && r.preguntas.length === 4, 'quiz de entrada: 4 preguntas sin código', r.ok ? r.preguntas.length : r);
  ok(r.preguntas.every(p => p.correcta === undefined), 'las preguntas no llevan la respuesta correcta');
  const resp = {}; r.preguntas.forEach(p => { resp[p.id] = 'A'; });
  const fin = await llamar(ana, 'enviarQuiz', r.intentoId, resp);
  ok(fin.ok && fin.total === 4, 'entrada enviada', fin);

  // Código del líder de pabellón
  let cod = await llamar(lider, 'obtenerCodigos');
  ok(cod.unidades.length === 1 && cod.unidades[0].id === 'PAB-001', 'líder: solo ve su pabellón', cod.unidades);
  const g = await llamar(lider, 'generarCodigo', 'PAB-001');
  ok(/^[A-Z0-9]{4}$/.test(g.codigo), 'líder genera código de pabellón', g);
  let x = await intenta(lider, 'generarCodigo', 'PAB-002');
  ok(x.error, 'líder no genera código de otro pabellón', x);
  x = await intenta(expo, 'obtenerCodigos');
  ok(x.error, 'expositor no tiene GENERAR_CODIGO', x);

  // Quiz del pabellón
  r = await llamar(ana, 'iniciarQuiz', 'PAB-001', 'ZZZZ');
  ok(!r.ok && r.motivo === 'CODIGO', 'código incorrecto rechazado', r);
  r = await llamar(ana, 'iniciarQuiz', 'PAB-001', g.codigo);
  ok(r.ok && r.preguntas.length === 6, 'pabellón: 6 preguntas (2 por stand)', r.ok ? r.preguntas.length : r);
  // Las preguntas deben ser 2 de cada stand
  const preg = await hoja('Preguntas');
  const stands = {}; r.preguntas.forEach(p => { const fila = preg.find(f => f && f[0] === p.id); stands[fila[1]] = (stands[fila[1]] || 0) + 1; });
  ok(Object.keys(stands).length === 3 && Object.values(stands).every(n => n === 2), '2 preguntas de cada uno de los 3 stands', stands);
  // Retomar devuelve las mismas
  const otra = await llamar(ana, 'iniciarQuiz', 'PAB-001', '');
  ok(otra.ok && otra.intentoId === r.intentoId && JSON.stringify(otra.preguntas.map(p => p.id)) === JSON.stringify(r.preguntas.map(p => p.id)), 'retomar sin código devuelve las mismas preguntas');
  const resp2 = {}; r.preguntas.forEach(p => { resp2[p.id] = 'B'; });
  const fin2 = await llamar(ana, 'enviarQuiz', r.intentoId, resp2);
  ok(fin2.ok && fin2.total === 6 && fin2.puntaje === fin2.correctas * 10, 'pabellón corregido', fin2);
  x = await llamar(ana, 'iniciarQuiz', 'PAB-001', g.codigo);
  ok(!x.ok && x.motivo === 'YA_RESPONDIDO', 'un solo intento por pabellón', x);

  // Hoja Intentos
  const intentos = await hoja('Intentos');
  const filas = intentos.filter(f => f && f[1] === ana);
  ok(filas.length === 2 && filas.some(f => f[2] === 'PAB-001') && filas.some(f => f[2] === 'PAB-000'), 'Intentos: una fila por unidad con unidad_id', filas.map(f => f.slice(0, 5)));
  const orden = Math.min(...filas.map(f => intentos.indexOf(f))) + 1;
  ok(orden >= 2, 'fila dentro del bloque de la persona', orden);

  mapa = await llamar(ana, 'obtenerMapa');
  const p1b = mapa.pabellones.find(p => p.id === 'PAB-001');
  ok(p1b.estado === 'COMPLETADO' && mapa.puntos === fin.puntaje + fin2.puntaje, 'mapa: pabellón completo y puntos sumados', { estado: p1b.estado, puntos: mapa.puntos });

  // Expositor
  let banco = await llamar(expo, 'obtenerBancoPreguntas');
  ok(banco.stands.length === 1 && banco.stands[0].id === 'STD-001' && banco.stands[0].maximo === 10, 'expositor: solo STD-001 con máximo 10', banco.stands);
  const nueva = { standId: 'STD-001', texto: 'Nueva', opciones: ['a', 'b', 'c', 'd'], correcta: 'A' };
  x = await intenta(expo, 'guardarPreguntaLider', nueva);
  ok(x.error && /10 preguntas activas/.test(x.error), 'expositor no puede pasar de 10 preguntas', x);
  const una = banco.preguntas[0];
  x = await intenta(expo, 'guardarPreguntaLider', { id: una.id, standId: 'STD-001', texto: 'Editada', opciones: una.opciones, correcta: una.correcta });
  ok(x.valor && x.valor.preguntas.find(p => p.id === una.id).texto === 'Editada', 'expositor edita una pregunta existente');
  x = await intenta(expo, 'guardarPreguntaLider', Object.assign({}, nueva, { standId: 'STD-004' }));
  ok(x.error, 'expositor no escribe en un stand ajeno', x);
  x = await intenta(lider, 'obtenerBancoPreguntas');
  ok(x.error, 'líder de pabellón no tiene vista PREGUNTAS', x);

  // Validador
  const vq = await llamar(val, 'verQuiz', 'PAB-001');
  ok(vq.ok && vq.preguntas.length === 30 && vq.porQuiz === 6, 'validador ve las 30 preguntas del pabellón (hace 6)', { n: vq.preguntas && vq.preguntas.length, porQuiz: vq.porQuiz });
  x = await llamar(val, 'iniciarQuiz', 'PAB-001', '');
  ok(!x.ok, 'validador no responde', x);

  // Admin: catálogo, avance y ranking
  const cat = await llamar(admin, 'obtenerAdminCatalogo');
  ok(cat.charlas.length === 5 && cat.avance.preguntas['CHA-001'].necesita === 15 && cat.avance.preguntas['STD-001'].necesita === 10, 'panel: charlas y avance de preguntas', cat.avance.preguntas['CHA-001']);
  ok(cat.avance.sinResponsable.stands.includes('STD-002') && !cat.avance.sinResponsable.stands.includes('STD-001'), 'panel: stands sin expositor', cat.avance.sinResponsable.stands.slice(0, 3));
  const rk = await llamar(admin, 'obtenerRanking', true);
  ok(rk.filas.length >= 1, 'ranking calculado', rk.filas.length);

  console.log(fallos ? '\n' + fallos + ' FALLAS' : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(2); });
