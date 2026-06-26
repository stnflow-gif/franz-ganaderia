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
    animals: [],       // {id, codigo, categoria, raza, sexo, edad_meses, peso, origen, precio, fecha_ingreso, estado, fecha_baja, motivo}
    purchases: [],     // {id, fecha, proveedor, bank_id, metodo_pago, observaciones, items:[], total, pagado}
    sales: [],         // {id, fecha, cliente, bank_id, metodo_pago, observaciones, items:[], total, pagado}
    expenses: [],      // {id, fecha, domain, categoria, bank_id, monto, descripcion}
    incomes: [],       // {id, fecha, domain, categoria, bank_id, monto, descripcion}
    payables: [],      // {id, fecha, proveedor, descripcion, domain, monto_total, pagado, vencimiento, estado}
    recurring: [],     // {id, tipo:'gasto', domain, categoria, nombre, monto, bank_id, dia, active, paid:{'YYYY-MM':expenseId}}
    loans: [],         // {id, prestamista, monto, fecha, vencimiento, interes_pct, notas, bank_id, pagos:[{id,monto,fecha,bank_id}]}
    deaths: [],        // {id, cantidad, motivo, categoria, fecha} — muertes del hato (nacidas o compradas)
    tasks: [],         // {id, texto, fecha, done, created_at} — lista de pendientes
    settings: { theme: 'glass', currency: 'Bs', onboarded: false, user: null },
  });

  function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function now() { return new Date().toISOString(); }

  // Helpers de lote de animales (compatibles con registros viejos individuales)
  function totalDe(a) { return a.cantidad != null ? +a.cantidad : 1; }
  function muertosDe(a) { return a.muertos != null ? +a.muertos : (a.estado === 'muerto' ? 1 : 0); }
  function vendidosDe(a) { return a.vendidos != null ? +a.vendidos : (a.estado === 'vendido' ? 1 : 0); }
  function vivosDe(a) { return Math.max(0, totalDe(a) - muertosDe(a) - vendidosDe(a)); }

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
      telefono: e.telefono || '', salario: +e.salario || 0, estado: e.estado || 'activo',
      fecha_ingreso: e.fecha_ingreso || '', fecha_nacimiento: e.fecha_nacimiento || '', direccion: e.direccion || '',
      contacto_emergencia: e.contacto_emergencia || '', notas: e.notas || '', pagos: [], created_at: now() };
      db.employees.push(row); commit('insert', 'employees', row); return row; },
    updateEmployee(id, patch) { const e = db.employees.find(x => x.id === id); if (e) { Object.assign(e, patch); commit('update', 'employees', e); } },
    removeEmployee(id) { db.employees = db.employees.filter(e => e.id !== id); commit('delete', 'employees', { id }); },
    toggleEmployee(id) { const e = db.employees.find(x => x.id === id); if (e) { e.estado = e.estado === 'inactivo' ? 'activo' : 'inactivo'; commit('update', 'employees', e); } },
    payEmployee(id, p) { const e = db.employees.find(x => x.id === id); if (!e) return;
      e.pagos.push({ id: uid(), fecha: p.fecha || today(), monto: +p.monto || 0, concepto: p.concepto || 'Salario',
        bank_id: p.bank_id || null, comprobante: p.comprobante || null });
      commit('update', 'employees', e); },
    nominaMensual: () => sum(db.employees.filter(e => e.estado !== 'inactivo'), e => e.salario),
    // ¿Se le pagó el sueldo a este empleado en el mes dado? (devuelve el pago o null)
    employeePaidIn(id, month) { const e = db.employees.find(x => x.id === id); if (!e) return null;
      return (e.pagos || []).find(p => (p.fecha || '').slice(0, 7) === month) || null; },

    // ---------- Compras ----------
    purchases: () => db.purchases,
    addPurchase(p) { const computed = sum(p.items || [], it => (+it.cantidad || 0) * (+it.precio || 0));
      // Precio final directo si se ingresó (Franz compra lotes grandes a precio cerrado)
      const total = (+p.total > 0) ? +p.total : computed;
      const row = { id: uid(), fecha: p.fecha || today(), proveedor: p.proveedor || '', bank_id: p.bank_id || null,
        metodo_pago: p.metodo_pago || 'Efectivo', observaciones: p.observaciones || '', items: p.items || [],
        loan_id: p.loan_id || null, total, pagado: p.metodo_pago === 'Crédito' ? 0 : total, created_at: now() };
      db.purchases.push(row);
      // Si es a crédito, genera cuenta por pagar (Salida). Si se pagó con préstamo, NO genera deuda
      // (la deuda ya es el préstamo registrado, así no se cuenta doble).
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
      categoria: g.categoria || 'Otros', bank_id: g.bank_id || null, monto: +g.monto || 0, descripcion: g.descripcion || '',
      comprobante: g.comprobante || null, recurring_id: g.recurring_id || null, created_at: now() };
      db.expenses.push(row); commit('insert', 'expenses', row); return row; },
    removeExpense(id) { db.expenses = db.expenses.filter(x => x.id !== id); commit('delete', 'expenses', { id }); },

    // ---------- Ingresos ----------
    incomes: () => db.incomes,
    addIncome(i) { const row = { id: uid(), fecha: i.fecha || today(), domain: i.domain || 'ganaderia',
      categoria: i.categoria || 'Otros', bank_id: i.bank_id || null, monto: +i.monto || 0, descripcion: i.descripcion || '',
      comprobante: i.comprobante || null, created_at: now() };
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

    // ---------- Gastos fijos / recurrentes ----------
    // Se repiten cada mes y se "cuentan para el próximo mes". Marcar pagado genera el gasto real del mes.
    recurring: (domain) => db.recurring.filter(r => r.active !== false && (!domain || r.domain === domain)),
    addRecurring(r) { const row = { id: uid(), tipo: 'gasto', domain: r.domain || 'ganaderia', categoria: r.categoria || 'Otros',
      nombre: r.nombre || r.categoria || 'Gasto fijo', monto: +r.monto || 0, bank_id: r.bank_id || null, dia: +r.dia || 1,
      active: true, paid: {}, created_at: now() };
      db.recurring.push(row); commit('insert', 'recurring', row); return row; },
    updateRecurring(id, patch) { const r = db.recurring.find(x => x.id === id); if (r) { Object.assign(r, patch); commit('update', 'recurring', r); } },
    removeRecurring(id) { db.recurring = db.recurring.filter(r => r.id !== id); commit('delete', 'recurring', { id }); },
    recurringPaidIn(id, month) { const r = db.recurring.find(x => x.id === id); return !!(r && r.paid && r.paid[month]); },
    // Marca un fijo como pagado en el mes: genera el gasto real y guarda el vínculo.
    markRecurringPaid(id, month, opts = {}) {
      const r = db.recurring.find(x => x.id === id); if (!r || (r.paid && r.paid[month])) return;
      const fecha = month + '-' + String(opts.dia || r.dia || 1).padStart(2, '0');
      const exp = this.addExpense({ domain: r.domain, categoria: r.categoria, bank_id: opts.bank_id ?? r.bank_id,
        monto: r.monto, descripcion: r.nombre + ' (fijo)', comprobante: opts.comprobante || null, recurring_id: r.id, fecha });
      r.paid = r.paid || {}; r.paid[month] = exp.id; commit('update', 'recurring', r);
    },
    unmarkRecurringPaid(id, month) { const r = db.recurring.find(x => x.id === id); if (!r || !r.paid || !r.paid[month]) return;
      const expId = r.paid[month]; this.removeExpense(expId); delete r.paid[month]; commit('update', 'recurring', r); },
    recurringMonthlyTotal: (domain) => sum(db.recurring.filter(r => r.active !== false && (!domain || r.domain === domain)), r => r.monto),

    // ---------- Préstamos ----------
    loans: () => db.loans,
    addLoan(l) { const row = { id: uid(), prestamista: l.prestamista || '', monto: +l.monto || 0, fecha: l.fecha || today(),
      vencimiento: l.vencimiento || '', interes_pct: +l.interes_pct || 0, notas: l.notas || '', bank_id: l.bank_id || null,
      pagos: [], created_at: now() };
      db.loans.push(row); commit('insert', 'loans', row); return row; },
    updateLoan(id, patch) { const l = db.loans.find(x => x.id === id); if (l) { Object.assign(l, patch); commit('update', 'loans', l); } },
    removeLoan(id) { db.loans = db.loans.filter(x => x.id !== id); commit('delete', 'loans', { id }); },
    payLoan(id, p) { const l = db.loans.find(x => x.id === id); if (!l) return;
      l.pagos = l.pagos || []; l.pagos.push({ id: uid(), monto: +p.monto || 0, fecha: p.fecha || today(), bank_id: p.bank_id || null });
      commit('update', 'loans', l); },
    loanPaid: (l) => sum(l.pagos || [], p => +p.monto || 0),
    loanBalance(l) { return Math.max(0, (+l.monto || 0) - this.loanPaid(l)); },
    loansPendingTotal() { return db.loans.reduce((s, l) => s + this.loanBalance(l), 0); },

    // ---------- Tareas / pendientes ----------
    tasks: () => db.tasks,
    addTask(t) { const row = { id: uid(), texto: (t.texto || '').trim(), fecha: t.fecha || '', done: false, created_at: now() };
      db.tasks.push(row); commit('insert', 'tasks', row); return row; },
    toggleTask(id) { const t = db.tasks.find(x => x.id === id); if (t) { t.done = !t.done; commit('update', 'tasks', t); } },
    updateTask(id, patch) { const t = db.tasks.find(x => x.id === id); if (t) { Object.assign(t, patch); commit('update', 'tasks', t); } },
    removeTask(id) { db.tasks = db.tasks.filter(x => x.id !== id); commit('delete', 'tasks', { id }); },
    clearDoneTasks() { db.tasks = db.tasks.filter(t => !t.done); commit('delete', 'tasks', { done: true }); },
    pendingTasks() { return db.tasks.filter(t => !t.done).length; },

    // ---------- Animales (nacimientos por cantidad) ----------
    animals: () => db.animals,
    loteTotal: totalDe,
    addAnimal(a) {
      const cantidad = Math.max(1, Math.round(+a.cantidad || 1));
      const row = { id: uid(), categoria: a.categoria || 'Ternero', raza: a.raza || '',
        edad_meses: +a.edad_meses || 0, peso: +a.peso || 0, origen: 'nacimiento',
        precio: +a.precio || 0, fecha_ingreso: a.fecha_ingreso || today(), cantidad, created_at: now() };
      db.animals.push(row); commit('insert', 'animals', row); return row;
    },
    updateAnimal(id, patch) { const a = db.animals.find(x => x.id === id); if (!a) return;
      if (patch.cantidad != null) patch.cantidad = Math.max(1, Math.round(+patch.cantidad || 1));
      Object.assign(a, patch); commit('update', 'animals', a); },
    removeAnimal(id) { db.animals = db.animals.filter(a => a.id !== id); commit('delete', 'animals', { id }); },
    bornHeads() { return db.animals.reduce((s, a) => s + (+a.cantidad || 0), 0); },

    // ---------- Muertes (libro independiente: cubre nacidas Y compradas) ----------
    deaths: () => db.deaths,
    addDeath(d) { const row = { id: uid(), cantidad: Math.max(1, Math.round(+d.cantidad || 1)),
      motivo: d.motivo || 'Sin especificar', categoria: d.categoria || '', fecha: d.fecha || today(), created_at: now() };
      db.deaths.push(row); commit('insert', 'deaths', row); return row; },
    removeDeath(id) { db.deaths = db.deaths.filter(x => x.id !== id); commit('delete', 'deaths', { id }); },
    totalMuertes() { return db.deaths.reduce((s, d) => s + (+d.cantidad || 0), 0); },
    deathsByReason() {
      const m = {}; db.deaths.forEach(d => { const k = d.motivo || 'Sin especificar'; m[k] = (m[k] || 0) + (+d.cantidad || 0); });
      return Object.entries(m).map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n);
    },

    // ---------- Inventario de hato ----------
    // Cabezas vivas = nacidas + compradas − vendidas − muertas
    boughtHeads() { return sum(db.purchases.flatMap(p => p.items || []), it => +it.cantidad || 0); },
    soldHeads() { return sum(db.sales.flatMap(s => s.items || []), it => +it.cantidad || 0); },
    headCount() { return this.bornHeads() + this.boughtHeads() - this.soldHeads() - this.totalMuertes(); },

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

    // Serie mensual (últimos n meses) de ingresos vs salidas (todo el negocio)
    monthlySeries(n = 6) {
      const out = [];
      const base = new Date(); base.setDate(1);
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        const ingreso = sum(db.incomes.filter(x => inMonth(x.fecha, key)), x => x.monto)
                      + sum(db.sales.filter(x => inMonth(x.fecha, key)), x => x.total);
        const salida  = sum(db.expenses.filter(x => inMonth(x.fecha, key)), x => x.monto)
                      + sum(db.purchases.filter(x => inMonth(x.fecha, key)), x => x.total);
        out.push({ key, label: d.toLocaleDateString('es-BO', { month: 'short' }), ingreso, salida });
      }
      return out;
    },

    // Desglose por área (ganaderia | personal) — todo el histórico
    domainBreakdown(domain) {
      const exp = db.expenses.filter(x => x.domain === domain);
      const cats = {};
      exp.forEach(x => { cats[x.categoria] = (cats[x.categoria] || 0) + x.monto; });
      let ingreso = sum(db.incomes.filter(x => x.domain === domain), x => x.monto);
      let salida = sum(exp, x => x.monto);
      if (domain === 'ganaderia') {
        const compras = sum(db.purchases, p => p.total);
        const salarios = sum(db.employees.flatMap(e => e.pagos || []), p => p.monto);
        if (compras) { cats['Compra de ganado'] = (cats['Compra de ganado'] || 0) + compras; salida += compras; }
        if (salarios) { cats['Salarios'] = (cats['Salarios'] || 0) + salarios; salida += salarios; }
        ingreso += sum(db.sales, s => s.total);
      }
      const byCategory = Object.entries(cats).map(([cat, monto]) => ({ cat, monto })).sort((a, b) => b.monto - a.monto);
      return { ingreso, salida, balance: ingreso - salida, byCategory };
    },

    syncQueueSize() { try { return JSON.parse(localStorage.getItem(SYNC) || '[]').length; } catch (e) { return 0; } },
    exportJSON: () => JSON.stringify(db, null, 2),

    // Snapshot completo para sincronizar con el servidor
    snapshot: () => db,
    loadSnapshot(obj) { if (obj && typeof obj === 'object') { db = migrate(obj); save(); window.dispatchEvent(new CustomEvent('store:changed')); } },

    // Reiniciar todo (deja sólo bancos/ajustes por defecto, conserva tema y usuario)
    reset() {
      const keepTheme = db.settings.theme, keepUser = db.settings.user;
      db = seed(); db.settings.theme = keepTheme; db.settings.user = keepUser; db.settings.onboarded = true;
      save(); window.dispatchEvent(new CustomEvent('store:changed'));
    },

    // Cargar datos de ejemplo para demo (genera movimientos en los últimos meses)
    loadDemo() {
      this.reset();
      const mAgo = k => { const d = new Date(); d.setMonth(d.getMonth() - k); return d.toISOString().slice(0, 10); };
      const bg = db.banks[0].id, be = db.banks[1].id;
      // Empleados con historial
      const e1 = this.addEmployee({ nombre: 'Ángel Condori', documento: '6786347', puesto: 'Vaquero', telefono: '67863476', salario: 1136.60 });
      const e2 = this.addEmployee({ nombre: 'Juan Pérez', puesto: 'Capataz', salario: 2000 });
      [0, 1, 2].forEach(k => { this.payEmployee(e1.id, { monto: 1136.60, fecha: mAgo(k), bank_id: bg });
        this.payEmployee(e2.id, { monto: 2000, fecha: mAgo(k), bank_id: bg }); });
      // Compras y ventas de ganado
      this.addPurchase({ fecha: mAgo(4), proveedor: 'Hacienda San Juan', bank_id: bg, metodo_pago: 'Transferencia',
        items: [{ categoria: 'Vaca', raza: 'Nelore', cantidad: 10, precio: 3500, edad: 24, sexo: 'Hembra' }] });
      this.addPurchase({ fecha: mAgo(2), proveedor: 'Remate Montero', bank_id: be, metodo_pago: 'Crédito', vencimiento: mAgo(-1),
        items: [{ categoria: 'Toro', raza: 'Brahman', cantidad: 2, precio: 8000, edad: 36, sexo: 'Macho' }] });
      this.addSale({ fecha: mAgo(1), cliente: 'Frigorífico del Este', bank_id: bg, metodo_pago: 'Transferencia',
        items: [{ categoria: 'Novillo', raza: 'Nelore', cantidad: 6, precio: 4200, edad: 30, sexo: 'Macho' }] });
      this.addSale({ fecha: mAgo(0), cliente: 'Mercado local', bank_id: be, metodo_pago: 'Efectivo',
        items: [{ categoria: 'Vaca', raza: 'Criolla', cantidad: 3, precio: 3800, edad: 48, sexo: 'Hembra' }] });
      // Gastos ganadería
      [['Veterinario', 1200, 3], ['Medicamentos', 800, 2], ['Alimentación / Forraje', 3500, 1],
       ['Combustible', 600, 1], ['Veterinario', 950, 0], ['Insumos / Equipos', 1500, 0]].forEach(([c, m, k]) =>
        this.addExpense({ fecha: mAgo(k), domain: 'ganaderia', categoria: c, bank_id: bg, monto: m, descripcion: '' }));
      // Gastos personales
      [['Alimentación', 1800, 2], ['Salud', 700, 2], ['Transporte / Gasolina', 900, 1],
       ['Vivienda', 2500, 1], ['Servicios', 650, 0], ['Alimentación', 1600, 0]].forEach(([c, m, k]) =>
        this.addExpense({ fecha: mAgo(k), domain: 'personal', categoria: c, bank_id: be, monto: m, descripcion: '' }));
      // Ingresos
      this.addIncome({ fecha: mAgo(1), domain: 'ganaderia', categoria: 'Venta de leche', bank_id: bg, monto: 4200 });
      this.addIncome({ fecha: mAgo(0), domain: 'personal', categoria: 'Cafetería', bank_id: be, monto: 5800 });
      // Cuenta por pagar
      this.addPayable({ fecha: mAgo(0), proveedor: 'Veterinaria El Campo', descripcion: 'Vacunas a crédito',
        domain: 'ganaderia', monto_total: 1500, pagado: 500, vencimiento: mAgo(-1) });
      // Préstamo de ejemplo
      const pr1 = this.addLoan({ prestamista: 'Banco Ganadero', monto: 50000, fecha: mAgo(3), vencimiento: mAgo(-6), interes_pct: 8, notas: 'Para compra de ganado' });
      this.payLoan(pr1.id, { monto: 10000, fecha: mAgo(1), bank_id: bg });
      // Animales por lotes (cantidad)
      const l1 = this.addAnimal({ categoria: 'Vaca', raza: 'Nelore', cantidad: 80, edad_meses: 30, peso: 380, origen: 'compra', fecha_ingreso: mAgo(4) });
      const l2 = this.addAnimal({ categoria: 'Toro', raza: 'Brahman', cantidad: 12, edad_meses: 40, peso: 620, origen: 'compra', fecha_ingreso: mAgo(4) });
      this.addAnimal({ categoria: 'Vaquilla', raza: 'Gyr', cantidad: 45, edad_meses: 18, peso: 260, origen: 'nacimiento', fecha_ingreso: mAgo(2) });
      this.addAnimal({ categoria: 'Novillo', raza: 'Criolla', cantidad: 30, edad_meses: 24, peso: 340, origen: 'compra', fecha_ingreso: mAgo(1) });
      // Muertes con motivo (libro de muertes)
      this.addDeath({ cantidad: 3, fecha: mAgo(1), motivo: 'Enfermedad', categoria: 'Vaca' });
      this.addDeath({ cantidad: 1, fecha: mAgo(0), motivo: 'Accidente', categoria: 'Toro' });
      window.dispatchEvent(new CustomEvent('store:changed'));
    },
  };
})();

window.Store = Store;
