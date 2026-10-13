// Prueba de la semana de charlas contra el simulador con CHARLAS=1 y RANKING=0. node t2.js [puerto]
const PUERTO = process.argv[2] || '8134';
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
  const ana = 'ana.torres@demo.com', pon = 'ponente.uno@demo.com', admin = 'admin@demo.com', val = 'validador@demo.com';

  const acceso = await llamar(ana, 'obtenerAcceso');
  ok(acceso.vistas.includes('CHARLAS') && acceso.vistas.includes('QUIZ') && !acceso.vistas.includes('MAPA'), 'usuario en semana de charlas: CHARLAS y QUIZ, sin MAPA', acceso.vistas);
  let x = await intenta(ana, 'obtenerMapa');
  ok(x.error, 'sin MAPA no hay mapa', x);

  let ch = await llamar(ana, 'obtenerCharlas');
  ok(ch.charlas.length === 5 && ch.charlas[0].id === 'CHA-001', 'ruta: 5 charlas ordenadas por inicio', ch.charlas.map(c => c.id));
  ok(ch.charlas[0].empezo && ch.charlas[1].empezo && !ch.charlas[2].empezo, 'ruta: las dos primeras ya empezaron, la tercera no', ch.charlas.map(c => c.empezo));
  ok(ch.charlas[0].numPreguntas === 5 && ch.charlas[0].puntosMax === 50 && ch.charlas[0].ponente === 'Rosa Quiroz', 'charla: 5 preguntas, hasta 50 pts, ponente', ch.charlas[0]);

  let r = await llamar(ana, 'iniciarQuiz', 'CHA-003', 'ZZZZ');
  ok(!r.ok && r.motivo === 'AUN_NO' && r.empiezaEn > Date.now(), 'una charla futura no se abre', r);
  x = await intenta(ana, 'iniciarQuiz', 'PAB-001', 'ZZZZ');
  ok(x.error && /permiso/.test(x.error), 'en semana de charlas no se abre un pabellón (sin vista MAPA)', x);

  // Ponente
  let cod = await llamar(pon, 'obtenerCodigos');
  ok(cod.unidades.length === 1 && cod.unidades[0].id === 'CHA-001' && cod.unidades[0].grupo === 'Charla', 'ponente: solo ve su charla', cod.unidades);
  x = await intenta(pon, 'generarCodigo', 'CHA-002');
  ok(x.error, 'ponente no genera el código de otra charla', x);
  const g = await llamar(pon, 'generarCodigo', 'CHA-001');
  ok(/^[A-Z0-9]{4}$/.test(g.codigo), 'ponente genera el código de su charla', g);
  const banco = await llamar(pon, 'obtenerBancoPreguntas');
  ok(banco.stands.length === 1 && banco.stands[0].id === 'CHA-001' && banco.stands[0].maximo === 15 && banco.preguntas.length === 15, 'ponente: su banco de 15', banco.stands);
  x = await intenta(pon, 'guardarPreguntaLider', { standId: 'CHA-001', texto: 'N', opciones: ['a', 'b', 'c', 'd'], correcta: 'B' });
  ok(x.error && /15 preguntas activas/.test(x.error), 'ponente no pasa de 15', x);

  // Respuesta de la charla (sin quiz de entrada)
  r = await llamar(ana, 'iniciarQuiz', 'CHA-001', 'ZZZZ');
  ok(!r.ok && r.motivo === 'CODIGO', 'código de charla incorrecto', r);
  r = await llamar(ana, 'iniciarQuiz', 'CHA-001', g.codigo);
  ok(r.ok && r.preguntas.length === 5, 'charla: 5 preguntas sin pasar por el quiz de entrada', r.ok ? r.preguntas.length : r);
  const resp = {}; r.preguntas.forEach(q => { resp[q.id] = 'A'; });
  const fin = await llamar(ana, 'enviarQuiz', r.intentoId, resp);
  ok(fin.ok && fin.total === 5 && fin.puntaje === fin.correctas * 10, 'charla corregida', fin);
  ch = await llamar(ana, 'obtenerCharlas');
  ok(ch.charlas[0].estado === 'COMPLETADO' && ch.puntos === fin.puntaje, 'ruta: charla completada y puntos sumados', { e: ch.charlas[0].estado, p: ch.puntos });
  const intentos = await hoja('Intentos');
  const fila = intentos.find(f => f && f[1] === ana);
  ok(fila && fila[2] === 'CHA-001' && fila[7] === '', 'Intentos: unidad_id CHA-001 y pabellon_id vacío', fila && fila.slice(0, 8));
  x = await llamar(ana, 'iniciarQuiz', 'CHA-001', g.codigo);
  ok(!x.ok && x.motivo === 'YA_RESPONDIDO', 'un solo intento por charla', x);

  // Admin: ranking suma charla
  const rk = await llamar(admin, 'obtenerRanking', true);
  ok(rk.filas.length === 1 && rk.filas[0].puntos === fin.puntaje, 'ranking incluye los puntos de la charla', rk.filas);
  // Validador ve la ruta y las preguntas
  const vr = await llamar(val, 'obtenerCharlas');
  ok(vr.soloLectura && vr.charlas.length === 5, 'validador ve la ruta en solo lectura');
  const vq = await llamar(val, 'verQuiz', 'CHA-001');
  ok(vq.ok && vq.preguntas.length === 15 && vq.porQuiz === 5, 'validador ve las 15 preguntas de la charla', { n: vq.preguntas && vq.preguntas.length });

  // Panel: crear una charla con ponente, un stand con expositor y un pabellón con líder
  let cat = await llamar(admin, 'obtenerAdminCatalogo');
  x = await intenta(admin, 'guardarAdminRegistro', 'charlas', { titulo: 'Charla nueva', ponente: 'Pepe', inicio: '2026-10-21 18:00', fin: '2026-10-21 19:00', orden: 9, activo: true, ponente_email: 'nuevo.ponente@demo.com' });
  ok(x.valor && x.valor.charlas.some(c => c.titulo === 'Charla nueva' && c.charla_id === 'CHA-006'), 'panel: crea la charla CHA-006', x.error || x.valor.charlas.length);
  const staff = await hoja('Staff');
  const fp = staff.find(f => f && f[0] === 'nuevo.ponente@demo.com');
  ok(fp && fp[2] === 'PONENTE' && fp[5] === 'CHA-006', 'panel: el ponente queda en Staff con su charla', fp);
  x = await intenta(admin, 'guardarAdminRegistro', 'charlas', { titulo: 'Sin hora', inicio: 'mañana', orden: 1, activo: true });
  ok(x.error && /fecha/.test(x.error), 'panel: rechaza una fecha inválida', x);
  x = await intenta(admin, 'guardarAdminRegistro', 'charlas', { titulo: 'Otra', inicio: '2026-10-21 20:00', orden: 1, activo: true, ponente_email: 'ponente.uno@demo.com' });
  ok(x.error && /ya es ponente/.test(x.error), 'panel: un ponente no puede tener dos charlas', x);
  x = await intenta(admin, 'guardarAdminRegistro', 'stands', { pabellon_id: 'PAB-002', nombre: 'Stand nuevo', orden: 99, activo: true, expositor_email: 'nuevo.expositor@demo.com' });
  const stNuevo = x.valor && x.valor.stands.find(s => s.nombre === 'Stand nuevo');
  const staff2 = await hoja('Staff');
  const fe = staff2.find(f => f && f[0] === 'nuevo.expositor@demo.com');
  ok(stNuevo && fe && fe[2] === 'EXPOSITOR' && fe[3] === 'PAB-002' && fe[4] === stNuevo.stand_id && fe[5] === '', 'panel: el expositor queda con pabellón y stand', fe);
  x = await intenta(admin, 'guardarAdminRegistro', 'pabellones', { nombre: 'Pab nuevo', requiere_codigo: true, orden: 99, activo: true, lider_email: 'nuevo.lider@demo.com' });
  const pbNuevo = x.valor && x.valor.pabellones.find(p => p.nombre === 'Pab nuevo');
  const fl = (await hoja('Staff')).find(f => f && f[0] === 'nuevo.lider@demo.com');
  ok(pbNuevo && fl && fl[2] === 'LIDER' && fl[3] === pbNuevo.pabellon_id && fl[4] === '', 'panel: el líder queda con su pabellón', fl);
  x = await intenta(admin, 'guardarAdminRegistro', 'pabellones', { nombre: 'Otro sin código', requiere_codigo: false, orden: 100, activo: true });
  ok(x.error && /sin código/.test(x.error), 'panel: solo un pabellón sin código', x);
  // Importar JSON de preguntas a una charla
  const jsonPreg = [{ texto: 'P', opcion_a: 'a', opcion_b: 'b', opcion_c: 'c', opcion_d: 'd', correcta: 'A', puntos: 10, activo: true }];
  x = await intenta(admin, 'importarPreguntasAdmin', 'CHA-006', jsonPreg);
  ok(x.valor && x.valor.importadas === 1 && x.valor.stand_id === 'CHA-006', 'panel: importa preguntas a una charla', x.error);
  cat = await llamar(admin, 'obtenerAdminCatalogo');
  x = await intenta(admin, 'borrarAdminRegistro', 'charlas', cat.charlas.find(c => c.charla_id === 'CHA-006')._fila);
  ok(x.error && /preguntas activas/.test(x.error), 'panel: no desactiva una charla con preguntas activas', x);

  console.log(fallos ? '\n' + fallos + ' FALLAS' : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(2); });
