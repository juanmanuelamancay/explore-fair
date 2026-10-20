/**
 * Diagnóstico de por qué un ponente no puede editar las preguntas de su charla. Se ejecuta a mano desde el editor:
 * elegir "diagnosticarEdicionCharlas", pulsar Ejecutar y leer el registro. Solo lee: no escribe en ninguna hoja ni en la caché.
 * Revisa cada charla activa con la misma lógica que la app (sesion_, filasDeStaff_ y bancosParaPreguntas_).
 */

function diagnosticarEdicionCharlas() {
  exigirAdmin_();
  const informe = [];
  const anotar = (nivel, titulo, detalle) => informe.push({ nivel: nivel, titulo: titulo, detalle: detalle || '' });
  const ok = (titulo, detalle) => anotar('OK', titulo, detalle);
  const aviso = (titulo, detalle) => anotar('AVISO', titulo, detalle);
  const falla = (titulo, detalle) => anotar('FALLA', titulo, detalle);

  let catalogo = null;
  try {
    catalogo = leerCatalogo_();
  } catch (error) {
    falla('Catálogo', error.message);
    return imprimirInformeEdicion_(informe);
  }

  const charlas = catalogo.unidades.filter(u => u.tipo === 'CHARLA');
  if (!charlas.length) {
    falla('Charlas activas', 'ninguna fila de Charlas tiene activo = TRUE');
    return imprimirInformeEdicion_(informe);
  }

  if (catalogo.permisos.some(p => p.rol === 'PONENTE' && p.vista === 'PREGUNTAS')) ok('Permisos · PONENTE PREGUNTAS', 'activo');
  else falla('Permisos · PONENTE PREGUNTAS', 'falta o está inactivo: ningún ponente puede abrir la vista PREGUNTAS');

  const staffCrudo = filasCrudasEdicion_(HOJA.STAFF);
  const preguntasCrudas = filasCrudasEdicion_(HOJA.PREGUNTAS);
  const idsCharla = charlas.map(c => c.id);

  staffCrudo.filter(s => esVerdadero_(s.activo) && rolDeFila_(s) !== 'PONENTE' && rolDeFila_(s).indexOf('PONEN') >= 0)
    .forEach(s => falla('Staff · ' + texto_(s.email), 'rol escrito como "' + texto_(s.rol) + '": la app solo reconoce PONENTE'));
  staffCrudo.filter(s => esVerdadero_(s.activo) && rolDeFila_(s) === 'PONENTE' && idsCharla.indexOf(id_(s.charla_id)) < 0)
    .forEach(s => falla('Staff · ' + texto_(s.email), 'PONENTE con charla_id "' + texto_(s.charla_id) + '", que no es una charla activa: no ve ningún banco'));

  charlas.forEach(c => {
    const titulo = 'Charla ' + c.id + ' · ' + c.nombre;
    const banco = c.bancos[0];
    const necesita = Math.max(banco.minimo, banco.cuantas);

    // Una fila con la columna A vacía no entra en leerHojaCompleta_: la app no la muestra ni la puede editar.
    const delBanco = preguntasCrudas.filter(p => id_(p.stand_id) === c.id);
    const visibles = delBanco.filter(p => p._colA !== '');
    const ocultas = delBanco.length - visibles.length;
    const activas = visibles.filter(p => esVerdadero_(p.activo));
    if (ocultas) falla(titulo + ' · preguntas', ocultas + ' fila(s) con la columna A vacía: la app las ignora y no se pueden editar. Asígnales su pregunta_id o bórralas');
    if (activas.length < necesita) aviso(titulo + ' · preguntas', 'tiene ' + activas.length + ' activas y necesita ' + necesita + ': el quiz no se abre (editarlas sí se puede)');
    else ok(titulo + ' · preguntas', activas.length + ' activas (tope ' + necesita + ')');
    const incompletas = activas.filter(p => !preguntaCompletaEdicion_(p)).map(p => texto_(p.pregunta_id));
    if (incompletas.length) aviso(titulo + ' · preguntas', 'incompletas o con correcta distinta de A-D (el ponente debe corregirlas): ' + incompletas.join(', '));

    const ponentes = staffCrudo.filter(s => rolDeFila_(s) === 'PONENTE' && id_(s.charla_id) === c.id);
    if (!ponentes.length) {
      falla(titulo + ' · ponente', 'no hay fila PONENTE con charla_id = ' + c.id + ': nadie puede editar este banco (el admin sí)');
      return;
    }
    ponentes.forEach(s => {
      const etiqueta = titulo + ' · ' + (texto_(s.email) || '(sin correo)');
      const motivo = motivoSinEdicion_(s, catalogo, c.id);
      if (motivo) falla(etiqueta, motivo);
      else ok(etiqueta, 'puede editar el banco');
    });
  });

  if (!informe.some(i => i.nivel === 'FALLA')) aviso('Si el ponente sigue sin poder editar', 'ejecuta limpiarCache() y pídele que recargue la app: el catálogo puede tardar en refrescarse');
  return imprimirInformeEdicion_(informe);
}

/** Por qué la app no deja editar a esta fila de PONENTE, o '' si sí puede. Replica sesion_ y bancosParaPreguntas_. */
function motivoSinEdicion_(fila, catalogo, charlaId) {
  const email = texto_(fila.email).toLowerCase();
  if (!esVerdadero_(fila.activo)) return 'la fila está inactiva (activo = FALSE)';
  if (!email) return 'la fila no tiene correo';
  if (!correoPermitido_(email)) return 'el correo no es @bbva.com o es de contratista (.contractor@): la app no deja entrar';

  const filas = filasDeStaff_(catalogo, email);
  const primera = filas[0];
  if (!primera) return 'el correo no aparece en el catálogo de Staff activo';
  if (!filas.some(f => f.rol === 'PONENTE' && f.charlaId === charlaId)) {
    if (primera.rol === 'ADMIN' || primera.rol === 'VALIDADOR') return 'su primera fila activa es ' + primera.rol + ' y la app ignora sus demás filas';
    return 'la app no toma esta fila de PONENTE para su correo';
  }

  const roles = filas.map(f => f.rol);
  if (!catalogo.permisos.some(p => roles.indexOf(p.rol) >= 0 && p.vista === 'PREGUNTAS')) return 'ninguno de sus roles (' + roles.join(', ') + ') tiene PREGUNTAS activo en Permisos';

  const sesionSimulada = { email: email, rol: primera.rol, staff: primera, staffFilas: filas };
  if (!bancosParaPreguntas_(sesionSimulada, catalogo).some(b => b.id === charlaId)) return 'la app no le muestra el banco de esta charla (revisa que la charla esté activa)';
  return '';
}

/** Filas de una hoja con algún dato, tal como están escritas (incluye las que la app ignora). */
function filasCrudasEdicion_(nombre) {
  const valores = hoja_(nombre).getDataRange().getValues();
  const encabezados = valores[0].map(normal_);
  const filas = [];
  valores.slice(1).forEach((fila, i) => {
    if (fila.every(v => v === '')) return;
    const objeto = { _fila: i + 2, _colA: fila[0] };
    encabezados.forEach((e, c) => { if (e) objeto[e] = fila[c]; });
    filas.push(objeto);
  });
  return filas;
}

function rolDeFila_(fila) {
  return texto_(fila.rol).toUpperCase();
}

function preguntaCompletaEdicion_(p) {
  return !!texto_(p.texto) && /^[ABCD]$/.test(texto_(p.correcta).toUpperCase()) &&
    [p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d].every(o => !!texto_(o));
}

/** Escribe el informe de diagnosticarEdicionCharlas en el registro. */
function imprimirInformeEdicion_(informe) {
  console.log('===== Diagnóstico de edición de charlas =====');
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
