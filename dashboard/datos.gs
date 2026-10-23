/** Lee las hojas una sola vez por ejecución y arma las cifras base que usan todos los gráficos. */
let DASH_MEMO_ = null;

function dashDatos_() {
  if (DASH_MEMO_) return DASH_MEMO_;
  const ahora = Date.now();
  const excluido = email => DASH_CONFIG.EXCLUIR_EMAIL.test(email);

  const pabellones = {};
  dashLeer_('Pabellones').filter(p => dashSi_(p.activo)).forEach(p => {
    const id = dashTexto_(p.pabellon_id);
    pabellones[id] = {
      id,
      nombre: dashTexto_(p.nombre_corto) || dashTexto_(p.nombre),
      entrada: dashTexto_(p.requiere_codigo).toUpperCase() === 'FALSE',
    };
  });

  const charlas = {};
  dashLeer_('Charlas').filter(c => dashSi_(c.activo)).forEach(c => {
    const id = dashTexto_(c.charla_id);
    charlas[id] = { id, titulo: dashTexto_(c.titulo) };
  });

  const stands = {};
  dashLeer_('Stands').forEach(s => {
    const id = dashTexto_(s.stand_id);
    stands[id] = {
      id,
      nombre: dashTexto_(s.nombre),
      pabellon: dashTexto_(s.pabellon_id),
      activa: dashSi_(s.activo),
    };
  });

  const preguntas = {};
  dashLeer_('Preguntas').forEach(p => {
    const id = dashTexto_(p.pregunta_id);
    preguntas[id] = {
      id,
      texto: dashTexto_(p.texto),
      stand: dashTexto_(p.stand_id),
      activa: dashSi_(p.activo),
    };
  });

  const nombres = {};
  const usuarios = [];
  dashLeer_('Usuarios').forEach(u => {
    const email = dashTexto_(u.email).toLowerCase();
    if (!email || excluido(email)) return;
    nombres[email] = dashTexto_(u.nombre);
    usuarios.push({ email, registro: dashMs_(u.registrado_en) });
  });

  const intentos = dashLeer_('Intentos').map(i => {
    const unidad = dashTexto_(i.unidad_id);
    return {
      email: dashTexto_(i.email).toLowerCase(),
      unidad,
      tipo: unidad.indexOf('CHA-') === 0 ? 'charla' : 'pabellon',
      estado: dashEstado_(i, ahora),
      puntaje: Number(i.puntaje) || 0,
      inicio: dashMs_(i.iniciado_en),
      fin: dashMs_(i.completado_en),
      respuestas: dashJson_(i.respuestas_json),
    };
  }).filter(i => i.email && i.unidad && !excluido(i.email));

  DASH_MEMO_ = { ahora, pabellones, charlas, stands, preguntas, nombres, usuarios, intentos };
  return DASH_MEMO_;
}

/** Un EN_CURSO con el plazo vencido cuenta como VENCIDO: la app no lo escribe en la hoja. */
function dashEstado_(fila, ahora) {
  const estado = dashTexto_(fila.estado).toUpperCase();
  const vence = dashMs_(fila.vence_en);
  return estado === 'EN_CURSO' && vence && vence < ahora ? 'VENCIDO' : estado;
}

function dashIntentosPabellon_(d) {
  return d.intentos.filter(i => i.tipo === 'pabellon' && !(d.pabellones[i.unidad] && d.pabellones[i.unidad].entrada));
}

function dashIntentosCharla_(d) {
  return d.intentos.filter(i => i.tipo === 'charla');
}

function dashHora_(ms) { return Number(Utilities.formatDate(new Date(ms), DASH_CONFIG.ZONA, 'H')); }

function dashDia_(ms) { return Utilities.formatDate(new Date(ms), DASH_CONFIG.ZONA, 'yyyy-MM-dd'); }
