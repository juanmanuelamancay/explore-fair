/**
 * Revisión de solo lectura antes de abrir la quiz del mapa y de recibir intentos.
 * Se ejecuta a mano desde el editor: elegir "validarFeria", Ejecutar y leer el registro.
 * No escribe en hojas, propiedades ni caché. Por eso no usa catalogo_(), sesion_() ni exigirAdmin_(),
 * que pueden guardar datos en la caché.
 */

const VF_OK = 'OK';
const VF_AVISO = 'AVISO';
const VF_FALLA = 'FALLA';

function validarFeria() {
  const informe = [];
  const datos = {};
  const seccion = (titulo, revisar) => {
    informe.push({ seccion: titulo });
    try {
      revisar(informe, datos);
    } catch (error) {
      vfAnotar_(informe, VF_FALLA, 'No se pudo revisar esta sección', error.message);
    }
  };

  seccion('Entorno', vfEntorno_);
  seccion('Hojas y encabezados', vfHojas_);
  seccion('Catálogo (lectura directa de las hojas)', (i, d) => {
    d.catalogo = leerCatalogo_();
    d.preguntas = vfPreguntasPorBanco_();
    d.codigos = hojaSiExiste_(HOJA.CODIGOS) ? leerHoja_(HOJA.CODIGOS) : [];
    vfAnotar_(i, VF_OK, 'Catálogo leído', d.catalogo.unidades.length + ' unidades activas');
  });
  seccion('Config y permisos', vfConfig_);
  seccion('Quiz de entrada', vfQuizDeEntrada_);
  seccion('Pabellones del mapa', vfMapa_);
  seccion('Preguntas de los pabellones', vfPreguntas_);
  seccion('Caché (solo lectura)', vfCache_);
  seccion('Intentos y filas por persona', vfIntentos_);
  seccion('Usuarios y registro', vfUsuarios_);

  const fallas = informe.filter(x => x.estado === VF_FALLA).length;
  const avisos = informe.filter(x => x.estado === VF_AVISO).length;
  informe.forEach(x => {
    if (x.seccion) return console.log('--- ' + x.seccion);
    console.log(x.estado + '  ' + x.titulo + (x.detalle ? ' -> ' + x.detalle : ''));
  });
  console.log('Resultado: ' + (fallas ? 'NO LISTO' : 'LISTO') + ' · fallas ' + fallas + ' · avisos ' + avisos);
  return { listo: fallas === 0, fallas: fallas, avisos: avisos, informe: informe };
}

function vfAnotar_(informe, estado, titulo, detalle) {
  informe.push({ estado: estado, titulo: titulo, detalle: detalle || '' });
}

function vfEntorno_(informe) {
  const version = typeof VERSION_DEL_CODIGO === 'undefined';
  vfAnotar_(informe, version ? VF_AVISO : VF_OK, 'Versión del código', version ? 'main.gs no define VERSION_DEL_CODIGO' : VERSION_DEL_CODIGO);
  vfAnotar_(informe, VF_OK, 'Sheet abierto', libro_().getName());
  const idGuardado = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  vfAnotar_(informe, VF_OK, 'Propiedad SPREADSHEET_ID', idGuardado || '(vacía: se usa ID_DEL_SHEET)');
  const cuenta = Session.getActiveUser().getEmail();
  vfAnotar_(informe, cuenta ? VF_OK : VF_AVISO, 'Cuenta que ejecuta la revisión', cuenta || 'no visible');
}

function vfHojas_(informe) {
  Object.keys(ENCABEZADOS_ESPERADOS).forEach(nombre => {
    const hoja = hojaSiExiste_(nombre);
    if (!hoja) {
      vfAnotar_(informe, nombre === HOJA.CHARLAS ? VF_AVISO : VF_FALLA, 'Hoja ' + nombre, 'no existe');
      return;
    }
    const encontrados = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0].map(normal_);
    const faltan = ENCABEZADOS_ESPERADOS[nombre].filter(e => encontrados.indexOf(e) < 0);
    if (faltan.length) vfAnotar_(informe, VF_FALLA, 'Hoja ' + nombre, 'faltan columnas: ' + faltan.join(', '));
    else vfAnotar_(informe, VF_OK, 'Hoja ' + nombre, 'encabezados completos');
  });
}

/** Preguntas activas por banco, con lo necesario para revisarlas: respuesta válida y contenido completo. */
function vfPreguntasPorBanco_() {
  const porBanco = {};
  leerHoja_(HOJA.PREGUNTAS).filter(p => esVerdadero_(p.activo)).forEach(p => {
    const bancoId = id_(p.stand_id);
    const correcta = texto_(p.correcta).toUpperCase();
    (porBanco[bancoId] = porBanco[bancoId] || []).push({
      id: id_(p.pregunta_id),
      correctaValida: correcta.length === 1 && 'ABCD'.indexOf(correcta) >= 0,
      completa: texto_(p.texto) !== '' && [p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d].every(o => texto_(o) !== ''),
    });
  });
  return porBanco;
}

function vfConfig_(informe, datos) {
  const c = datos.catalogo.config;
  const permisos = datos.catalogo.permisos;
  const tiene = (rol, vista) => permisos.some(p => p.rol === rol && p.vista === vista);
  vfAnotar_(informe, c.feria_abierta ? VF_OK : VF_FALLA, 'feria_abierta', c.feria_abierta ? 'TRUE' : 'FALSE: los pabellones no se abren');
  vfAnotar_(informe, c.espera_activa ? VF_FALLA : VF_OK, 'espera_activa', c.espera_activa ? 'TRUE: el usuario solo ve la sala de espera' : 'FALSE');
  vfAnotar_(informe, tiene('USUARIO', 'MAPA') ? VF_OK : VF_FALLA, 'Permisos USUARIO → MAPA', tiene('USUARIO', 'MAPA') ? 'activo' : 'falta o está inactivo');
  vfAnotar_(informe, tiene('USUARIO', 'QUIZ') ? VF_OK : VF_FALLA, 'Permisos USUARIO → QUIZ', tiene('USUARIO', 'QUIZ') ? 'activo' : 'falta o está inactivo');
  const charlas = tiene('USUARIO', 'CHARLAS');
  vfAnotar_(informe, charlas ? VF_AVISO : VF_OK, 'Permisos USUARIO → CHARLAS', charlas ? 'activo: en la feria debería estar FALSE' : 'FALSE');
  vfAnotar_(informe, VF_OK, 'Tiempos', 'responder ' + c.minutos_para_responder + ' min · código ' + c.minutos_vigencia_codigo + ' min');
}

/** Revisa que cada banco tenga las preguntas activas que el quiz necesita. Mismo criterio que bancoIncompleto_ en quiz.gs. */
function vfRevisarBancos_(informe, titulo, unidad, porBanco) {
  if (!unidad.bancos.length) {
    vfAnotar_(informe, VF_FALLA, titulo, 'no tiene stands activos');
    return;
  }
  const cortos = [];
  unidad.bancos.forEach(b => {
    const tiene = (porBanco[b.id] || []).length;
    const necesita = Math.max(b.minimo, b.cuantas);
    if (tiene < necesita) cortos.push(b.nombre + ' (' + b.id + '): ' + tiene + ' de ' + necesita);
  });
  if (cortos.length) vfAnotar_(informe, VF_FALLA, titulo, 'bancos incompletos: ' + cortos.join(' · '));
  else vfAnotar_(informe, VF_OK, titulo, unidad.bancos.length + ' stand(s), quiz de ' + unidad.porQuiz + ' preguntas');
}

function vfQuizDeEntrada_(informe, datos) {
  const entradas = datos.catalogo.unidades.filter(u => u.tipo === 'PABELLON' && !u.requiereCodigo);
  if (entradas.length !== 1) {
    vfAnotar_(informe, VF_FALLA, 'Quiz de entrada', entradas.length + ' pabellones con requiere_codigo FALSE; debe haber exactamente 1');
    return;
  }
  const entrada = entradas[0];
  const titulo = 'Quiz de entrada ' + entrada.id;
  vfAnotar_(informe, entrada.id === 'PAB-000' ? VF_OK : VF_AVISO, titulo + ' · identificador',
    entrada.id === 'PAB-000' ? 'PAB-000' : 'el quiz de entrada esperado es PAB-000');
  vfAnotar_(informe, entrada.bancos.length === 1 ? VF_OK : VF_FALLA, titulo + ' · stands',
    entrada.bancos.length + ' stand(s); debe ser 1');
  vfAnotar_(informe, entrada.porQuiz === 4 ? VF_OK : VF_FALLA, titulo + ' · preguntas por quiz',
    entrada.porQuiz + '; debe ser 4');
  vfRevisarBancos_(informe, titulo + ' · banco', entrada, datos.preguntas);
}

function vfMapa_(informe, datos) {
  const cat = datos.catalogo;
  const mapa = cat.unidades.filter(u => u.tipo === 'PABELLON' && u.requiereCodigo);
  vfAnotar_(informe, mapa.length ? VF_OK : VF_FALLA, 'Pabellones en el mapa', mapa.length + ' pabellones: ' + mapa.map(u => u.id).join(', '));
  const ahora = Date.now();
  const codigoDe = {};
  datos.codigos.forEach(c => { codigoDe[id_(c.unidad_id)] = c; });
  mapa.forEach(u => {
    const titulo = 'Pabellón ' + u.id + ' ' + u.nombre;
    if (!u.bancos.length) {
      vfAnotar_(informe, VF_AVISO, titulo, 'sin stands activos: no sale en el mapa');
      return;
    }
    vfRevisarBancos_(informe, titulo, u, datos.preguntas);
    const lideres = cat.staff.filter(s => s.rol === 'LIDER' && s.pabellonId === u.id);
    vfAnotar_(informe, lideres.length ? VF_OK : VF_AVISO, titulo + ' · líder',
      lideres.length ? lideres.map(l => l.email).join(', ') : 'sin líder: nadie puede generar su código');
    const c = codigoDe[u.id];
    const vigente = !!c && texto_(c.codigo) !== '' && texto_(c.estado).toUpperCase() === 'ACTIVO' && ms_(c.expira_en) > ahora;
    vfAnotar_(informe, vigente ? VF_OK : VF_AVISO, titulo + ' · código',
      vigente ? 'vigente hasta ' + new Date(ms_(c.expira_en)).toISOString() : 'sin código vigente ahora (normal si el líder todavía no lo genera)');
  });
}

function vfPreguntas_(informe, datos) {
  const invalidas = [];
  const incompletas = [];
  datos.catalogo.unidades.filter(u => u.tipo === 'PABELLON').forEach(u => u.bancos.forEach(b => {
    (datos.preguntas[b.id] || []).forEach(p => {
      if (!p.correctaValida) invalidas.push(p.id);
      if (!p.completa) incompletas.push(p.id);
    });
  }));
  vfAnotar_(informe, invalidas.length ? VF_FALLA : VF_OK, 'Respuesta correcta (A-D) de las preguntas activas',
    invalidas.length ? 'inválida en: ' + invalidas.join(', ') : 'todas válidas');
  vfAnotar_(informe, incompletas.length ? VF_AVISO : VF_OK, 'Enunciado y opciones completos',
    incompletas.length ? 'incompletos: ' + incompletas.join(', ') : 'completos');
}

/** Compara lo que la caché tiene con lo que hay en las hojas. Solo lee la caché. */
function vfCache_(informe, datos) {
  const enCache = cacheLeer_('catalogo');
  if (!enCache) vfAnotar_(informe, VF_OK, 'Caché del catálogo', 'vacía: se llena en el primer ingreso');
  else if (JSON.stringify(enCache) === JSON.stringify(datos.catalogo)) vfAnotar_(informe, VF_OK, 'Caché del catálogo', 'igual a las hojas');
  else vfAnotar_(informe, VF_AVISO, 'Caché del catálogo', 'distinta de las hojas: se actualiza sola en unos segundos o con "Actualizar desde el Sheet"');

  const desiguales = [];
  datos.catalogo.unidades.filter(u => u.tipo === 'PABELLON').forEach(u => u.bancos.forEach(b => {
    const enCacheBanco = cacheLeer_('preguntas:' + b.id);
    if (!enCacheBanco) return;
    const enHoja = (datos.preguntas[b.id] || []).map(p => p.id).sort().join(',');
    if (enCacheBanco.map(p => p.id).sort().join(',') !== enHoja) desiguales.push(b.id);
  }));
  vfAnotar_(informe, desiguales.length ? VF_AVISO : VF_OK, 'Caché de preguntas por banco',
    desiguales.length ? 'distinta de las hojas en: ' + desiguales.join(', ') + ' (se actualiza sola al vencer o con "Actualizar desde el Sheet")' : 'igual a las hojas o sin caché');
}

/** Usuarios, con el número de orden que manda (marcador del registro) y la copia de la hoja. Solo lee. */
function vfUsuariosLeer_() {
  const filas = leerHoja_(HOJA.USUARIOS, ['email', 'nombre', 'orden']).filter(u => texto_(u.email) !== '');
  const enHoja = {};
  filas.forEach(u => { enHoja[texto_(u.email).toLowerCase()] = Number(u.orden) || 0; });
  const marcadores = buzon_().getProperties();
  const ordenDe = email => parseInt(marcadores[PREFIJO_ORDEN + email], 10) || enHoja[email] || 0;
  return { filas: filas, enHoja: enHoja, marcadores: marcadores, ordenDe: ordenDe };
}

function vfIntentos_(informe, datos) {
  const unidades = datos.catalogo.unidades;
  const ids = new Set(unidades.map(u => u.id));
  vfAnotar_(informe, unidades.length <= FILAS_POR_PERSONA ? VF_OK : VF_FALLA, 'Unidades por persona',
    unidades.length + ' de ' + FILAS_POR_PERSONA + ' filas reservadas');

  const hoja = hoja_(HOJA.INTENTOS);
  const tabla = hoja.getDataRange().getValues();
  const encabezados = tabla[0].map(normal_);
  const col = nombre => encabezados.indexOf(nombre);
  const u = vfUsuariosLeer_();

  const maximo = Math.max(ultimoOrden_(), 0, ...Object.keys(u.enHoja).map(e => u.ordenDe(e)));
  const necesarias = 1 + FILAS_POR_PERSONA * maximo;
  vfAnotar_(informe, hoja.getMaxRows() >= necesarias ? VF_OK : VF_AVISO, 'Filas de Intentos',
    hoja.getMaxRows() + ' filas; los bloques de ' + maximo + ' personas llegan hasta la ' + necesarias);

  const fuera = [];
  const duplicados = [];
  const vistos = {};
  let conEmail = 0, sinNumero = 0, enCurso = 0, desconocidas = 0;
  for (let r = 1; r < tabla.length; r++) {
    const fila = tabla[r];
    const email = texto_(fila[col('email')]).toLowerCase();
    if (!email) continue;
    conEmail++;
    if (texto_(fila[col('estado')]).toUpperCase() === 'EN_CURSO') enCurso++;
    const unidad = id_(fila[col('unidad_id')]);
    if (unidad && !ids.has(unidad)) desconocidas++;
    const orden = u.ordenDe(email);
    if (!orden) { sinNumero++; continue; }
    const fila1 = r + 1;
    const primera = primeraFilaDe_(orden);
    if (fila1 < primera || fila1 >= primera + FILAS_POR_PERSONA) {
      if (fuera.length < 10) fuera.push('fila ' + fila1 + ' (' + email + ')');
    }
    const clave = email + '|' + unidad;
    if (vistos[clave] && duplicados.length < 10) duplicados.push(email + ' ' + unidad);
    vistos[clave] = true;
  }

  vfAnotar_(informe, VF_OK, 'Intentos registrados', conEmail + ' filas con correo · ' + enCurso + ' marcadas EN_CURSO');
  vfAnotar_(informe, fuera.length ? VF_FALLA : VF_OK, 'Filas dentro del bloque de su persona',
    fuera.length ? 'fuera de bloque: ' + fuera.join(', ') : 'todas dentro de su bloque');
  vfAnotar_(informe, duplicados.length ? VF_FALLA : VF_OK, 'Un intento por persona y unidad',
    duplicados.length ? 'repetidos: ' + duplicados.join(', ') : 'sin repetidos');
  vfAnotar_(informe, sinNumero ? VF_AVISO : VF_OK, 'Filas de Intentos sin número de orden',
    sinNumero ? sinNumero + ' filas de personas sin número' : 'ninguna');
  vfAnotar_(informe, desconocidas ? VF_AVISO : VF_OK, 'Intentos de unidades que ya no existen',
    desconocidas ? desconocidas + ' filas (no bloquean la feria)' : 'ninguna');
}

function vfUsuarios_(informe) {
  const u = vfUsuariosLeer_();
  const numeros = u.filas.map(f => Number(f.orden)).filter(Boolean);
  const repetidos = numeros.filter((n, i) => numeros.indexOf(n) !== i);
  vfAnotar_(informe, repetidos.length ? VF_FALLA : VF_OK, 'Números de orden únicos',
    repetidos.length ? 'repetidos: ' + repetidos.join(', ') : numeros.length + ' personas con número');

  const sinOrden = u.filas.filter(f => !Number(f.orden)).length;
  vfAnotar_(informe, sinOrden ? VF_AVISO : VF_OK, 'Filas de Usuarios sin orden', sinOrden ? sinOrden + ' filas' : 'ninguna');

  const claves = Object.keys(u.marcadores).filter(k => k.indexOf(PREFIJO_ORDEN) === 0);
  const distintos = [];
  let pendientes = 0;
  let sinFila = 0;
  claves.forEach(k => {
    const email = k.slice(PREFIJO_ORDEN.length);
    const valor = u.marcadores[k];
    const pendiente = valor.slice(-1) === ORDEN_SIN_FILA;
    if (pendiente) pendientes++;
    if (email in u.enHoja && !pendiente && u.enHoja[email] !== parseInt(valor, 10)) distintos.push(email);
    if (!(email in u.enHoja) && !pendiente) sinFila++;
  });
  vfAnotar_(informe, distintos.length ? VF_FALLA : VF_OK, 'Columna orden igual al número entregado',
    distintos.length ? 'distinta en: ' + distintos.slice(0, 10).join(', ') + ' (con Intentos vacía, prepararFeria la corrige)' : 'coincide');
  vfAnotar_(informe, pendientes ? VF_AVISO : VF_OK, 'Números entregados sin fila confirmada en Usuarios', pendientes ? pendientes + ' (se escriben en la siguiente pasada)' : 'ninguno');
  vfAnotar_(informe, sinFila ? VF_AVISO : VF_OK, 'Números entregados sin fila en Usuarios', sinFila ? sinFila + ' personas' : 'ninguno');

  const cartas = leerBuzon_().length;
  vfAnotar_(informe, cartas ? VF_AVISO : VF_OK, 'Registros pendientes en el buzón', cartas ? cartas + ' cartas por escribir' : 'ninguno');
}
