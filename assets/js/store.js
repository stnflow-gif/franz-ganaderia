/* ============================================================
   store.js — Capa de datos offline-first (localStorage)
   Modelo completo del ERP: bancos, empleados (con historial),
   compras, ventas, gastos, ingresos y salidas (cuentas por pagar).
   La UI sólo habla con este módulo. Sync a Supabase = pendiente.
   ============================================================ */

const Store = (() => {
  const KEY = 'dyck.db.v3';
  const SYNC = 'dyck.syncqueue.v1';

  const seed = () => ({
    banks: [
      { id: uid(), name: 'Banco Ganadero', tipo: 'Cuenta corriente', saldo_inicial: 0, active: true },
      { id: uid(), name: 'Banco Económico', tipo: 'Caja de ahorro', saldo_inicial: 0, active: true },
      { id: uid(), name: 'Banco Sol', tipo: 'Caja de ahorro', saldo_inicial: 0, active: true },
      { id: uid(), name: 'Efectivo', tipo: 'Caja', saldo_inicial: 0, active: true },
    ],
    employees: [],     // {id, nombre, documento, puesto, telefono, salario, estado, pagos:[]}
    purchases: [],     // {id, fecha, proveedor, bank_id, metodo_pago, observaciones, items:[], total, pagado}
    sales: [],         // {id, fecha, cliente, bank_id, metodo_pago, observaciones, items:[], total, pagado}
    expenses: [],      // {id, fecha, domain, categoria, bank_id, monto, descripcion}
    incomes: [],       // {id, fecha, domain, categoria, bank_id, monto, descripcion}
    payables: [],      // {id, fecha, proveedor, descripcion, domain, monto_total, pagado, vencimiento, estado}
    settings: { theme: 'oro-claro', currency: 'Bs', onboarded: false, user: null },
  });

  function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function now() { return new Date().toISOString(); }

  let db = load();

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) {}
    const fresh = seed(); save(fresh); return fresh;
  }
  function migrate(d) { const base = seed(); return Object.assign(base, d, { settings: Object.assign(base.settings, d.settings || {}) }); }
  function save(x) { localStorage.setItem(KEY, JSON.stringify(x || db)); }
  function commit(op, coll, row) {
    save();
    try { const q = JSON.parse(localStorage.getItem(SYNC) || '[]'); q.push({ op, coll, row, ts: Date.now() }); localStorage.setItem(SYNC, JSON.stringify(q)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('store:changed'));
  }

  const sum = (arr, f) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
  const inMonth = (d, m) => !m || (d || '').slice(0, 7) === m;

  return {
    uid, today,
    all: () => db,
    settings: () => db.settings,
    setSetting(k, v) { db.settings[k] = v; commit('update', 'settings', { k, v }); },

    // ---------- Bancos ----------
    banks: () => db.banks.filter(b => b.active !== false),
    addBank(b) { const row = { id: uid(), name: b.name, tipo: b.tipo || 'Cuenta', saldo_inicial: +b.saldo_inicial || 0, active: true };
      db.banks.push(row); commit('insert', 'banks', row); return row; },
    updateBank(id, patch) { const b = db.banks.find(x => x.id === id); if (b) { Object.assign(b, patch); commit('update', 'banks', b); } },
    removeBank(id) { const b = db.banks.find(x => x.id === id); if (b) { b.active = false; commit('update', 'banks', b); } },
    bankName: (id) => db.banks.find(b => b.id === id)?.name || '—',

    // ---------- Empleados ----------
    employees: () => db.employees,
    activeEmployees: () => db.employees.filter(e => e.estado !== 'inactivo'),
    addEmployee(e) { const row = { id: uid(), nombre: e.nombre, documento: e.documento || '', puesto: e.puesto || 'Vaquero',
      telefono: e.telefono || '', salario: +e.salario || 0, estado: e.estado || 'activo', pagos: [], created_at: now() };
      db.employees.push(row); commit('insert', 'employees', row); return row; },
    updateEmployee(id, patch) { const e = db.employees.find(x => x.id === id); if (e) { Object.assign(e, patch); commit('update', 'employees', e); } },
    removeEmployee(id) { db.employees = db.employees.filter(e => e.id !== id); commit('delete', 'employees', { id }); },
    toggleEmployee(id) { const e = db.employees.find(x => x.id === id); if (e) { e.estado = e.estado === 'inactivo' ? 'activo' : 'inactivo'; commit('update', 'employees', e); } },
    payEmployee(id, p) { const e = db.employees.find(x => x.id === id); if (!e) return;
      e.pagos.push({ id: uid(), fecha: p.fecha || today(), monto: +p.monto || 0, concepto: p.concepto || 'Salario', bank_id: p.bank_id || null });
      commit('update', 'employees', e); },
    nominaMensual: () => sum(db.employees.filter(e => e.estado !== 'inactivo'), e => e.salario),

    // ---------- Compras ----------
    purchases: () => db.purchases,
    addPurchase(p) { const total = sum(p.items || [], it => (+it.cantidad || 0) * (+it.precio || 0));
      const row = { id: uid(), fecha: p.fecha || today(), proveedor: p.proveedor || '', bank_id: p.bank_id || null,
        metodo_pago: p.metodo_pago || 'Efectivo', observaciones: p.observaciones || '', items: p.items || [],
        total, pagado: p.metodo_pago === 'Crédito' ? 0 : total, created_at: now() };
      db.purchases.push(row);
      // Si es a crédito, genera cuenta por pagar (Salida)
      if (p.metodo_pago === 'Crédito' && total > 0) {
        db.payables.push({ id: uid(), fecha: row.fecha, proveedor: row.proveedor, descripcion: 'Compra de ganado',
          domain: 'ganaderia', monto_total: total, pagado: 0, vencimiento: p.vencimiento || '', estado: 'pendiente', created_at: now() });
      }
      commit('insert', 'purchases', row); return row; },
    removePurchase(id) { db.purchases = db.purchases.filter(x => x.id !== id); commit('delete', 'purchases', { id }); },

    // ---------- Ventas ----------
    sales: () => db.sales,
    addSale(s) { const total = sum(s.items || [], it => (+it.cantidad || 0) * (+it.precio || 0)) || (+s.total || 0);
      const row = { id: uid(), fecha: s.fecha || today(), cliente: s.cliente || '', bank_id: s.bank_id || null,
        metodo_pago: s.metodo_pago || 'Efectivo', observaciones: s.observaciones || '', items: s.items || [],
        total, pagado: s.metodo_pago === 'Crédito' ? 0 : total, created_at: now() };
      db.sales.push(row); commit('insert', 'sales', row); return row; },
    removeSale(id) { db.sales = db.sales.filter(x => x.id !== id); commit('delete', 'sales', { id }); },

    // ---------- Gastos ----------
    expenses: () => db.expenses,
    addExpense(g) { const row = { id: uid(), fecha: g.fecha || today(), domain: g.domain || 'ganaderia',
      categoria: g.categoria || 'Otros', bank_id: g.bank_id || null, monto: +g.monto || 0, descripcion: g.descripcion || '', created_at: now() };
      db.expenses.push(row); commit('insert', 'expenses', row); return row; },
    removeExpense(id) { db.expenses = db.expenses.filter(x => x.id !== id); commit('delete', 'expenses', { id }); },

    // ---------- Ingresos ----------
    incomes: () => db.incomes,
    addIncome(i) { const row = { id: uid(), fecha: i.fecha || today(), domain: i.domain || 'ganaderia',
      categoria: i.categoria || 'Otros', bank_id: i.bank_id || null, monto: +i.monto || 0, descripcion: i.descripcion || '', created_at: now() };
      db.incomes.push(row); commit('insert', 'incomes', row); return row; },
    removeIncome(id) { db.incomes = db.incomes.filter(x => x.id !== id); commit('delete', 'incomes', { id }); },

    // ---------- Salidas (cuentas por pagar) ----------
    payables: () => db.payables,
    addPayable(p) { const row = { id: uid(), fecha: p.fecha || today(), proveedor: p.proveedor || '', descripcion: p.descripcion || '',
      domain: p.domain || 'ganaderia', monto_total: +p.monto_total || 0, pagado: +p.pagado || 0,
      vencimiento: p.vencimiento || '', estado: (+p.pagado >= +p.monto_total && +p.monto_total > 0) ? 'pagado' : 'pendiente', created_at: now() };
      db.payables.push(row); commit('insert', 'payables', row); return row; },
    payPayable(id, monto) { const p = db.payables.find(x => x.id === id); if (!p) return;
      p.pagado = Math.min(p.monto_total, (+p.pagado || 0) + (+monto || p.monto_total - p.pagado));
      p.estado = p.pagado >= p.monto_total ? 'pagado' : 'pendiente'; commit('update', 'payables', p); },
    removePayable(id) { db.payables = db.payables.filter(x => x.id !== id); commit('delete', 'payables', { id }); },

    // ---------- Inventario de hato (derivado de compras/ventas) ----------
    headCount() {
      const compra = sum(db.purchases.flatMap(p => p.items || []), it => +it.cantidad || 0);
      const venta = sum(db.sales.flatMap(s => s.items || []), it => +it.cantidad || 0);
      return compra - venta;
    },

    // ---------- Dashboard financiero ----------
    finance(month) {
      const totalVentas = sum(db.sales.filter(s => inMonth(s.fecha, month)), s => s.total);
      const totalCompras = sum(db.purchases.filter(p => inMonth(p.fecha, month)), p => p.total);
      const totalGastos = sum(db.expenses.filter(g => inMonth(g.fecha, month)), g => g.monto);
      const totalIngresos = sum(db.incomes.filter(i => inMonth(i.fecha, month)), i => i.monto);
      const porCobrar = sum(db.sales, s => Math.max(0, s.total - (s.pagado || 0)));
      const porPagar = sum(db.payables.filter(p => p.estado !== 'pagado'), p => p.monto_total - (p.pagado || 0));
      const nominaPagada = sum(db.employees.flatMap(e => e.pagos || []), p => p.monto);
      const saldoBancos = sum(db.banks, b => b.saldo_inicial);
      const saldoTotal = saldoBancos
        + sum(db.sales, s => s.pagado || 0) + sum(db.incomes, i => i.monto)
        - sum(db.purchases, p => p.pagado || 0) - sum(db.expenses, g => g.monto) - nominaPagada;
      return { totalVentas, totalCompras, totalGastos, totalIngresos, porCobrar, porPagar,
        saldoTotal, saldoNeto: saldoTotal + porCobrar - porPagar };
    },

    // Saldo por banco (movimientos que lo referencian)
    bankBalance(id) {
      const b = db.banks.find(x => x.id === id); if (!b) return 0;
      let s = b.saldo_inicial || 0;
      s += sum(db.incomes.filter(i => i.bank_id === id), i => i.monto);
      s += sum(db.sales.filter(x => x.bank_id === id), x => x.pagado || 0);
      s -= sum(db.expenses.filter(g => g.bank_id === id), g => g.monto);
      s -= sum(db.purchases.filter(x => x.bank_id === id), x => x.pagado || 0);
      s -= sum(db.employees.flatMap(e => e.pagos || []).filter(p => p.bank_id === id), p => p.monto);
      return s;
    },

    syncQueueSize() { try { return JSON.parse(localStorage.getItem(SYNC) || '[]').length; } catch (e) { return 0; } },
    exportJSON: () => JSON.stringify(db, null, 2),
  };
})();

window.Store = Store;
