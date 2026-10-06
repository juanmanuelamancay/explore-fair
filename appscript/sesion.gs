/**
 * Quién está usando la app, qué rol tiene y qué vistas puede abrir.
 */

const SEGUNDOS_BLOQUEO = 20000;
const SEGUNDOS_CACHE_USUARIO = 21600;   // máximo que permite CacheService

/** Rol y vistas de quien hace la llamada. El rol sale de Staff; quien no está ahí es USUARIO. */
function sesion_() {
  const email = texto_(Session.getActiveUser().getEmail()).toLowerCase();
  if (!email) throw new Error('No pudimos identificar tu cuenta. Entra con tu cuenta de la empresa.');
  const catalogo = catalogo_();
  const staff = catalogo.staff.find(s => s.email === email) || null;
  const rol = staff ? staff.rol : 'USUARIO';
  let vistas = catalogo.permisos.filter(p => p.rol === rol).map(p => p.vista);
  // Sala de espera: mientras está activa, quien tiene rol USUARIO solo ve esa vista y no puede
  // llamar a nada más. Da igual si no está en Staff o si está ahí con rol USUARIO.
  // Líderes, admins y usuarios de prueba (cualquier otro rol de Staff) entran normal.
  const enEspera = catalogo.config.espera_activa && rol === 'USUARIO';
  if (enEspera) vistas = ['ESPERA'];
  // El admin la recibe como una vista más, para ver lo mismo que verán los usuarios.
  else if (catalogo.config.espera_activa && rol === 'ADMIN') vistas = vistas.concat('ESPERA');
  return { email: email, rol: rol, staff: staff, vistas: vistas, enEspera: enEspera };
}

/** Toda función que el navegador puede llamar empieza con esto: ocultar una vista no es seguridad. */
function exigirVista_(vista) {
  const sesion = sesion_();
  if (sesion.vistas.indexOf(vista) < 0) throw new Error('No tienes permiso para esta acción.');
  return sesion;
}

/**
 * Rol y vistas actuales de quien llama, leídos del Sheet en el momento. El botón de actualizar
 * lo compara con lo que tenía la página al cargar: si cambió, la página se vuelve a abrir,
 * porque las vistas de un rol se arman al cargar y no se pueden agregar después.
 */
function obtenerAcceso() {
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
 * La app corre con la cuenta de quien la desplegó, así que no sirve preguntar "quién soy"
 * (Drive, Session.getEffectiveUser): eso devolvería siempre al dueño. Aquí se busca el
 * perfil público de otra persona del dominio a partir de su correo.
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

/**
 * Registra a la persona en Usuarios la primera vez que entra y devuelve su nombre.
 * El nombre sale, en este orden, de Staff, del directorio de la organización o del correo.
 */
function asegurarUsuario_(sesion) {
  const email = sesion.email;
  const clave = 'usuario:' + email;
  const enCache = cacheLeer_(clave);
  if (enCache) return enCache.nombre;

  const esMio = u => texto_(u.email).toLowerCase() === email;
  let fila = leerHoja_(HOJA.USUARIOS).find(esMio);
  let nombre = fila ? texto_(fila.nombre) : '';

  if (!nombre) {
    // La consulta al directorio se hace fuera del bloqueo para no frenar a los demás.
    nombre = (sesion.staff && sesion.staff.nombre) || nombreDeDirectorio_(email) || nombreDesdeEmail_(email);
    const bloqueo = LockService.getScriptLock();
    bloqueo.waitLock(SEGUNDOS_BLOQUEO);
    try {
      fila = leerHoja_(HOJA.USUARIOS).find(esMio);
      if (!fila) agregarFila_(HOJA.USUARIOS, { email: email, nombre: nombre, registrado_en: new Date() });
      else if (texto_(fila.nombre)) nombre = texto_(fila.nombre);
    } finally {
      bloqueo.releaseLock();
    }
  }
  cachePoner_(clave, { nombre: nombre }, SEGUNDOS_CACHE_USUARIO);
  return nombre;
}
