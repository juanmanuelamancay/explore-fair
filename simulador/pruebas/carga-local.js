// Corre dentro de este proceso las funciones internas de la prueba de carga (las que el editor de Apps Script ejecutaría
// con disparadores) contra el simulador, para detectar errores de código antes de que el usuario las ejecute.
process.env.PORT = '8141';
process.env.RANKING = '0';
const vm = require('vm');
const sim = require(process.argv[2]);
const lineas = [];
const log = console.log;
const original = sim.contexto.console;
sim.contexto.console = { log: (...a) => lineas.push(a.join(' ')), warn: (...a) => lineas.push('WARN ' + a.join(' ')), error: (...a) => lineas.push('ERROR ' + a.join(' ')), info: () => {} };

const correr = codigo => vm.runInContext(codigo, sim.contexto);
const admin = 'admin@demo.com';
sim.ejecutar(admin, 'prepararFeria', []);
sim.ejecutar(admin, 'iniciarPruebaCarga5', []);
// Ahora mismo y durante 4 segundos: sin pausas reales, caben muchas personas.
const ahora = Date.now();
const plan = JSON.parse(sim.propiedades.PRUEBA_CARGA);
plan.salida = ahora; plan.fin = ahora + 4000;
sim.propiedades.PRUEBA_CARGA = JSON.stringify(plan);
sim.ejecutar(admin, 'pasoPruebaCarga_', []);
// La revisión espera a que pasen salida + cola: se adelanta el plan.
plan.salida = ahora - 200000; plan.fin = ahora - 196000;
sim.propiedades.PRUEBA_CARGA = JSON.stringify(plan);
sim.ejecutar(admin, 'revisarPruebaCarga', []);
sim.ejecutar(admin, 'limpiarPruebaCarga', []);
sim.contexto.console = original;
log(lineas.join('\n'));
process.exit(0);
