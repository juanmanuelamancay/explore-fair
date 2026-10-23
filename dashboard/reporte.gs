/** Entrega una instantánea anónima para que los filtros se resuelvan en el navegador. */
function reporteObtener() {
  const d = dashDatos_();
  const idsPersona = Object.create(null);
  let siguienteId = 0;
  const idPersona = email => {
    if (!idsPersona[email]) idsPersona[email] = 'P' + (++siguienteId);
    return idsPersona[email];
  };

  d.usuarios.forEach(u => idPersona(u.email));
  d.intentos.forEach(i => idPersona(i.email));

  return {
    unidades: {
      pabellones: Object.values(d.pabellones).map(p => ({ id: p.id, nombre: p.nombre, entrada: p.entrada })),
      charlas: Object.values(d.charlas).map(c => ({ id: c.id, nombre: c.titulo })),
    },
    personas: d.usuarios.map(u => ({
      id: idPersona(u.email),
      nombre: d.nombres[u.email] || 'Participante',
      dia: u.registro ? dashDia_(u.registro) : '',
      hora: u.registro ? Math.floor(u.registro / 3600000) * 3600000 : 0,
      horaEtiqueta: u.registro ? Utilities.formatDate(new Date(Math.floor(u.registro / 3600000) * 3600000), DASH_CONFIG.ZONA, 'dd/MM HH:mm') : '',
    })),
    pabellones: Object.values(d.pabellones),
    charlas: Object.values(d.charlas),
    stands: Object.values(d.stands),
    preguntas: Object.values(d.preguntas),
    intentos: d.intentos.map(i => {
      const hora = i.inicio ? Math.floor(i.inicio / 3600000) * 3600000 : 0;
      return {
        persona: idPersona(i.email),
        unidad: i.unidad,
        tipo: i.tipo,
        estado: i.estado,
        puntaje: i.puntaje,
        inicio: i.inicio,
        dia: i.inicio ? dashDia_(i.inicio) : '',
        hora,
        horaEtiqueta: hora ? Utilities.formatDate(new Date(hora), DASH_CONFIG.ZONA, 'dd/MM HH:mm') : '',
        fin: i.fin,
        respuestas: i.respuestas.map(r => ({ p: dashTexto_(r.p), ok: r.ok === true || String(r.ok).toUpperCase() === 'TRUE' })),
      };
    }),
    minimoPregunta: DASH_CONFIG.MIN_RESPUESTAS_PREGUNTA,
  };
}

function dashReporteFiltros_(filtros) {
  const f = filtros || {};
  return {
    desde: dashTexto_(f.desde),
    hasta: dashTexto_(f.hasta),
    desdeMs: dashReporteLimite_(f.desde, false),
    hastaMs: dashReporteLimite_(f.hasta, true),
    tipo: ['PABELLON', 'CHARLA'].indexOf(String(f.tipo || '').toUpperCase()) >= 0 ? String(f.tipo).toUpperCase() : 'TODOS',
    unidad: dashTexto_(f.unidad),
  };
}

function dashReporteLimite_(fecha, siguienteDia) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''));
  if (!partes) return 0;
  const fechaUtc = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]) + (siguienteDia ? 1 : 0)));
  const clave = [fechaUtc.getUTCFullYear(), String(fechaUtc.getUTCMonth() + 1).padStart(2, '0'), String(fechaUtc.getUTCDate()).padStart(2, '0')].join('-');
  return Utilities.parseDate(clave, DASH_CONFIG.ZONA, 'yyyy-MM-dd').getTime();
}

function dashReporteEnFecha_(ms, filtro) {
  if (!filtro.desdeMs && !filtro.hastaMs) return true;
  return Boolean(ms) && (!filtro.desdeMs || ms >= filtro.desdeMs) && (!filtro.hastaMs || ms < filtro.hastaMs);
}

function dashReporteEnUnidad_(intento, filtro) {
  const tipo = intento.tipo === 'pabellon' ? 'PABELLON' : 'CHARLA';
  return (filtro.tipo === 'TODOS' || filtro.tipo === tipo) && (!filtro.unidad || intento.unidad === filtro.unidad);
}

function dashReportePabellones_(d, intentos, filtro) {
  return Object.values(d.pabellones).filter(p => filtro.tipo !== 'CHARLA' && (!filtro.unidad || filtro.unidad === p.id)).map(p => {
    const filas = intentos.filter(i => i.tipo === 'pabellon' && i.unidad === p.id);
    return {
      id: p.id,
      nombre: p.entrada ? 'Entrada · ' + p.nombre : p.nombre,
      entrada: p.entrada,
      completados: filas.filter(i => i.estado === 'COMPLETADO').length,
      enCurso: filas.filter(i => i.estado === 'EN_CURSO').length,
      vencidos: filas.filter(i => i.estado === 'VENCIDO').length,
      intentos: filas.length,
    };
  }).sort((a, b) => Number(b.entrada) - Number(a.entrada) || b.intentos - a.intentos);
}

function dashReporteCharlas_(d, intentos, filtro) {
  return Object.values(d.charlas).filter(c => filtro.tipo !== 'PABELLON' && (!filtro.unidad || filtro.unidad === c.id)).map(c => {
    const filas = intentos.filter(i => i.tipo === 'charla' && i.unidad === c.id);
    const completados = filas.filter(i => i.estado === 'COMPLETADO');
    const totalPuntos = completados.reduce((s, i) => s + i.puntaje, 0);
    return {
      id: c.id,
      titulo: c.titulo,
      personas: new Set(filas.map(i => i.email)).size,
      completados: completados.length,
      promedio: completados.length ? Math.round(totalPuntos / completados.length * 10) / 10 : 0,
    };
  }).sort((a, b) => b.personas - a.personas);
}

function dashReporteStands_(d, intentos) {
  const stats = {};
  intentos.forEach(i => i.respuestas.forEach(r => {
    const pregunta = d.preguntas[dashTexto_(r.p)];
    const stand = pregunta && d.stands[pregunta.stand];
    if (!stand) return;
    const s = stats[stand.id] || (stats[stand.id] = {
      id: stand.id,
      nombre: stand.nombre,
      pabellon: (d.pabellones[stand.pabellon] || {}).nombre || '',
      respuestas: 0,
      aciertos: 0,
    });
    s.respuestas++;
    if (r.ok === true || String(r.ok).toUpperCase() === 'TRUE') s.aciertos++;
  }));
  return Object.values(stats).map(s => ({
    id: s.id,
    nombre: s.nombre,
    pabellon: s.pabellon,
    respuestas: s.respuestas,
    porcentaje: s.respuestas ? Math.round(s.aciertos / s.respuestas * 1000) / 10 : 0,
  })).sort((a, b) => a.porcentaje - b.porcentaje || b.respuestas - a.respuestas);
}

function dashReporteRecorrido_(d, usuarios, intentosPabellon, pabellones) {
  const inscritos = new Set(usuarios.map(u => u.email));
  const entrada = Object.values(d.pabellones).filter(p => p.entrada)[0];
  const porPersona = dashReporteCompletadosPorPersona_(intentosPabellon);
  const ids = pabellones.map(p => p.id);
  let completaronEntrada = 0;
  let alMenosUno = 0;
  let mitad = 0;
  let todos = 0;
  let fullExplorer = 0;
  inscritos.forEach(email => {
    const completados = porPersona[email] || new Set();
    const completoEntrada = entrada && completados.has(entrada.id);
    if (completoEntrada) completaronEntrada++;
    const cantidad = ids.filter(id => completados.has(id)).length;
    if (cantidad > 0 && completoEntrada) alMenosUno++;
    if (ids.length && cantidad >= Math.ceil(ids.length / 2) && completoEntrada) mitad++;
    if (ids.length && cantidad === ids.length) fullExplorer++;
    if (ids.length && cantidad === ids.length && completoEntrada) todos++;
  });
  return {
    pasos: [
      { etiqueta: 'Registrados', personas: usuarios.length },
      { etiqueta: 'Quiz de entrada', personas: completaronEntrada },
      { etiqueta: '1+ pabellones', personas: alMenosUno },
      { etiqueta: '50% o más', personas: mitad },
      { etiqueta: 'Todos los pabellones', personas: todos },
    ],
    totalPabellones: ids.length,
    completaronTodos: todos,
    fullExplorer,
  };
}

function dashReporteCompletadosPorPersona_(intentos) {
  const personas = {};
  intentos.filter(i => i.estado === 'COMPLETADO').forEach(i => {
    (personas[i.email] || (personas[i.email] = new Set())).add(i.unidad);
  });
  return personas;
}

function dashReportePreguntas_(d, intentos) {
  const stats = {};
  intentos.forEach(i => i.respuestas.forEach(r => {
    const id = dashTexto_(r.p);
    if (!id) return;
    const s = stats[id] || (stats[id] = { id, respuestas: 0, aciertos: 0 });
    s.respuestas++;
    if (r.ok === true || String(r.ok).toUpperCase() === 'TRUE') s.aciertos++;
  }));
  return Object.values(stats).map(s => {
    const pregunta = d.preguntas[s.id] || {};
    const stand = d.stands[pregunta.stand];
    const charla = d.charlas[pregunta.stand];
    return {
      id: s.id,
      texto: pregunta.texto || '(sin texto)',
      unidad: stand ? stand.nombre : (charla ? charla.titulo : ''),
      respuestas: s.respuestas,
      porcentaje: Math.round(s.aciertos / s.respuestas * 1000) / 10,
    };
  }).sort((a, b) => a.porcentaje - b.porcentaje || b.respuestas - a.respuestas);
}

function dashReporteConversion_(d, usuarios, intentos) {
  const inscritos = new Set(usuarios.map(u => u.email));
  const charlas = new Set(intentos.filter(i => i.tipo === 'charla' && inscritos.has(i.email)).map(i => i.email));
  const pabellones = new Set(intentos.filter(i => i.tipo === 'pabellon' && !(d.pabellones[i.unidad] && d.pabellones[i.unidad].entrada) && inscritos.has(i.email)).map(i => i.email));
  let soloCharlas = 0;
  let soloFeria = 0;
  let ambos = 0;
  inscritos.forEach(email => {
    const charla = charlas.has(email);
    const feria = pabellones.has(email);
    if (charla && feria) ambos++;
    else if (charla) soloCharlas++;
    else if (feria) soloFeria++;
  });
  return { soloCharlas, soloFeria, ambos };
}