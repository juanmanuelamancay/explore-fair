// Lotes de preguntas: todo o nada, reintento sin duplicar y marca NO_GUARDADO. node lote-preguntas.js [puerto]
// Usa el admin (sin tope) en el taller CHA-003 para crear preguntas nuevas, y un expositor para ver el tope.
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

(async () => {
  const admin = 'admin.prueba@bbva.com';
  const sello = Date.now().toString(36);
  const nueva = (texto, correcta = 'A') => ({ standId: 'CHA-003', texto: texto + ' ' + sello, opciones: ['a', 'b', 'c', 'd'], correcta });
  const contar = (banco, texto) => banco.preguntas.filter(p => p.texto === texto + ' ' + sello).length;

  // 1) Un lote con idLote se escribe una vez; el reintento con el mismo id no duplica nada
  const idLote = 'prueba-' + sello;
  const primero = await intenta(admin, 'guardarPreguntasLider', [nueva('Lote uno'), nueva('Lote dos', 'B')], idLote);
  ok(!primero.error && primero.valor.creadas.length === 2 && primero.valor.repetido === false, 'lote de 2 nuevas se guarda', primero.error || primero.valor && primero.valor.creadas);
  const reintento = await intenta(admin, 'guardarPreguntasLider', [nueva('Lote uno'), nueva('Lote dos', 'B')], idLote);
  ok(!reintento.error && reintento.valor.repetido === true, 'el reintento con el mismo idLote se reconoce', reintento.error || reintento.valor && reintento.valor.repetido);
  ok(reintento.valor && JSON.stringify(reintento.valor.creadas) === JSON.stringify(primero.valor.creadas), 'el reintento devuelve las mismas creadas', reintento.valor && reintento.valor.creadas);
  const banco = (await llamar(admin, 'obtenerBancoPreguntas'));
  ok(contar(banco, 'Lote uno') === 1 && contar(banco, 'Lote dos') === 1, 'no hay duplicados tras el reintento', { uno: contar(banco, 'Lote uno'), dos: contar(banco, 'Lote dos') });

  // 2) Sin idLote no hay reintento seguro: cada llamada escribe (comportamiento de siempre)
  const sinId = await intenta(admin, 'guardarPreguntasLider', [nueva('Sin id')]);
  const sinId2 = await intenta(admin, 'guardarPreguntasLider', [nueva('Sin id')]);
  ok(!sinId.error && !sinId2.error && sinId.valor.creadas[0] !== sinId2.valor.creadas[0], 'sin idLote, cada llamada crea su pregunta');

  // 3) Un lote con una inválida no escribe nada y el error viene con la marca NO_GUARDADO
  const antes = (await llamar(admin, 'obtenerBancoPreguntas')).preguntas.length;
  const malo = await intenta(admin, 'guardarPreguntasLider', [nueva('Buena'), { standId: 'CHA-003', texto: '', opciones: ['a', 'b', 'c', 'd'], correcta: 'A' }], 'prueba-malo-' + sello);
  ok(!!malo.error && malo.error.indexOf('NO_GUARDADO|') >= 0, 'lote con inválida: error marcado NO_GUARDADO', malo.error);
  const despues = (await llamar(admin, 'obtenerBancoPreguntas')).preguntas.length;
  ok(despues === antes, 'lote con inválida: no se escribió ninguna', { antes, despues });

  // 4) Permiso: rechazo marcado NO_GUARDADO (nada se escribió)
  const sinPermiso = await intenta('validador.prueba@bbva.com', 'guardarPreguntasLider', [nueva('X')], 'prueba-perm-' + sello);
  ok(!!sinPermiso.error && sinPermiso.error.indexOf('NO_GUARDADO|') === 0, 'sin permiso: NO_GUARDADO', sinPermiso.error);

  // 5) Tope del expositor: el lote que lo pasa se rechaza completo y marcado NO_GUARDADO
  const expo = 'juanmanuel.amancay@bbva.com';
  const bancoExpo = await llamar(expo, 'obtenerBancoPreguntas');
  const activas = bancoExpo.preguntas.filter(p => p.standId === 'CHA-003' && p.activo).length;
  const maximo = bancoExpo.stands.find(s => s.id === 'CHA-003').maximo;
  const demasiadas = Array.from({ length: Math.max(1, maximo - activas + 1) }, (_, i) => nueva('Tope ' + i));
  const tope = await intenta(expo, 'guardarPreguntasLider', demasiadas, 'prueba-tope-' + sello);
  ok(!!tope.error && /NO_GUARDADO\|.*preguntas activas/.test(tope.error), 'tope: lote rechazado completo y marcado', tope.error);

  // 6) Una edición repetida con el mismo idLote no cambia nada (es idempotente por naturaleza)
  const editable = bancoExpo.preguntas.find(p => p.standId === 'STD-019' || p.standId === 'CHA-003');
  const edicion = { id: editable.id, standId: editable.standId, texto: 'Editada en prueba ' + sello, opciones: editable.opciones, correcta: editable.correcta };
  const e1 = await intenta(expo, 'guardarPreguntasLider', [edicion], 'prueba-edit-' + sello);
  const e2 = await intenta(expo, 'guardarPreguntasLider', [edicion], 'prueba-edit-' + sello);
  ok(!e1.error && !e2.error && e2.valor.repetido === true, 'edición repetida: segundo envío reconocido', e1.error || e2.error);

  console.log(fallos ? fallos + ' fallos' : 'TODO OK');
  process.exitCode = fallos ? 1 : 0;
})();
