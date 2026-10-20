/**
 * Diagnóstico de las charlas y talleres. Se ejecuta a mano desde el editor de Apps Script: elegir "validarCharlas"
 * en el selector de funciones, pulsar Ejecutar y leer el registro. Solo lee: no escribe en ninguna hoja ni en la caché.
 * Cada línea sale como OK, AVISO (no impide la semana de charlas) o FALLA (impide preparar o responder esa charla).
 */

function validarCharlas() {
  exigirAdmin_();
  const informe = [];
  const anotar = (nivel, titulo, detalle) => informe.push({ nivel: nivel, titulo: titulo, detalle: detalle || '' });
  const ok = (titulo, detalle) => anotar('OK', titulo, detalle);
  const aviso = (titulo, detalle) => anotar('AVISO', titulo, detalle);
  const falla = (titulo, detalle) => anotar('FALLA', titulo, detalle);

  // 1. Hojas y columnas que usan las charlas.
  // Mismas columnas que de verdad lee o escribe el código (quiz.gs, indice.gs, datos.gs): una lista corta
  // aquí no detecta la falla hasta que alguien ya está respondiendo (vence_en o puntaje en blanco, por ejemplo).
  const requeridas = {
    Charlas: ['charla_id', 'titulo', 'ponente', 'descripcion', 'inicio', 'fin', 'cierre', 'preguntas_banco', 'preguntas_quiz', 'orden', 'activo'],
    Preguntas: ['pregunta_id', 'stand_id', 'texto', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'correcta', 'puntos', 'activo'],
    Staff: ['email', 'rol', 'charla_id', 'activo'],
    Permisos: ['rol', 'vista', 'activo'],
    Codigos: ['codigo', 'unidad_id', 'estado', 'expira_en'],
    Intentos: ['intento_id', 'email', 'unidad_id', 'pabellon_id', 'codigo', 'preguntas_json', 'iniciado_en', 'vence_en', 'estado', 'respuestas_json', 'correctas', 'puntaje', 'completado_en'],
    Config: ['clave', 'valor'],
    Usuarios: ['email', 'orden'],
  };
  Object.keys(requeridas).forEach(nombre => {
    const hoja = hojaSiExiste_(nombre);
    if (!hoja) return falla('Hoja ' + nombre, 'no existe una pestaña con ese nombre exacto');
    const encabezados = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0].map(normal_);
    const faltan = requeridas[nombre].filter(c => encabezados.indexOf(c) < 0);
    if (faltan.length) falla('Hoja ' + nombre, 'faltan columnas: ' + faltan.join(', '));
    else ok('Hoja ' + nombre, 'columnas correctas');
  });

  // 2. Catálogo tal como lo lee la app, sin caché.
  let catalogo = null;
  try {
    catalogo = leerCatalogo_();
  } catch (error) {
    falla('Catálogo', error.message);
    return imprimirInformeCharlas_(informe);
  }
  if (catalogo.config.espera_activa) aviso('Config espera_activa', 'TRUE: con la sala de espera activa los usuarios no pueden responder charlas. Ponla en FALSE durante la semana de charlas.');
  else ok('Config espera_activa', 'FALSE');

  // Sin minutos para responder, el quiz vence en el mismo instante en que empieza (venceEn = ahora, quiz.gs).
  if (!(catalogo.config.minutos_para_responder > 0)) falla('Config minutos_para_responder', 'vale ' + catalogo.config.minutos_para_responder + ': el quiz vence apenas empieza, nadie puede responder a tiempo');
  else ok('Config minutos_para_responder', catalogo.config.minutos_para_responder + ' minutos');

  // Las charlas siempre piden código (datos.gs: requiereCodigo = true). Sin minutos de vigencia, el código
  // generado por el ponente expira al instante y nadie puede entrar a su quiz.
  if (!(catalogo.config.minutos_vigencia_codigo > 0)) falla('Config minutos_vigencia_codigo', 'vale ' + catalogo.config.minutos_vigencia_codigo + ': el código de la charla expira al generarse, nadie puede entrar con él');
  else ok('Config minutos_vigencia_codigo', catalogo.config.minutos_vigencia_codigo + ' minutos');

  // 3. Charlas activas y lo que necesita cada una.
  const filasCharlas = hojaSiExiste_(HOJA.CHARLAS) ? leerHoja_(HOJA.CHARLAS) : [];
  const charlas = filasCharlas.filter(c => esVerdadero_(c.activo));
  const unidadesCharla = catalogo.unidades.filter(u => u.tipo === 'CHARLA');
  if (!charlas.length) {
    falla('Charlas activas', 'ninguna fila de Charlas tiene activo = TRUE');
    return imprimirInformeCharlas_(informe);
  }
  ok('Charlas activas', unidadesCharla.length + ': ' + unidadesCharla.map(u => u.id).join(', '));

  const preguntas = leerHoja_(HOJA.PREGUNTAS);
  const activas = preguntas.filter(p => esVerdadero_(p.activo));
  const idsCharla = {};
  unidadesCharla.forEach(u => { idsCharla[u.id] = true; });
  const idsStand = {};
  catalogo.stands.forEach(s => { idsStand[s.id] = true; });

  // Codigos se lee sin leerHoja_: sus filas recién creadas solo traen unidad_id, y leerHoja_ descarta filas sin codigo.
  const idsConFila = {};
  const hojaCodigos = hoja_(HOJA.CODIGOS);
  const ultimaCodigos = hojaCodigos.getLastRow();
  const colUnidad = encabezados_(HOJA.CODIGOS).indexOf('unidad_id') + 1;
  if (ultimaCodigos > 1 && colUnidad > 0) {
    hojaCodigos.getRange(2, colUnidad, ultimaCodigos - 1, 1).getValues().forEach(v => { idsConFila[id_(v[0])] = true; });
  }

  const valida = p => !!texto_(p.texto) && /^[ABCD]$/.test(texto_(p.correcta).toUpperCase()) &&
    [p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d].every(o => !!texto_(o));

  const vistos = {};
  charlas.forEach(c => {
    const id = id_(c.charla_id);
    const titulo = 'Charla ' + (id || '(sin charla_id)') + (texto_(c.titulo) ? ' · ' + texto_(c.titulo) : '');
    if (!id) return falla(titulo, 'la fila no tiene charla_id');
    if (vistos[id]) falla(titulo, 'charla_id repetido: la app usa solo una de las filas');
    vistos[id] = true;
    const unidad = unidadesCharla.find(u => u.id === id);
    if (!unidad) return falla(titulo, 'la app no la reconoce como charla');

    // Fechas: inicio y cierre (la hora límite para responder).
    const inicio = fechaEnMs_(c.inicio), cierre = fechaEnMs_(c.cierre);
    if (texto_(c.inicio) && !inicio) falla(titulo, 'inicio no se entiende: "' + texto_(c.inicio) + '" (usa 2026-10-19 16:00)');
    else if (!inicio) aviso(titulo, 'sin inicio: se ve abierta desde ya');
    if (texto_(c.cierre) && !cierre) falla(titulo, 'cierre no se entiende: "' + texto_(c.cierre) + '"');
    else if (!cierre) aviso(titulo, 'sin cierre: el quiz y los códigos nunca se cierran');
    else if (inicio && cierre <= inicio) falla(titulo, 'cierre anterior o igual al inicio: nadie puede empezar el quiz');
    else if (Date.now() > cierre) aviso(titulo, 'la hora de cierre ya pasó: nadie puede empezar el quiz');

    // Ponente: sin PONENTE activo nadie puede generar el código de la charla (el admin sí).
    const ponentes = catalogo.staff.filter(s => s.rol === 'PONENTE' && s.charlaId === id);
    if (!ponentes.length) aviso(titulo + ' · ponente', 'ningún PONENTE activo en Staff: nadie puede generar su código (el admin sí)');
    else ok(titulo + ' · ponente', ponentes.map(s => s.email).join(', '));

    // Banco: el quiz no se abre si tiene menos preguntas activas que las que necesita.
    const banco = unidad.bancos[0];
    const necesita = Math.max(banco.minimo, banco.cuantas);
    const delBanco = activas.filter(p => id_(p.stand_id) === id);
    if (delBanco.length < necesita) falla(titulo + ' · preguntas', 'tiene ' + delBanco.length + ' activas en Preguntas (stand_id = ' + id + ') y necesita ' + necesita + ': el quiz no se abre');
    else ok(titulo + ' · preguntas', delBanco.length + ' activas, se sortean ' + banco.cuantas);
    const malas = delBanco.filter(p => !valida(p)).map(p => texto_(p.pregunta_id) || '(sin id)');
    if (malas.length) falla(titulo + ' · preguntas', 'incompletas o con "correcta" distinta de A, B, C o D: ' + malas.join(', '));

    if (!idsConFila[id]) aviso(titulo + ' · código', 'sin fila en Codigos: prepararCodigos() la crea (la app también la crea al generar)');
  });

  // 4. Preguntas: IDs repetidos y bancos que no existen.
  const idsPregunta = preguntas.map(p => id_(p.pregunta_id)).filter(Boolean);
  const repetidos = [...new Set(idsPregunta.filter((x, i) => idsPregunta.indexOf(x) !== i))];
  if (repetidos.length) falla('Preguntas · pregunta_id', 'repetidos: ' + repetidos.slice(0, 10).join(', '));
  else ok('Preguntas · pregunta_id', 'sin repetidos');

  const huerfanas = activas.filter(p => !idsCharla[id_(p.stand_id)] && !idsStand[id_(p.stand_id)]);
  if (huerfanas.length) aviso('Preguntas sin stand ni charla', huerfanas.length + ' activas apuntan a un ID que no existe (revisa typos, por ejemplo CHA-1): ' + [...new Set(huerfanas.map(p => id_(p.stand_id)))].slice(0, 10).join(', '));

  // 5. Permisos: quién ve y hace qué con las charlas.
  const permisos = leerHoja_(HOJA.PERMISOS).filter(p => esVerdadero_(p.activo)).map(p => texto_(p.rol).toUpperCase() + ' ' + texto_(p.vista).toUpperCase());
  const tiene = (rol, vista) => permisos.indexOf(rol + ' ' + vista) >= 0;
  if (tiene('USUARIO', 'QUIZ')) ok('Permisos · USUARIO QUIZ', 'activo');
  else falla('Permisos · USUARIO QUIZ', 'falta: los asistentes no pueden responder ningún quiz');
  if (tiene('USUARIO', 'CHARLAS')) ok('Permisos · USUARIO CHARLAS', 'activo');
  else aviso('Permisos · USUARIO CHARLAS', 'falta: los asistentes no ven la ruta de charlas (correcto si ya es la semana del evento)');
  const hayPonentes = catalogo.staff.some(s => s.rol === 'PONENTE');
  const faltanPonente = ['GENERAR_CODIGO', 'PREGUNTAS'].filter(v => !tiene('PONENTE', v));
  if (!faltanPonente.length) ok('Permisos · PONENTE', 'GENERAR_CODIGO y PREGUNTAS activos');
  else if (hayPonentes) falla('Permisos · PONENTE', 'faltan: ' + faltanPonente.join(', ') + ' (hay ponentes en Staff)');
  else aviso('Permisos · PONENTE', 'faltan: ' + faltanPonente.join(', ') + ' (todavía no hay ponentes en Staff)');
  if (!tiene('ADMIN', 'CHARLAS')) aviso('Permisos · ADMIN CHARLAS', 'falta: el admin no ve la ruta de charlas');

  // 6. Staff: ponentes que no apuntan a una charla activa.
  const ponenteSinCharla = catalogo.staff.filter(s => s.rol === 'PONENTE' && !idsCharla[s.charlaId]);
  if (ponenteSinCharla.length) aviso('Staff · PONENTE', 'filas que no apuntan a una charla activa: ' + ponenteSinCharla.map(s => s.email).join(', '));

  // 7. Intentos y filas por persona: lo que impide volver a ejecutar prepararFeria.
  const usados = filasConDato_(HOJA.INTENTOS);
  if (usados) aviso('Intentos', usados + ' filas con dato. prepararFeria no se puede ejecutar: normal si la feria ya empezó; si no, reinicia los datos desde el panel.');
  else ok('Intentos', 'vacía: prepararFeria se puede ejecutar');

  const entrada = catalogo.unidades.filter(u => u.tipo === 'PABELLON' && !u.requiereCodigo).length;
  const conCodigo = catalogo.unidades.filter(u => u.tipo === 'PABELLON' && u.requiereCodigo).length;
  const total = entrada + conCodigo + unidadesCharla.length;
  if (total > FILAS_POR_PERSONA) falla('Filas por persona', total + ' unidades y FILAS_POR_PERSONA = ' + FILAS_POR_PERSONA + ': quien llegue al límite no podrá responder más');
  else ok('Filas por persona', total + ' unidades de ' + FILAS_POR_PERSONA + ' filas');

  return imprimirInformeCharlas_(informe);
}

/** Escribe el informe de validarCharlas en el registro: FALLA como error, AVISO como aviso, OK como texto normal. */
function imprimirInformeCharlas_(informe) {
  console.log('===== Validación de charlas =====');
  informe.forEach(i => {
    const linea = i.nivel + '  ' + i.titulo + (i.detalle ? ' -> ' + i.detalle : '');
    if (i.nivel === 'FALLA') console.error(linea);
    else if (i.nivel === 'AVISO') console.warn(linea);
    else console.log(linea);
  });
  const fallas = informe.filter(i => i.nivel === 'FALLA').length;
  const avisos = informe.filter(i => i.nivel === 'AVISO').length;
  console.log('===== ' + (fallas ? fallas + ' fallas que corregir' : 'Sin fallas') + ' · ' + avisos + ' avisos =====');
  return { fallas: fallas, avisos: avisos };
}
