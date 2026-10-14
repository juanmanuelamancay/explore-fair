/**
 * Quién está usando la app, qué rol tiene y qué vistas puede abrir.
 * El registro en la hoja Usuarios está en registro.gs.
 */

const SEGUNDOS_BLOQUEO = 20000;
const SEGUNDOS_CACHE_USUARIO = 21600;   // máximo que permite CacheService

// El VALIDADOR revisa la feria sin tocarla: solo estas vistas, y en cada una el servidor lo deja leer, no escribir.
// Aunque Permisos le agregue otra, no la recibe.
const VISTAS_DEL_VALIDADOR = ['MAPA', 'QUIZ', 'PREGUNTAS', 'CHARLAS'];

// Por ahora solo personal interno: cuentas @bbva.com, sin las de contratistas (nombre.apellido.contractor@bbva.com).
const DOMINIO_PERMITIDO = 'bbva.com';

/** ¿El correo puede entrar a la app? Lo usan doGet y sesion_, así que ninguna función pública lo salta. */
function correoPermitido_(email) {
  const correo = texto_(email).toLowerCase();
  return correo.endsWith('@' + DOMINIO_PERMITIDO) && correo.indexOf('.contractor@') < 0;
}

/**
 * Filas de Staff que valen para este correo. Una persona del staff puede tener varias filas activas (líder, expositor y
 * ponente a la vez), una por función. ADMIN y VALIDADOR van solos: si la primera fila es una de ellas, las demás se ignoran.
 * Quien además tiene una función real deja de contar su fila USUARIO.
 */
function filasDeStaff_(catalogo, email) {
  const filas = catalogo.staff.filter(s => s.email === email);
  if (filas.length && (filas[0].rol === 'ADMIN' || filas[0].rol === 'VALIDADOR')) return [filas[0]];
  const conFuncion = filas.filter(s => s.rol !== 'USUARIO');
  return conFuncion.length ? conFuncion : filas;
}

/**
 * Rol y vistas de quien hace la llamada. El rol sale de Staff; quien no está ahí es USUARIO.
 * "rol" y "staff" son los de la primera fila y los usan las comprobaciones de un solo rol (admin, validador, usuario);
 * "staffFilas" trae todas las filas y las usan las vistas que calculan un alcance (códigos y preguntas).
 */
function sesion_() {
  const email = texto_(Session.getActiveUser().getEmail()).toLowerCase();
  if (!email) throw new Error('No pudimos identificar tu cuenta. Entra con tu cuenta de la empresa.');
  if (!correoPermitido_(email)) throw new Error('Esta app es solo para personal interno con correo @bbva.com.');
  const catalogo = catalogo_();
  const staffFilas = filasDeStaff_(catalogo, email);
  const staff = staffFilas[0] || null;
  const rol = staff ? staff.rol : 'USUARIO';
  const roles = staffFilas.length ? staffFilas.map(s => s.rol) : ['USUARIO'];
  let vistas = catalogo.permisos.filter(p => roles.indexOf(p.rol) >= 0).map(p => p.vista)
    .filter((v, i, todas) => todas.indexOf(v) === i);
  if (rol === 'VALIDADOR') vistas = vistas.filter(v => VISTAS_DEL_VALIDADOR.indexOf(v) >= 0);
  // Sala de espera: mientras está activa, quien tiene rol USUARIO solo ve esa vista y no puede
  // llamar a nada más. Da igual si no está en Staff o si está ahí con rol USUARIO.
  // Líderes y admins (roles de Staff) entran normal.
  const enEspera = catalogo.config.espera_activa && rol === 'USUARIO';
  if (enEspera) vistas = ['ESPERA'];
  // El admin y el validador la reciben como una vista más, para ver lo mismo que verán los usuarios.
  else if (catalogo.config.espera_activa && (rol === 'ADMIN' || rol === 'VALIDADOR')) vistas = vistas.concat('ESPERA');
  return { email: email, rol: rol, staff: staff, staffFilas: staffFilas, vistas: vistas, enEspera: enEspera };
}

/** Filas de Staff de una sesión. Las sesiones armadas en memoria por las pruebas solo traen "staff" y "rol". */
function filasDeSesion_(sesion) {
  if (sesion.staffFilas) return sesion.staffFilas;
  return sesion.staff ? [Object.assign({ rol: sesion.rol }, sesion.staff)] : [];
}

/** Toda función que el navegador puede llamar empieza con esto: ocultar una vista no es seguridad. */
function exigirVista_(vista) {
  const sesion = sesion_();
  if (sesion.vistas.indexOf(vista) < 0) throw new Error('No tienes permiso para esta acción.');
  return sesion;
}

/**
 * Para funciones que solo el admin puede ejecutar. Desde el editor, la sesión es la de quien lo ejecuta:
 * esa cuenta tiene que estar en Staff como ADMIN.
 */
function exigirAdmin_() {
  const sesion = sesion_();
  if (sesion.rol !== 'ADMIN') throw new Error('Solo un administrador puede hacer esto.');
  return sesion;
}

/**
 * Rol y vistas actuales de quien llama, leídos del Sheet en el momento. El botón de actualizar
 * lo compara con lo que tenía la página al cargar: si cambió, la página se vuelve a abrir,
 * porque las vistas de un rol se arman al cargar y no se pueden agregar después.
 */
function obtenerAcceso() {
  if (!correoPermitido_(Session.getActiveUser().getEmail())) throw new Error('Esta app es solo para personal interno con correo @bbva.com.');
  sincronizarRoles_();
  const sesion = sesion_();
  return {
    rol: sesion.rol,
    vistas: sesion.vistas.filter(v => ARCHIVO_DE_VISTA[v]),
    url: ScriptApp.getService().getUrl(),
  };
}

/** "jose.perez2@empresa.com" -> "Jose Perez". Respaldo para cuando el directorio no entrega el nombre. */
function nombreDesdeEmail_(email) {
  const partes = email.split('@')[0].replace(/[0-9]/g, '').split(/[._-]+/).filter(Boolean);
  if (!partes.length) return email;
  return partes.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

/**
 * Nombre de la persona según el directorio de la organización, o '' si no se pudo obtener.
 * Session solo entrega el correo, así que se busca el perfil público del dominio a partir de él.
 * Requiere el servicio avanzado "Admin SDK API" y que el dominio comparta su directorio.
 */
function nombreDeDirectorio_(email) {
  try {
    if (typeof AdminDirectory === 'undefined') return '';
    const perfil = AdminDirectory.Users.get(email, { viewType: 'domain_public', fields: 'name' });
    return texto_(perfil && perfil.name && perfil.name.fullName);
  } catch (error) {
    console.warn('No se pudo leer el nombre de ' + email + ' en el directorio: ' + error.message);
    return '';
  }
}

/**
 * Para ejecutar a mano desde el editor: muestra en el registro qué nombre obtiene la app
 * para tu propia cuenta y de dónde sale. Sirve para saber si el directorio está disponible.
 */
function probarNombre() {
  const email = texto_(Session.getActiveUser().getEmail()).toLowerCase();
  const deDirectorio = nombreDeDirectorio_(email);
  console.log('Correo: ' + email);
  console.log('Nombre en el directorio: ' + (deDirectorio || '(no disponible)'));
  console.log('Nombre deducido del correo: ' + nombreDesdeEmail_(email));
}
