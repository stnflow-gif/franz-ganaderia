/* ============================================================
   store.test.js — Validación automática de la lógica del sistema
   Corre con:  node tests/store.test.js
   Stubea el navegador (localStorage, window) y prueba el Store real.
   ============================================================ */

const fs = require('fs');
const path = require('path');

// ---- Stubs del navegador ----
const mem = {};
global.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
};
global.CustomEvent = class { constructor(t) { this.type = t; } };
global.window = { dispatchEvent() {} };

// ---- Cargar el Store real ----
const code = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'store.js'), 'utf8');
eval(code);
const S = global.window.Store;

// ---- Mini framework ----
let pass = 0, fail = 0; const fails = [];
function check(name, cond) { if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); } else { fail++; fails.push(name); console.log('  \x1b[31m✗ ' + name + '\x1b[0m'); } }
const money = n => Math.round(n);
const month = new Date().toISOString().slice(0, 7);

console.log('\n=== Validación del sistema Dyck Manantial ===\n');

// 1. Semilla inicial
console.log('Semilla y ajustes:');
check('Arranca con 4 bancos', S.banks().length === 4);
check('Tema por defecto = glass', S.settings().theme === 'glass');
check('Moneda Bs', S.settings().currency === 'Bs');

// 2. Gastos e ingresos
console.log('\nGastos / Ingresos:');
S.addExpense({ domain: 'ganaderia', categoria: 'Veterinario', monto: 1000 });
S.addExpense({ domain: 'personal', categoria: 'Salud', monto: 500 });
S.addIncome({ domain: 'ganaderia', categoria: 'Venta de leche', monto: 3000 });
check('Gasto ganadería guardado', S.expenses().some(x => x.domain === 'ganaderia' && x.monto === 1000));
check('Gasto personal guardado', S.expenses().some(x => x.domain === 'personal' && x.monto === 500));
check('Ingreso guardado', S.incomes().some(x => x.monto === 3000));
check('Comprobante por defecto null', S.expenses()[0].comprobante === null);

// 3. Animales por lotes (cantidad) y muertes
console.log('\nAnimales y muertes:');
const a1 = S.addAnimal({ categoria: 'Vaca', cantidad: 50 });
const a2 = S.addAnimal({ categoria: 'Toro', cantidad: 10 });
const a3 = S.addAnimal({ categoria: 'Vaquilla', cantidad: 20 });
S.registrarMuerte(a3.id, { cantidad: 3, motivo: 'Enfermedad' });
check('3 lotes registrados', S.animals().length === 3);
check('Cabezas vivas = 77 (80 - 3 muertas)', S.headCount() === 77);
check('Total muertes = 3 cabezas', S.totalMuertes() === 3);
check('Muerte con motivo correcto', S.deathsByReason()[0].motivo === 'Enfermedad' && S.deathsByReason()[0].n === 3);
S.registrarVentaLote(a1.id, { cantidad: 20 });
check('Salida de inventario descuenta vivas (57)', S.headCount() === 57);
check('Total vendidas/salidas = 20', S.totalVendidas() === 20);
check('No se puede matar más de las vivas', (() => { S.registrarMuerte(a2.id, { cantidad: 999, motivo: 'Accidente' }); return S.loteVivos(S.animals().find(x => x.id === a2.id)) === 0; })());

// 4. Compras / Ventas
console.log('\nCompras / Ventas:');
S.addPurchase({ proveedor: 'X', metodo_pago: 'Crédito', items: [{ cantidad: 5, precio: 1000 }] });
check('Compra a crédito genera deuda', S.payables().some(p => p.monto_total === 5000 && p.estado === 'pendiente'));
S.addSale({ cliente: 'Y', metodo_pago: 'Efectivo', items: [{ cantidad: 2, precio: 2000 }] });
check('Venta total = 4000', S.sales().some(s => s.total === 4000));
// Precio total directo (compra a precio cerrado)
S.addPurchase({ proveedor: 'Lote100', metodo_pago: 'Efectivo', total: 250000, items: [{ cantidad: 100, precio: 0 }] });
check('Compra usa precio total directo', S.purchases().some(p => p.proveedor === 'Lote100' && p.total === 250000));

// 4b. Préstamos
console.log('\nPréstamos:');
const pr = S.addLoan({ prestamista: 'Banco X', monto: 100000 });
check('Préstamo registrado', S.loans().length === 1 && S.loanBalance(pr) === 100000);
S.payLoan(pr.id, { monto: 30000 });
check('Pago de préstamo baja saldo a 70000', S.loanBalance(S.loans()[0]) === 70000);
check('Saldo pendiente total = 70000', S.loansPendingTotal() === 70000);
const deudasAntes = S.payables().length;
S.addPurchase({ proveedor: 'Z', metodo_pago: 'Préstamo', loan_id: pr.id, items: [{ cantidad: 50, precio: 1000 }] });
check('Compra con préstamo NO genera deuda nueva', S.payables().length === deudasAntes);

// 5. Empleados y sueldos
console.log('\nEmpleados y sueldos:');
const e1 = S.addEmployee({ nombre: 'Ángel', salario: 1500 });
check('Empleado sin pago este mes', S.employeePaidIn(e1.id, month) === null);
S.payEmployee(e1.id, { monto: 1500, fecha: month + '-05', comprobante: 'data:img' });
check('Empleado pagado este mes', !!S.employeePaidIn(e1.id, month));
check('Pago guarda comprobante', S.employeePaidIn(e1.id, month).comprobante === 'data:img');

// 6. Gastos fijos / recurrentes
console.log('\nGastos fijos / recurrentes:');
const r1 = S.addRecurring({ domain: 'ganaderia', nombre: 'Alquiler', monto: 2000, categoria: 'Otros' });
check('Fijo creado', S.recurring().length === 1);
check('Total fijos mensuales = 2000', money(S.recurringMonthlyTotal('ganaderia')) === 2000);
check('Fijo NO pagado aún', S.recurringPaidIn(r1.id, month) === false);
const gastosAntes = S.expenses().length;
S.markRecurringPaid(r1.id, month, { bank_id: null });
check('Marcar fijo pagado genera 1 gasto', S.expenses().length === gastosAntes + 1);
check('Fijo queda pagado este mes', S.recurringPaidIn(r1.id, month) === true);
S.unmarkRecurringPaid(r1.id, month);
check('Desmarcar elimina el gasto', S.expenses().length === gastosAntes);
check('Fijo vuelve a pendiente', S.recurringPaidIn(r1.id, month) === false);

// 7. Cálculos del dashboard
console.log('\nCálculos financieros:');
const f = S.finance();
check('Finance trae totales', typeof f.saldoTotal === 'number' && typeof f.saldoNeto === 'number');
check('Por Pagar refleja la deuda', f.porPagar >= 5000);
const dg = S.domainBreakdown('ganaderia');
check('Breakdown usa "salida" (no egreso)', 'salida' in dg && !('egreso' in dg));
check('Breakdown balance coherente', money(dg.balance) === money(dg.ingreso - dg.salida));
check('Serie mensual = 6 meses', S.monthlySeries(6).length === 6);

// 8. Sync snapshot
console.log('\nSync (snapshot):');
const snap = JSON.parse(JSON.stringify(S.snapshot()));
S.loadSnapshot(snap);
check('Snapshot ida y vuelta conserva animales', S.animals().length === 3);
check('Snapshot conserva empleados', S.employees().length === 1);

// ---- Resultado ----
console.log('\n=== Resultado: ' + pass + ' ✓ / ' + fail + ' ✗ ===');
if (fail) { console.log('Fallaron: ' + fails.join(', ')); process.exit(1); }
console.log('\x1b[32mTODO OK — la lógica del sistema es consistente.\x1b[0m\n');
process.exit(0);
