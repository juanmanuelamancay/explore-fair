// Prueba de la vista INGRESOS contra el simulador en marcha. node simulador/pruebas/ingresos.js [puerto]
// Comprueba que solo la ven quienes tienen la vista, que no devuelve correos, que deduce el nombre del correo
// y que leer la lista no cambia la hoja Usuarios.
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
const agregar = async (nombre, fila) => fetch(base + '/hoja?nombre=' + nombre, { method: 'POST', body: JSON.stringify(fila) });

(async () => {
  // Cuentas @bbva.com: la app rechaza otros dominios. juanmanuel.amancay es líder, expositor y ponente, sin INGRESOS.
  const sinVista = 'juanmanuel.amancay@bbva.com', admin = 'admin.prueba@bbva.com', val = 'validador.prueba@bbva.com';

  const acceso = await llamar(val, 'obtenerAcceso');
  ok(acceso.vistas.includes('INGRESOS'), 'el validador tiene la vista INGRESOS', acceso.vistas);

  // Una persona sin esa vista no la abre
  let x = await intenta(sinVista, 'obtenerIngresos');
  ok(x.error && /permiso/.test(x.error), 'quien no tiene la vista no la abre', x);

  // Una fila nueva sin nombre (se deduce del correo) y otra con nombre
  const sello = Date.now();
  const correoSinNombre = 'prueba.sin.nombre.' + sello + '@demo.com';
  await agregar('Usuarios', [correoSinNombre, '', '2026-10-16 08:30', 900]);
  await agregar('Usuarios', ['prueba.con.nombre@demo.com', 'Nombre Escrito', '2026-10-15 18:45', 901]);

  const antes = JSON.stringify(await hoja('Usuarios'));
  const lista = await llamar(val, 'obtenerIngresos');

  // Lo que sale no lleva correos
  ok(!JSON.stringify(lista).includes('@'), 'la respuesta no incluye ningún correo', JSON.stringify(lista).slice(0, 200));

  // El total cuenta a cada persona una vez: las filas con correo de la hoja, sin repetidos
  const filas = (await hoja('Usuarios')).slice(1).filter(f => f && f[0]);
  const unicos = new Set(filas.map(f => String(f[0]).toLowerCase())).size;
  ok(lista.total === unicos, 'el total es el de personas con correo en Usuarios, sin repetidos', { total: lista.total, unicos });

  // Nombre deducido del correo cuando la celda está vacía
  const sinNombre = lista.personas.find(p => p.ms === new Date('2026-10-16T08:30').getTime());
  ok(sinNombre && /^Prueba Sin Nombre/.test(sinNombre.nombre), 'sin nombre en la hoja, se deduce del correo', sinNombre);
  const conNombre = lista.personas.find(p => p.nombre === 'Nombre Escrito');
  ok(!!conNombre, 'con nombre en la hoja, se muestra el nombre de la hoja', conNombre);

  // Orden: de la más reciente a la más antigua
  const orden = lista.personas.every((p, i) => i === 0 || lista.personas[i - 1].ms >= p.ms);
  ok(orden, 'la lista va de la más reciente a la más antigua');

  // Solo lectura: la hoja queda igual
  const despues = JSON.stringify(await hoja('Usuarios'));
  ok(antes === despues, 'leer la vista no cambia la hoja Usuarios');

  // Botón de actualizar del validador: comprueba el acceso y vuelve a leer la lista. Tampoco registra al validador.
  const antesRefresco = JSON.stringify(await hoja('Usuarios'));
  await llamar(val, 'obtenerAcceso');
  await llamar(val, 'obtenerIngresos');
  const reg = await llamar(val, 'registrarme');
  ok(JSON.stringify(await hoja('Usuarios')) === antesRefresco, 'actualizar y el registro en segundo plano del validador no escriben en Usuarios', reg);

  // Solo admin y validador: aunque la hoja Permisos diga otra cosa, el resto no la recibe ni la abre.
  const nueva = 'persona.nueva@bbva.com', lider = 'juanmanuel.amancay@bbva.com';
  await agregar('Permisos', ['USUARIO', 'INGRESOS', true]);
  await agregar('Permisos', ['EXPOSITOR', 'INGRESOS', true]);
  const accesoUsuario = await llamar(nueva, 'obtenerAcceso');
  ok(!accesoUsuario.vistas.includes('INGRESOS'), 'un usuario con INGRESOS en Permisos no la recibe', accesoUsuario.vistas);
  x = await intenta(nueva, 'obtenerIngresos');
  ok(x.error && /permiso/.test(x.error), 'un usuario no puede pedir los datos aunque la hoja lo diga', x);
  const accesoLider = await llamar(lider, 'obtenerAcceso');
  ok(!accesoLider.vistas.includes('INGRESOS'), 'un líder con expositor e INGRESOS en Permisos no la recibe', accesoLider.vistas);
  x = await intenta(admin, 'guardarAdminRegistro', 'permisos', { rol: 'USUARIO', vista: 'INGRESOS', activo: true });
  ok(x.error && /solo puede tenerla/.test(x.error), 'el panel no deja asignar INGRESOS a un usuario', x);
  x = await intenta(admin, 'guardarAdminRegistro', 'permisos', { rol: 'ADMIN', vista: 'INGRESOS', activo: true });
  // En los datos de ejemplo el admin ya la tiene: el panel responde "ya existe", no la restricción.
  ok(!x.error || /Ya existe/.test(x.error), 'el panel no bloquea la vista para el admin', x);

  // El admin también la abre (tiene la vista en Permisos)
  x = await intenta(admin, 'obtenerIngresos');
  ok(!x.error && x.valor.total === lista.total, 'el admin la abre y ve el mismo total', x);

  console.log(fallos ? '\n' + fallos + ' fallo(s)' : '\nTodo bien.');
  process.exitCode = fallos ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
