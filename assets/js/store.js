/* ============================================================
   store.js — Capa de datos offline-first
   Guarda todo en localStorage (funciona sin internet) y mantiene
   una cola de cambios para sincronizar con Supabase cuando se
   configure la anon key. La UI sólo habla con este módulo.
   ============================================================ */

const Store = (() => {
  const KEY = 'dyck.db.v2';
  const SYNC = 'dyck.syncqueue.v1';

  // Estructura por defecto
  const seed = () => ({
    banks: [
      { id: uid(), name: 'Banco Ganadero', system: true },
      { id: uid(), name: 'Banco Económico', system: true },
      { id: uid(), name: 'Banco Sol', system: true },
      { id: uid(), name: 'Efectivo', system: true },
    ],
    categories: defaultCategories(),
    employees: [],
    transactions: [],
    herd_movements: [],
    budgets: [],
    projections: [],
    settings: { theme: 'rancho', currency: 'Bs', value_per_head: 0 },
  });

  function defaultCategories() {
    const mk = (domain, kind, name, icon) => ({ id: uid(), domain, kind, name, icon, system: true });
    return [
      mk('personal','gasto','Alimentación','utensils'),
      mk('personal','gasto','Salud','health'),
      mk('personal','gasto','Transporte / Gasolina','fuel'),
      mk('personal','gasto','Vivienda','house'),
      mk('personal','gasto','Servicios','plug'),
      mk('personal','gasto','Educación','education'),
      mk('personal','gasto','Otros','dot'),
      mk('personal','ingreso','Sueldo / Negocio','briefcase'),
      mk('personal','ingreso','Cafetería','coffee'),
      mk('personal','ingreso','Otros ingresos','plus'),
      mk('ganaderia','gasto','Veterinario','stethoscope'),
      mk('ganaderia','gasto','Medicamentos','pill'),
      mk('ganaderia','gasto','Alimentación / Forraje','wheat'),
      mk('ganaderia','gasto','Mano de obra / Salarios','workers'),
      mk('ganaderia','gasto','Compra de animales','cow'),
      mk('ganaderia','gasto','Insumos / Equipos','tools'),
      mk('ganaderia','gasto','Combustible','fuel'),
      mk('ganaderia','gasto','Otros','dot'),
      mk('ganaderia','ingreso','Venta de animales','cow'),
      mk('ganaderia','ingreso','Venta de leche','milk'),
      mk('ganaderia','ingreso','Venta de carne','beef'),
      mk('ganaderia','ingreso','Otros ingresos','plus'),
    ];
  }

  function uid() {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn('store load', e); }
    const fresh = seed();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  // Cola de sync: cada cambio queda registrado para empujar a Supabase
  function queue(op, table, row) {
    let q = [];
    try { q = JSON.parse(localStorage.getItem(SYNC) || '[]'); } catch (e) {}
    q.push({ op, table, row, ts: Date.now() });
    localStorage.setItem(SYNC, JSON.stringify(q));
    window.dispatchEvent(new CustomEvent('store:changed'));
  }

  // ---------- API pública ----------
  return {
    uid,
    all: () => db,
    settings: () => db.settings,
    setSetting(k, v) { db.settings[k] = v; persist(); },

    banks: () => db.banks.filter(b => b.active !== false),
    categories: (domain, kind) =>
      db.categories.filter(c => c.active !== false &&
        (!domain || c.domain === domain) && (!kind || c.kind === kind)),
    employees: () => db.employees.filter(e => e.active !== false),

    addBank(name) {
      const b = { id: uid(), name, active: true };
      db.banks.push(b); persist(); queue('insert', 'banks', b); return b;
    },
    addCategory(domain, kind, name, icon) {
      const c = { id: uid(), domain, kind, name, icon: icon || '•', active: true };
      db.categories.push(c); persist(); queue('insert', 'categories', c); return c;
    },
    addEmployee(name, role, salary) {
      const e = { id: uid(), name, role: role || '', monthly_salary: +salary || 0, active: true };
      db.employees.push(e); persist(); queue('insert', 'employees', e); return e;
    },

    transactions: (filter = {}) => {
      let t = [...db.transactions];
      if (filter.domain) t = t.filter(x => x.domain === filter.domain);
      if (filter.kind) t = t.filter(x => x.kind === filter.kind);
      if (filter.month) t = t.filter(x => (x.occurred_on || '').slice(0, 7) === filter.month);
      return t.sort((a, b) => (b.occurred_on || '').localeCompare(a.occurred_on) ||
        (b.created_at || '').localeCompare(a.created_at));
    },

    addTransaction(tx) {
      const row = {
        id: uid(),
        domain: tx.domain, kind: tx.kind,
        amount: +tx.amount || 0,
        category_id: tx.category_id || null,
        bank_id: tx.bank_id || null,
        employee_id: tx.employee_id || null,
        description: tx.description || '',
        occurred_on: tx.occurred_on || today(),
        created_at: new Date().toISOString(),
      };
      db.transactions.push(row); persist(); queue('insert', 'transactions', row);
      return row;
    },
    deleteTransaction(id) {
      db.transactions = db.transactions.filter(t => t.id !== id);
      persist(); queue('delete', 'transactions', { id });
    },

    // ---- Hato ----
    herd: () => db.herd_movements,
    headCount() {
      return db.herd_movements.reduce((n, m) => {
        const q = Math.abs(m.quantity);
        return n + (['nacimiento','compra'].includes(m.kind) ? q
                  : ['venta','muerte'].includes(m.kind) ? -q
                  : m.quantity); // ajuste usa signo propio
      }, 0);
    },
    addHerd(m) {
      const row = { id: uid(), kind: m.kind, quantity: +m.quantity || 0,
        unit_value: m.unit_value != null ? +m.unit_value : null,
        description: m.description || '', occurred_on: m.occurred_on || today(),
        created_at: new Date().toISOString() };
      db.herd_movements.push(row); persist(); queue('insert', 'herd_movements', row);
      return row;
    },

    // ---- Presupuestos ----
    budgets: (month) => db.budgets.filter(b => !month || b.month === month),
    setBudget(domain, category_id, month, amount) {
      let b = db.budgets.find(x => x.domain === domain && x.category_id === category_id && x.month === month);
      if (b) { b.planned_amount = +amount; queue('update', 'budgets', b); }
      else { b = { id: uid(), domain, category_id, month, planned_amount: +amount };
        db.budgets.push(b); queue('insert', 'budgets', b); }
      persist(); return b;
    },

    // ---- Cálculos para dashboard ----
    totals(domain, month) {
      const t = this.transactions({ domain, month });
      const ingreso = t.filter(x => x.kind === 'ingreso').reduce((s, x) => s + x.amount, 0);
      const gasto = t.filter(x => x.kind === 'gasto').reduce((s, x) => s + x.amount, 0);
      return { ingreso, gasto, balance: ingreso - gasto };
    },

    // Promedio de gasto por categoría en los últimos N meses (para proyección)
    avgByCategory(domain, months = 3) {
      const now = new Date();
      const keys = [];
      for (let i = 1; i <= months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(d.toISOString().slice(0, 7));
      }
      const map = {};
      db.transactions
        .filter(x => x.domain === domain && x.kind === 'gasto' && keys.includes((x.occurred_on || '').slice(0, 7)))
        .forEach(x => { map[x.category_id] = (map[x.category_id] || 0) + x.amount; });
      Object.keys(map).forEach(k => map[k] = map[k] / months);
      return map;
    },

    syncQueueSize() {
      try { return JSON.parse(localStorage.getItem(SYNC) || '[]').length; } catch (e) { return 0; }
    },
    exportJSON: () => JSON.stringify(db, null, 2),
  };

  function today() { return new Date().toISOString().slice(0, 10); }
})();

window.Store = Store;
