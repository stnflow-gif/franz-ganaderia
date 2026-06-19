/* ============================================================
   app.js — ERP Dyck Manantial (front-end 100% funcional, local)
   ============================================================ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- Listas de referencia ----------
const THEMES = [
  { id: 'glass',     name: 'Vidrio (oro)', sw: ['#1a1610', '#dcba5e', '#d8cfbc'] },
  { id: 'oro-claro', name: 'Oro claro',   sw: ['#f7f5f1', '#121110', '#c8a44d'] },
  { id: 'oro-noche', name: 'Oro noche',   sw: ['#0d0c0a', '#d8b450', '#f6f2e9'] },
  { id: 'marfil',    name: 'Marfil',      sw: ['#ffffff', '#1c1a14', '#c8a44d'] },
  { id: 'carbon',    name: 'Carbón',      sw: ['#101012', '#d8b450', '#f4f4f5'] },
];
const METODOS = ['Efectivo', 'Transferencia', 'Cheque', 'Crédito'];
const ANIMAL_CATS = ['Vaca', 'Toro', 'Vaquilla', 'Ternero', 'Ternera', 'Novillo', 'Buey'];
const GASTO_CATS = {
  ganaderia: ['Veterinario', 'Medicamentos', 'Alimentación / Forraje', 'Mano de obra', 'Insumos / Equipos', 'Combustible', 'Transporte', 'Otros'],
  personal:  ['Alimentación', 'Salud', 'Transporte / Gasolina', 'Vivienda', 'Servicios', 'Educación', 'Otros'],
};
const INGRESO_CATS = {
  ganaderia: ['Venta de leche', 'Venta de carne', 'Venta de animales', 'Subsidio', 'Otros'],
  personal:  ['Sueldo / Negocio', 'Cafetería', 'Otros ingresos'],
};
const CAT_ICON = {
  Veterinario:'stethoscope', Medicamentos:'pill', 'Alimentación / Forraje':'wheat', 'Mano de obra':'workers',
  'Insumos / Equipos':'tools', Combustible:'fuel', Transporte:'fuel', 'Transporte / Gasolina':'fuel',
  Alimentación:'utensils', Salud:'health', Vivienda:'house', Servicios:'plug', 'Educación':'education',
  'Venta de leche':'milk', 'Venta de carne':'beef', 'Venta de animales':'cow', 'Sueldo / Negocio':'briefcase',
  'Cafetería':'coffee', Subsidio:'coins', 'Otros ingresos':'coins', Otros:'dot',
};

// ---------- Formatos ----------
const money = n => `${Store.settings().currency || 'Bs'} ${(+n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fdate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-BO') : '—';
const monthKey = (dt = new Date()) => dt.toISOString().slice(0, 7);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const opt = (arr, sel) => arr.map(o => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');

const DEATH_REASONS = ['Enfermedad', 'Accidente', 'Parto', 'Depredador', 'Robo', 'Vejez', 'Desconocido', 'Otro'];
const SECTION_TITLES = { dashboard:'Dashboard', ganaderia:'Ganadería', personales:'Gastos personales',
  ingresos:'Ingresos', ajustes:'Ajustes' };

// ============================================================
const App = {
  current: 'dashboard',
  formItems: [],

  init() {
    // Si el tema guardado ya no existe (paletas viejas), volver al dorado por defecto
    if (!THEMES.some(t => t.id === Store.settings().theme)) Store.setSetting('theme', 'glass');
    this.applyTheme(Store.settings().theme || 'glass');
    this.injectIcons();
    this.bindGlobal();
    if (Store.settings().user) this.enterApp(); else this.showLogin();
  },

  injectIcons(root = document) {
    $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon, el.dataset.size ? +el.dataset.size : 20); });
  },

  bindGlobal() {
    const supaConfigured = () => !!(window.SUPA_CONFIG && window.SUPA_CONFIG.anonKey);
    $('#btnGoogle').onclick = () => {
      if (window.Sync) { $('#loginNote').textContent = 'Abriendo Google…'; window.Sync.signInGoogle(); }
      else if (supaConfigured()) toast('Conectando con el servidor, probá de nuevo en un segundo…');
      else this.login('Franz Dyck', 'franz@dyckmanantial.com', 'Google');
    };
    $('#btnLogin').onclick = async () => {
      const email = $('#logEmail').value.trim(), pass = $('#logPass').value;
      if (window.Sync) {
        if (!email || !pass) return toast('Ingresá email y contraseña');
        $('#loginNote').textContent = 'Entrando…';
        let r = await window.Sync.signInPassword(email, pass);
        if (r.error) {                                  // si no existe, crear cuenta
          r = await window.Sync.signUp(email, pass);
          if (r.error) { $('#loginNote').textContent = r.error.message; return; }
          $('#loginNote').textContent = 'Cuenta creada. Si te pide confirmar el email, revisá tu correo.';
        }
      } else if (supaConfigured()) { toast('Conectando con el servidor, probá de nuevo en un segundo…'); }
      else { this.login('Franz Dyck', email || 'franz@dyckmanantial.com', 'email'); }
    };
    $('#btnLogout').onclick = async () => { if (window.Sync) { try { await window.Sync.signOut(); } catch (e) {} } Store.setSetting('user', null); location.reload(); };
    $$('#nav button, #btnSettings').forEach(b => b.onclick = () => { this.go(b.dataset.go); this.closeDrawer(); });
    $('#fabQuick').onclick = () => this.quickExpense();
    $('#ham').onclick = () => $('#sidebar').classList.toggle('open') | $('#scrim').classList.toggle('open');
    $('#scrim').onclick = () => this.closeDrawer();
    $('#modalClose').onclick = () => this.closeModal();
    $('#modalBg').onclick = e => { if (e.target === $('#modalBg')) this.closeModal(); };
  },

  closeDrawer() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); },

  // ---------- Auth (visual; backend pendiente) ----------
  login(name, email, via) {
    Store.setSetting('user', { name, email, via });
    this.enterApp();
  },
  showLogin() { $('#loginScreen').classList.remove('hidden'); $('#shell').classList.add('hidden'); $('#fabQuick').classList.add('hidden'); },
  enterApp() {
    const u = Store.settings().user || { name: 'Franz Dyck', email: 'modo local' };
    $('#loginScreen').classList.add('hidden'); $('#shell').classList.remove('hidden'); $('#fabQuick').classList.remove('hidden');
    $('#userName').textContent = u.name; $('#userEmail').textContent = u.email;
    $('#userAv').textContent = (u.name || 'F').charAt(0).toUpperCase();
    this.go('dashboard');
    if (!Store.settings().onboarded) setTimeout(() => this.startTour(), 500);
  },

  // ---------- Router ----------
  go(section) {
    this.current = section;
    $$('.screen').forEach(s => s.classList.remove('on'));
    $(`#screen-${section}`).classList.add('on');
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === section));
    $('#mobileTitle').textContent = SECTION_TITLES[section] || '';
    this.render(section);
    $('.main').scrollTop = 0; window.scrollTo(0, 0);
  },
  render(section) {
    const map = { dashboard:'renderDashboard', ganaderia:'renderGanaderia', personales:'renderPersonales',
      ingresos:'renderIngresos', ajustes:'renderAjustes' };
    if (map[section]) this[map[section]]();
  },
  refresh() { this.render(this.current); },

  head(title, sub, actionLabel, actionIcon, actionFn) {
    const btn = actionLabel ? `<button class="btn btn-primary" data-headaction><span data-icon="${actionIcon||'plus'}"></span> ${esc(actionLabel)}</button>` : '';
    if (actionFn) this._pendingHeadFn = actionFn;
    return `<div class="page"><div class="page-head"><div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>${btn}</div>`;
  },
  paint(section, html) {
    const el = $(`#screen-${section}`); el.innerHTML = html + `</div>`; this.injectIcons(el);
    const ha = $('[data-headaction]', el);
    if (ha && this._pendingHeadFn) { const fn = this._pendingHeadFn; ha.onclick = fn; }
    this._pendingHeadFn = null;
  },

  // ============================================================
  //  DASHBOARD
  // ============================================================
  renderDashboard() {
    const f = Store.finance();
    const head = Store.headCount();
    const stat = (lbl, val, ic, cls, hint) => `<div class="stat"><div class="top"><div class="lbl">${lbl}</div>
      <div class="ico"><span data-icon="${ic}"></span></div></div><div class="val ${cls||''}">${val}</div>
      ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
    let h = this.head('Dashboard Financiero', 'Resumen completo de la situación');
    h += `<div class="stat-grid">
      ${stat('Saldo Total', money(f.saldoTotal), 'wallet', '', 'En cuentas bancarias')}
      ${stat('Por Cobrar', money(f.porCobrar), 'trending', 'income', 'Pendiente de recibir')}
      ${stat('Por Pagar', money(f.porPagar), 'arrowDown', 'expense', 'Pendiente de pagar')}
      ${stat('Total Ventas', money(f.totalVentas), 'arrowUp', 'income', 'Ingresos por ganado')}
      ${stat('Total Compras', money(f.totalCompras), 'cart', 'warn', 'Inversión en ganado')}
      ${stat('Total Gastos', money(f.totalGastos), 'arrowDown', 'expense', 'Gastos operativos')}
      <div class="stat feature"><div class="top"><div class="lbl">Saldo Neto Proyectado</div>
        <div class="ico"><span data-icon="sparkles"></span></div></div>
        <div class="val">${money(f.saldoNeto)}</div>
        <div class="hint">Saldo total + cuentas por cobrar − cuentas por pagar</div></div>
    </div>`;

    // ----- Gráfico: ingresos vs salidas por mes -----
    const serie = Store.monthlySeries(6);
    h += `<div class="section"><div class="section-title"><span data-icon="chart"></span> Ingresos vs Salidas (últimos 6 meses)</div>
      <div class="panel"><div class="panel-body" style="padding:22px">
        <div class="chart-legend">
          <span><i class="dotc gold"></i> Ingresos</span>
          <span><i class="dotc dark"></i> Salidas</span>
        </div>
        ${this.barChart(serie)}
      </div></div></div>`;

    // ----- Dos columnas: Ganadería / Vida Personal -----
    h += `<div class="section"><div class="two-col">
      ${this.domainColumn('ganaderia', 'Ganadería', 'cow')}
      ${this.domainColumn('personal', 'Vida Personal', 'user')}
    </div></div>`;

    // ----- Resumen del hato -----
    h += `<div class="section"><div class="section-title"><span data-icon="cow"></span> Resumen del hato</div>
      <div class="stat-grid">
        ${stat('Cabezas de ganado', head, 'cow', '', 'Compras − ventas')}
        ${stat('Empleados activos', Store.activeEmployees().length, 'workers', '', 'Nómina ' + money(Store.nominaMensual()))}
        ${stat('Ingresos del mes', money(Store.finance(monthKey()).totalIngresos), 'coins', 'income', 'Otros ingresos')}
      </div></div>`;
    this.paint('dashboard', h);
  },

  // Gráfico de barras SVG (ingresos vs salidas)
  barChart(serie) {
    const max = Math.max(1, ...serie.flatMap(s => [s.ingreso, s.salida]));
    const W = 720, H = 220, pad = 28, bw = 16, gap = 6;
    const n = serie.length;
    const slot = (W - pad * 2) / n;
    const y = v => H - pad - (v / max) * (H - pad * 2);
    const allZero = serie.every(s => !s.ingreso && !s.salida);
    const bars = serie.map((s, i) => {
      const cx = pad + slot * i + slot / 2;
      const x1 = cx - bw - gap / 2, x2 = cx + gap / 2;
      const yi = y(s.ingreso), ye = y(s.salida);
      return `
        <rect x="${x1}" y="${yi}" width="${bw}" height="${H - pad - yi}" rx="4" fill="var(--c-gold)"></rect>
        <rect x="${x2}" y="${ye}" width="${bw}" height="${H - pad - ye}" rx="4" fill="var(--c-text)" opacity=".82"></rect>
        <text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="12" fill="var(--c-muted)">${esc(s.label)}</text>`;
    }).join('');
    return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="xMidYMid meet">
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="var(--c-border-2)"></line>
      ${bars}
      ${allZero ? `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="14" fill="var(--c-muted)">Sin datos aún — cargá movimientos para ver el gráfico</text>` : ''}
    </svg></div>`;
  },

  // Columna de área (ganadería / personal)
  domainColumn(domain, title, ic) {
    const d = Store.domainBreakdown(domain);
    const maxCat = Math.max(1, ...d.byCategory.map(c => c.monto));
    const cats = d.byCategory.slice(0, 6);
    return `<div class="col-panel ${domain}">
      <div class="col-head"><span class="ic-box" data-icon="${ic}"></span><h3>${esc(title)}</h3></div>
      <div class="col-stats">
        <div><span class="k">Ingresos</span><span class="v income">${money(d.ingreso)}</span></div>
        <div><span class="k">Salidas</span><span class="v expense">${money(d.salida)}</span></div>
        <div><span class="k">Balance</span><span class="v ${d.balance >= 0 ? 'gold' : 'expense'}">${money(d.balance)}</span></div>
      </div>
      <div class="col-cats">
        <div class="cc-title">Desglose de salidas</div>
        ${cats.length ? cats.map(c => `
          <div class="cat-row">
            <div class="cat-top"><span><span data-icon="${CAT_ICON[c.cat] || 'dot'}" data-size="15"></span> ${esc(c.cat)}</span><b>${money(c.monto)}</b></div>
            <div class="cat-track"><div class="cat-fill" style="width:${Math.max(4, (c.monto / maxCat) * 100)}%"></div></div>
          </div>`).join('') : `<div class="empty" style="padding:18px">Sin salidas en esta área.</div>`}
      </div>
    </div>`;
  },

  // ============================================================
  //  GANADERÍA (hub con sub-secciones)
  // ============================================================
  renderGanaderia() {
    if (!this.ganTab) this.ganTab = 'resumen';
    const t = this.ganTab;
    const tabs = [['resumen','Resumen','chart'],['animales','Animales','cow'],['compras','Compras','cart'],
      ['ventas','Ventas','trending'],['gastos','Gastos','arrowDown'],['empleados','Empleados','workers'],['deudas','Deudas','receipt']];
    let h = this.head('Ganadería', 'Operación del campo');
    h += `<div class="subtabs">${tabs.map(([k, l, ic]) =>
      `<button class="subtab ${k === t ? 'on' : ''}" data-sub="${k}"><span data-icon="${ic}" data-size="17"></span> ${l}</button>`).join('')}</div>`;
    h += `<div class="subtab-body">${this['gan_' + t]()}</div>`;
    this.paint('ganaderia', h);
    const root = $('#screen-ganaderia');
    $$('.subtab', root).forEach(b => b.onclick = () => { this.ganTab = b.dataset.sub; this.renderGanaderia(); });
    const addMap = { animales:() => this.formAnimal(), compras:() => this.formCompra(), ventas:() => this.formVenta(),
      gastos:() => this.formExpense('ganaderia'), empleados:() => this.formEmpleado(), deudas:() => this.formSalida() };
    const add = $('#subAdd', root); if (add && addMap[t]) add.onclick = addMap[t];
    this.bindGan(root, t);
  },

  panelAdd(title, addLabel, addIcon, inner) {
    return `<div class="panel"><div class="panel-head"><h3>${esc(title)}</h3>
      <button class="btn btn-primary btn-sm" id="subAdd"><span data-icon="${addIcon}"></span> ${esc(addLabel)}</button></div>
      <div class="panel-body">${inner}</div></div>`;
  },
  miniStats(items) {
    return `<div class="stat-grid" style="margin-bottom:20px">${items.map(([l, v, ic, cls, hint]) =>
      `<div class="stat"><div class="top"><div class="lbl">${l}</div><div class="ico"><span data-icon="${ic}"></span></div></div>
        <div class="val ${cls || ''}">${v}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`).join('')}</div>`;
  },

  // ----- Resumen -----
  gan_resumen() {
    const f = Store.domainBreakdown('ganaderia');
    const reasons = Store.deathsByReason();
    const maxR = Math.max(1, ...reasons.map(r => r.n));
    let h = this.miniStats([
      ['Cabezas vivas', Store.headCount(), 'cow', '', 'Animales activos'],
      ['Muertes', Store.deaths().length, 'skull', 'expense', 'Total registradas'],
      ['Ingresos ganadería', money(f.ingreso), 'coins', 'income', 'Ventas + otros'],
      ['Salidas ganadería', money(f.salida), 'arrowDown', 'expense', 'Compras, gastos, salarios'],
    ]);
    h += this.panel('Muertes por motivo', reasons.length ? `<div style="padding:8px 22px 18px">${reasons.map(r => `
        <div class="cat-row"><div class="cat-top"><span><span data-icon="skull" data-size="15"></span> ${esc(r.motivo)}</span><b>${r.n}</b></div>
        <div class="cat-track"><div class="cat-fill" style="width:${(r.n / maxR) * 100}%"></div></div></div>`).join('')}</div>`
      : this.emptyState('skull', 'Sin muertes registradas. Registrá los animales en la pestaña Animales.'));
    return h;
  },

  // ----- Animales (registro individual) -----
  gan_animales() {
    const all = Store.animals();
    const vivos = all.filter(a => a.estado === 'vivo').length;
    const muertos = all.filter(a => a.estado === 'muerto').length;
    const vendidos = all.filter(a => a.estado === 'vendido').length;
    const badge = e => e === 'muerto' ? '<span class="badge pend">Muerto</span>'
      : e === 'vendido' ? '<span class="badge off">Vendido</span>' : '<span class="badge ok">Vivo</span>';
    const table = all.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Código</th><th>Categoría</th><th>Raza</th><th>Sexo</th><th>Edad</th><th>Estado</th><th>Motivo / baja</th><th>Acciones</th></tr></thead>
      <tbody>${all.slice().reverse().map(a => `<tr>
        <td><b>${esc(a.codigo || '—')}</b></td><td>${esc(a.categoria)}</td><td>${esc(a.raza || '—')}</td><td>${esc(a.sexo)}</td>
        <td>${a.edad_meses || 0} m</td><td>${badge(a.estado)}</td>
        <td>${a.estado === 'muerto' ? esc(a.motivo) + ' · ' + fdate(a.fecha_baja) : a.estado === 'vendido' ? 'Vendido ' + fdate(a.fecha_baja) : '—'}</td>
        <td class="actions">
          ${a.estado === 'vivo' ? `<button class="iconbtn danger" data-kill="${a.id}" title="Registrar muerte"><span data-icon="skull" data-size="16"></span></button>` : `<button class="iconbtn ok" data-revive="${a.id}" title="Marcar vivo"><span data-icon="check" data-size="16"></span></button>`}
          <button class="iconbtn" data-edit="${a.id}" title="Editar"><span data-icon="edit" data-size="16"></span></button>
          <button class="iconbtn danger" data-del="${a.id}" title="Eliminar"><span data-icon="trash" data-size="16"></span></button>
        </td></tr>`).join('')}</tbody></table></div>` : this.emptyState('cow', 'Sin animales. Registrá tu primera cabeza con el botón de arriba.');
    return this.miniStats([
      ['Vivos', vivos, 'cow', 'income'], ['Muertos', muertos, 'skull', 'expense'], ['Vendidos', vendidos, 'cash', ''],
    ]) + this.panelAdd('Registro de animales', 'Registrar animal', 'plus', table);
  },

  // ----- Compras -----
  gan_compras() {
    const rows = Store.purchases().slice().reverse();
    const table = rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Fecha</th><th>Proveedor</th><th>Animales</th><th>Banco</th><th>Método</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${rows.map(p => `<tr><td>${fdate(p.fecha)}</td><td>${esc(p.proveedor || '—')}</td>
        <td>${(p.items || []).reduce((s, i) => s + (+i.cantidad || 0), 0)} cab.</td>
        <td>${esc(Store.bankName(p.bank_id))}</td>
        <td><span class="badge ${p.metodo_pago === 'Crédito' ? 'pend' : 'off'}">${esc(p.metodo_pago)}</span></td>
        <td class="num">${money(p.total)}</td>
        <td class="actions"><button class="iconbtn danger" data-del="${p.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('cart', 'Sin compras registradas.');
    return this.panelAdd('Compras de ganado', 'Nueva compra', 'cart', table);
  },

  // ----- Ventas -----
  gan_ventas() {
    const rows = Store.sales().slice().reverse();
    const table = rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Animales</th><th>Banco</th><th>Método</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${rows.map(s => `<tr><td>${fdate(s.fecha)}</td><td>${esc(s.cliente || '—')}</td>
        <td>${(s.items || []).reduce((a, i) => a + (+i.cantidad || 0), 0)} cab.</td>
        <td>${esc(Store.bankName(s.bank_id))}</td>
        <td><span class="badge ${s.metodo_pago === 'Crédito' ? 'pend' : 'off'}">${esc(s.metodo_pago)}</span></td>
        <td class="num">${money(s.total)}</td>
        <td class="actions"><button class="iconbtn danger" data-del="${s.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('trending', 'Sin ventas registradas.');
    return `<p class="muted" style="font-size:13px;margin-bottom:14px">Las ventas también aparecen en la pestaña <b>Ingresos</b> y suman al Dashboard.</p>`
      + this.panelAdd('Ventas de ganado', 'Nueva venta', 'trending', table);
  },

  // ----- Gastos de ganadería -----
  gan_gastos() {
    const rows = Store.expenses().filter(x => x.domain === 'ganaderia').slice().reverse();
    return this.panelAdd('Gastos de ganadería', 'Nuevo gasto', 'arrowDown', this.expenseTable(rows));
  },
  expenseTable(rows) {
    return rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Fecha</th><th>Categoría</th><th>Banco</th><th>Detalle</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${rows.map(x => `<tr><td>${fdate(x.fecha)}</td>
        <td><span style="display:inline-flex;align-items:center;gap:7px"><span data-icon="${CAT_ICON[x.categoria] || 'dot'}" data-size="17"></span>${esc(x.categoria)}</span></td>
        <td>${esc(Store.bankName(x.bank_id))}</td><td>${esc(x.descripcion || '—')}</td>
        <td class="num"><span class="pill-amount expense">− ${money(x.monto)}</span></td>
        <td class="actions"><button class="iconbtn danger" data-del="${x.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('arrowDown', 'Sin gastos registrados.');
  },

  // ----- Empleados -----
  gan_empleados() {
    const emps = Store.employees();
    const table = emps.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Nombre</th><th>Documento</th><th>Puesto</th><th>Teléfono</th><th class="num">Salario</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${emps.map(e => `<tr><td><b>${esc(e.nombre)}</b></td><td>${esc(e.documento || '—')}</td><td>${esc(e.puesto)}</td><td>${esc(e.telefono || '—')}</td>
        <td class="num">${money(e.salario)}</td>
        <td><span class="badge ${e.estado === 'inactivo' ? 'off' : 'ok'}">${e.estado === 'inactivo' ? 'Inactivo' : 'Activo'}</span></td>
        <td class="actions">
          <button class="iconbtn" data-hist="${e.id}" title="Historial"><span data-icon="eye" data-size="17"></span></button>
          <button class="iconbtn ok" data-paye="${e.id}" title="Registrar pago"><span data-icon="cash" data-size="17"></span></button>
          <button class="iconbtn" data-edite="${e.id}" title="Editar"><span data-icon="edit" data-size="17"></span></button>
          <button class="iconbtn danger" data-dele="${e.id}" title="Eliminar"><span data-icon="trash" data-size="17"></span></button>
        </td></tr>`).join('')}</tbody></table></div>` : this.emptyState('workers', 'Sin empleados. Agregá el primero.');
    return this.miniStats([
      ['Total', emps.length, 'workers'], ['Activos', emps.filter(e => e.estado !== 'inactivo').length, 'check', 'income'],
      ['Nómina mensual', money(Store.nominaMensual()), 'coins'],
    ]) + this.panelAdd('Empleados', 'Nuevo empleado', 'workers', table);
  },

  // ----- Deudas (cuentas por pagar) -----
  gan_deudas() {
    const rows = Store.payables();
    const totalPagar = rows.filter(p => p.estado !== 'pagado').reduce((s, p) => s + (p.monto_total - p.pagado), 0);
    const table = rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Proveedor</th><th>Descripción</th><th>Área</th><th class="num">Total</th><th class="num">Pagado</th><th class="num">Pendiente</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows.slice().reverse().map(p => `<tr><td>${esc(p.proveedor || '—')}</td><td>${esc(p.descripcion || '—')}</td>
        <td><span class="badge ${p.domain === 'personal' ? 'per' : 'gan'}">${p.domain === 'personal' ? 'Personal' : 'Ganadería'}</span></td>
        <td class="num">${money(p.monto_total)}</td><td class="num">${money(p.pagado)}</td><td class="num">${money(p.monto_total - p.pagado)}</td>
        <td>${fdate(p.vencimiento)}</td><td><span class="badge ${p.estado === 'pagado' ? 'ok' : 'pend'}">${p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span></td>
        <td class="actions">${p.estado !== 'pagado' ? `<button class="iconbtn ok" data-pay="${p.id}" title="Marcar pagado"><span data-icon="check" data-size="17"></span></button>` : ''}
          <button class="iconbtn danger" data-del="${p.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('receipt', 'Sin cuentas por pagar.');
    return this.miniStats([['Total por pagar', money(totalPagar), 'arrowDown', 'expense'],
      ['Cuentas', rows.length, 'receipt'], ['Pendientes', rows.filter(p => p.estado !== 'pagado').length, 'clock', 'warn']])
      + this.panelAdd('Cuentas por pagar', 'Nueva cuenta', 'receipt', table);
  },

  // ----- Binding de filas según sub-tab -----
  bindGan(root, t) {
    if (t === 'compras') $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removePurchase(b.dataset.del)));
    if (t === 'ventas') $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeSale(b.dataset.del)));
    if (t === 'gastos') $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeExpense(b.dataset.del)));
    if (t === 'deudas') {
      $$('[data-pay]', root).forEach(b => b.onclick = () => { Store.payPayable(b.dataset.pay); toast('Marcado como pagado'); this.refresh(); });
      $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removePayable(b.dataset.del)));
    }
    if (t === 'empleados') {
      $$('[data-hist]', root).forEach(b => b.onclick = () => this.empleadoHist(b.dataset.hist));
      $$('[data-paye]', root).forEach(b => b.onclick = () => this.formPagoEmpleado(b.dataset.paye));
      $$('[data-edite]', root).forEach(b => b.onclick = () => this.formEmpleado(b.dataset.edite));
      $$('[data-dele]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeEmployee(b.dataset.dele)));
    }
    if (t === 'animales') {
      $$('[data-kill]', root).forEach(b => b.onclick = () => this.killAnimalModal(b.dataset.kill));
      $$('[data-revive]', root).forEach(b => b.onclick = () => { Store.reviveAnimal(b.dataset.revive); toast('Marcado vivo'); this.refresh(); });
      $$('[data-edit]', root).forEach(b => b.onclick = () => this.formAnimal(b.dataset.edit));
      $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeAnimal(b.dataset.del)));
    }
  },

  // ----- Form animal -----
  formAnimal(id) {
    const a = id ? Store.animals().find(x => x.id === id) : {};
    const body = `<div class="form-grid">
      <div class="field"><label>Código / Arete</label><div class="control"><input id="anCod" value="${esc(a.codigo || '')}" placeholder="Ej: VAC-001"></div></div>
      <div class="field"><label>Categoría</label><select class="control" id="anCat">${opt(ANIMAL_CATS, a.categoria || 'Vaca')}</select></div>
      <div class="field"><label>Raza</label><div class="control"><input id="anRaza" value="${esc(a.raza || '')}" placeholder="Ej: Nelore"></div></div>
      <div class="field"><label>Sexo</label><select class="control" id="anSexo">${opt(['Hembra','Macho'], a.sexo || 'Hembra')}</select></div>
      <div class="field"><label>Edad (meses)</label><div class="control"><input type="number" id="anEdad" value="${a.edad_meses || 0}"></div></div>
      <div class="field"><label>Peso (kg)</label><div class="control"><input type="number" id="anPeso" value="${a.peso || 0}"></div></div>
      <div class="field"><label>Origen</label><select class="control" id="anOrig">${opt(['compra','nacimiento','otro'], a.origen || 'compra')}</select></div>
      <div class="field"><label>Fecha de ingreso</label><div class="control"><input type="date" id="anFecha" value="${a.fecha_ingreso || Store.today()}"></div></div>
    </div>`;
    this.openModal(id ? 'Editar animal' : 'Registrar animal', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const data = { codigo: $('#anCod').value.trim(), categoria: $('#anCat').value, raza: $('#anRaza').value.trim(),
          sexo: $('#anSexo').value, edad_meses: +$('#anEdad').value || 0, peso: +$('#anPeso').value || 0,
          origen: $('#anOrig').value, fecha_ingreso: $('#anFecha').value };
        id ? Store.updateAnimal(id, data) : Store.addAnimal(data);
        this.closeModal(); toast('Animal guardado'); this.refresh();
      } },
    ]);
  },
  killAnimalModal(id) {
    const a = Store.animals().find(x => x.id === id); if (!a) return;
    const body = `<p class="sub" style="margin-bottom:16px;color:var(--c-muted)">Registrar baja de <b>${esc(a.codigo || a.categoria)}</b></p>
      <div class="form-grid">
        <div class="field"><label>Motivo</label><select class="control" id="kMot">${opt(DEATH_REASONS, 'Enfermedad')}</select></div>
        <div class="field"><label>Fecha</label><div class="control"><input type="date" id="kFecha" value="${Store.today()}"></div></div>
      </div>`;
    this.openModal('Registrar muerte', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Registrar muerte', cls: 'btn-danger', icon: 'skull', fn: () => {
        Store.killAnimal(id, { motivo: $('#kMot').value, fecha: $('#kFecha').value });
        this.closeModal(); toast('Muerte registrada'); this.refresh();
      } },
    ]);
  },

  formCompra() {
    this.formItems = [];
    const banks = Store.banks();
    const body = `
      <div class="form-grid">
        <div class="field"><label>Fecha <span class="req">*</span></label><div class="control"><input type="date" id="cFecha" value="${Store.today()}"></div></div>
        <div class="field"><label>Proveedor <span class="req">*</span></label><div class="control"><input id="cProv" placeholder="Nombre del proveedor"></div></div>
        <div class="field"><label>Cuenta Bancaria</label><select class="control" id="cBank"><option value="">Ninguna</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Método de Pago</label><select class="control" id="cMetodo">${opt(METODOS, 'Efectivo')}</select></div>
        <div class="field col-2"><label>Observaciones</label><textarea class="control" id="cObs" placeholder="Notas adicionales"></textarea></div>
      </div>
      <div class="section-title" style="margin-top:18px"><span data-icon="cow"></span> Agregar animales</div>
      <div class="form-grid">
        <div class="field"><label>Categoría</label><select class="control" id="aCat">${opt(ANIMAL_CATS, 'Vaca')}</select></div>
        <div class="field"><label>Raza</label><div class="control"><input id="aRaza" placeholder="Raza del animal"></div></div>
        <div class="field"><label>Cantidad</label><div class="control"><input type="number" id="aCant" value="1" min="1"></div></div>
        <div class="field"><label>Precio Unitario</label><div class="control"><span class="prefix">Bs</span><input type="number" id="aPrecio" value="0"></div></div>
        <div class="field"><label>Edad (meses)</label><div class="control"><input type="number" id="aEdad" value="0"></div></div>
        <div class="field"><label>Sexo</label><select class="control" id="aSexo">${opt(['Macho','Hembra'],'Macho')}</select></div>
      </div>
      <button class="btn btn-ghost btn-sm" id="addItem" style="margin-top:10px"><span data-icon="plus"></span> Agregar animal a la lista</button>
      <div id="itemsBox"></div>`;
    this.openModal('Registrar Nueva Compra', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar Compra', cls: 'btn-primary', icon: 'check', fn: () => this.saveCompra() },
    ]);
    $('#addItem').onclick = () => {
      const it = { categoria: $('#aCat').value, raza: $('#aRaza').value, cantidad: +$('#aCant').value || 1,
        precio: +$('#aPrecio').value || 0, edad: +$('#aEdad').value || 0, sexo: $('#aSexo').value };
      this.formItems.push(it); $('#aRaza').value = ''; $('#aPrecio').value = '0';
      this.renderFormItems();
    };
  },
  renderFormItems() {
    const box = $('#itemsBox'); if (!box) return;
    if (!this.formItems.length) { box.innerHTML = ''; return; }
    const total = this.formItems.reduce((s, i) => s + i.cantidad * i.precio, 0);
    box.innerHTML = `<table class="subtable"><thead><tr><th>Categoría</th><th>Raza</th><th>Cant.</th><th>P.Unit</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>${this.formItems.map((i, ix) => `<tr><td>${esc(i.categoria)}</td><td>${esc(i.raza || '—')}</td>
        <td>${i.cantidad}</td><td>${money(i.precio)}</td><td>${money(i.cantidad * i.precio)}</td>
        <td><button class="iconbtn danger" data-rm="${ix}"><span data-icon="close" data-size="15"></span></button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right;font-weight:800">Total</td><td style="font-weight:800">${money(total)}</td><td></td></tr></tfoot></table>`;
    this.injectIcons(box);
    $$('[data-rm]', box).forEach(b => b.onclick = () => { this.formItems.splice(+b.dataset.rm, 1); this.renderFormItems(); });
  },
  saveCompra() {
    const prov = $('#cProv').value.trim();
    if (!prov) return toast('Falta el proveedor');
    if (!this.formItems.length) return toast('Agregá al menos un animal');
    Store.addPurchase({ fecha: $('#cFecha').value, proveedor: prov, bank_id: $('#cBank').value || null,
      metodo_pago: $('#cMetodo').value, observaciones: $('#cObs').value, items: this.formItems });
    this.closeModal(); toast('Compra registrada'); this.refresh();
  },

  formVenta() {
    this.formItems = [];
    const banks = Store.banks();
    const body = `<div class="form-grid">
        <div class="field"><label>Fecha <span class="req">*</span></label><div class="control"><input type="date" id="vFecha" value="${Store.today()}"></div></div>
        <div class="field"><label>Cliente <span class="req">*</span></label><div class="control"><input id="vCli" placeholder="Nombre del cliente"></div></div>
        <div class="field"><label>Banco que recibe</label><select class="control" id="vBank"><option value="">Ninguna</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Método de Pago</label><select class="control" id="vMetodo">${opt(METODOS, 'Efectivo')}</select></div>
        <div class="field col-2"><label>Observaciones</label><textarea class="control" id="vObs" placeholder="Notas adicionales"></textarea></div>
      </div>
      <div class="section-title" style="margin-top:18px"><span data-icon="cow"></span> Animales vendidos</div>
      <div class="form-grid">
        <div class="field"><label>Categoría</label><select class="control" id="aCat">${opt(ANIMAL_CATS, 'Vaca')}</select></div>
        <div class="field"><label>Raza</label><div class="control"><input id="aRaza" placeholder="Raza"></div></div>
        <div class="field"><label>Cantidad</label><div class="control"><input type="number" id="aCant" value="1" min="1"></div></div>
        <div class="field"><label>Precio Unitario</label><div class="control"><span class="prefix">Bs</span><input type="number" id="aPrecio" value="0"></div></div>
        <div class="field"><label>Edad (meses)</label><div class="control"><input type="number" id="aEdad" value="0"></div></div>
        <div class="field"><label>Sexo</label><select class="control" id="aSexo">${opt(['Macho','Hembra'],'Macho')}</select></div>
      </div>
      <button class="btn btn-ghost btn-sm" id="addItem" style="margin-top:10px"><span data-icon="plus"></span> Agregar animal</button>
      <div id="itemsBox"></div>`;
    this.openModal('Registrar Nueva Venta', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar Venta', cls: 'btn-primary', icon: 'check', fn: () => this.saveVenta() },
    ]);
    $('#addItem').onclick = () => {
      this.formItems.push({ categoria: $('#aCat').value, raza: $('#aRaza').value, cantidad: +$('#aCant').value || 1,
        precio: +$('#aPrecio').value || 0, edad: +$('#aEdad').value || 0, sexo: $('#aSexo').value });
      $('#aRaza').value = ''; $('#aPrecio').value = '0'; this.renderFormItems();
    };
  },
  saveVenta() {
    const cli = $('#vCli').value.trim();
    if (!cli) return toast('Falta el cliente');
    if (!this.formItems.length) return toast('Agregá al menos un animal');
    Store.addSale({ fecha: $('#vFecha').value, cliente: cli, bank_id: $('#vBank').value || null,
      metodo_pago: $('#vMetodo').value, observaciones: $('#vObs').value, items: this.formItems });
    this.closeModal(); toast('Venta registrada'); this.refresh();
  },

  // ============================================================
  //  GASTOS PERSONALES
  // ============================================================
  renderPersonales() {
    const rows = Store.expenses().filter(x => x.domain === 'personal').slice().reverse();
    const total = rows.reduce((s, x) => s + x.monto, 0);
    let h = this.head('Gastos personales', 'Tus salidas de la vida personal', 'Nuevo gasto', 'arrowDown', () => this.formExpense('personal'));
    h += this.miniStats([['Total gastado', money(total), 'arrowDown', 'expense'], ['Movimientos', rows.length, 'receipt']]);
    h += this.panel('Historial de gastos personales', this.expenseTable(rows));
    this.paint('personales', h);
    $$('#screen-personales [data-del]').forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeExpense(b.dataset.del)));
  },

  // ============================================================
  //  INGRESOS (unificado: ingresos + ventas de ganado)
  // ============================================================
  renderIngresos() {
    const inc = Store.incomes().map(x => ({ k: 'inc', id: x.id, fecha: x.fecha, fuente: x.categoria, area: x.domain,
      bank: x.bank_id, monto: x.monto, det: x.descripcion || '—', venta: false }));
    const sal = Store.sales().map(s => ({ k: 'sale', id: s.id, fecha: s.fecha, fuente: 'Venta de ganado' + (s.cliente ? ' — ' + s.cliente : ''),
      area: 'ganaderia', bank: s.bank_id, monto: s.total, det: (s.items || []).reduce((a, i) => a + (+i.cantidad || 0), 0) + ' cab.', venta: true }));
    const rows = [...inc, ...sal].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const total = rows.reduce((s, r) => s + r.monto, 0);
    let h = this.head('Ingresos', 'Todo lo que entra — ganadería y personal', 'Nuevo ingreso', 'coins', () => this.formIncome());
    h += this.miniStats([['Total ingresos', money(total), 'coins', 'income'], ['Movimientos', rows.length, 'receipt']]);
    h += this.panel('Historial de ingresos', rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Fecha</th><th>Fuente</th><th>Área</th><th>Banco</th><th>Detalle</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${fdate(r.fecha)}</td>
        <td><span style="display:inline-flex;align-items:center;gap:7px"><span data-icon="${r.venta ? 'cow' : (CAT_ICON[r.fuente] || 'coins')}" data-size="17"></span>${esc(r.fuente)}</span></td>
        <td><span class="badge ${r.area === 'personal' ? 'per' : 'gan'}">${r.area === 'personal' ? 'Personal' : 'Ganadería'}</span></td>
        <td>${esc(Store.bankName(r.bank))}</td><td>${esc(r.det)}</td>
        <td class="num"><span class="pill-amount income">+ ${money(r.monto)}</span></td>
        <td class="actions"><button class="iconbtn danger" data-${r.k}="${r.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('coins', 'Sin ingresos. Las ventas de ganado también aparecen acá.'));
    this.paint('ingresos', h);
    const root = $('#screen-ingresos');
    $$('[data-inc]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeIncome(b.dataset.inc)));
    $$('[data-sale]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeSale(b.dataset.sale)));
  },

  // ----- Formulario de gasto (área fija) -----
  formExpense(domain) {
    const cats = GASTO_CATS[domain]; const banks = Store.banks();
    const label = domain === 'personal' ? 'Gasto personal' : 'Gasto de ganadería';
    const body = `<div class="form-grid">
        <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input class="amount-big" type="number" id="exMonto" placeholder="0"></div></div>
        <div class="field"><label>Fecha</label><div class="control"><input type="date" id="exFecha" value="${Store.today()}"></div></div>
        <div class="field"><label>Categoría</label><select class="control" id="exCat">${opt(cats)}</select></div>
        <div class="field"><label>Banco</label><select class="control" id="exBank"><option value="">Ninguno</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field col-2"><label>Detalle</label><div class="control"><input id="exDesc" placeholder="Opcional"></div></div>
      </div>`;
    this.openModal('Registrar ' + label, body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const monto = +$('#exMonto').value; if (!monto || monto <= 0) return toast('Ingresá un monto válido');
        Store.addExpense({ domain, fecha: $('#exFecha').value, categoria: $('#exCat').value, bank_id: $('#exBank').value || null, monto, descripcion: $('#exDesc').value.trim() });
        this.closeModal(); toast('Gasto registrado'); this.refresh();
      } },
    ]);
  },

  // ----- Formulario de ingreso (área elegible) -----
  formIncome() {
    const banks = Store.banks();
    const body = `<div class="form-grid">
        <div class="field col-2"><label>Área</label><div class="chips" id="inDom">
          <button class="chip on" data-v="ganaderia"><span data-icon="cow"></span> Ganadería</button>
          <button class="chip" data-v="personal"><span data-icon="user"></span> Personal</button></div></div>
        <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input class="amount-big" type="number" id="inMonto" placeholder="0"></div></div>
        <div class="field"><label>Fecha</label><div class="control"><input type="date" id="inFecha" value="${Store.today()}"></div></div>
        <div class="field"><label>Categoría</label><select class="control" id="inCat">${opt(INGRESO_CATS.ganaderia)}</select></div>
        <div class="field"><label>Banco</label><select class="control" id="inBank"><option value="">Ninguno</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field col-2"><label>Detalle</label><div class="control"><input id="inDesc" placeholder="Opcional"></div></div>
      </div>`;
    this.openModal('Registrar Ingreso', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const monto = +$('#inMonto').value; if (!monto || monto <= 0) return toast('Ingresá un monto válido');
        Store.addIncome({ domain: this._inDom(), fecha: $('#inFecha').value, categoria: $('#inCat').value, bank_id: $('#inBank').value || null, monto, descripcion: $('#inDesc').value.trim() });
        this.closeModal(); toast('Ingreso registrado'); this.refresh();
      } },
    ]);
    let dom = 'ganaderia';
    $$('#inDom .chip').forEach(c => c.onclick = () => { dom = c.dataset.v; $$('#inDom .chip').forEach(x => x.classList.remove('on')); c.classList.add('on');
      $('#inCat').innerHTML = opt(INGRESO_CATS[dom]); this.injectIcons($('#inDom')); });
    this._inDom = () => dom;
  },

  // ----- Gasto rápido (botón flotante) -----
  quickExpense() {
    const banks = Store.banks();
    const body = `<p class="sub" style="margin-bottom:16px;color:var(--c-muted)">Registrá un gasto en segundos.</p>
      <div class="form-grid">
        <div class="field col-2"><label>¿Qué tipo de gasto?</label><div class="chips" id="qDom">
          <button class="chip on" data-v="ganaderia"><span data-icon="cow"></span> Ganadería</button>
          <button class="chip" data-v="personal"><span data-icon="user"></span> Personal</button></div></div>
        <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input class="amount-big" type="number" id="qMonto" placeholder="0" autofocus></div></div>
        <div class="field"><label>Banco</label><select class="control" id="qBank"><option value="">Efectivo</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field col-2"><label>Categoría</label><select class="control" id="qCat">${opt(GASTO_CATS.ganaderia)}</select></div>
      </div>`;
    this.openModal('Gasto rápido', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar gasto', cls: 'btn-primary', icon: 'check', fn: () => {
        const monto = +$('#qMonto').value; if (!monto || monto <= 0) return toast('Ingresá un monto');
        Store.addExpense({ domain: this._qDom(), fecha: Store.today(), categoria: $('#qCat').value, bank_id: $('#qBank').value || null, monto, descripcion: '' });
        this.closeModal(); toast('Gasto registrado'); this.refresh();
      } },
    ]);
    let dom = 'ganaderia';
    $$('#qDom .chip').forEach(c => c.onclick = () => { dom = c.dataset.v; $$('#qDom .chip').forEach(x => x.classList.remove('on')); c.classList.add('on');
      $('#qCat').innerHTML = opt(GASTO_CATS[dom]); this.injectIcons($('#qDom')); });
    this._qDom = () => dom;
  },

  formSalida() {
    const body = `<div class="form-grid">
        <div class="field col-2"><label>Área</label>
          <div class="chips" id="sDomain">
            <button class="chip on" data-v="ganaderia"><span data-icon="cow"></span> Ganadería</button>
            <button class="chip" data-v="personal"><span data-icon="user"></span> Personal</button>
          </div></div>
        <div class="field"><label>Proveedor <span class="req">*</span></label><div class="control"><input id="sProv" placeholder="A quién se le debe"></div></div>
        <div class="field"><label>Vencimiento</label><div class="control"><input type="date" id="sVence"></div></div>
        <div class="field"><label>Monto Total <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input type="number" id="sTotal" placeholder="0"></div></div>
        <div class="field"><label>Ya pagado</label><div class="control"><span class="prefix">Bs</span><input type="number" id="sPagado" value="0"></div></div>
        <div class="field col-2"><label>Descripción</label><div class="control"><input id="sDesc" placeholder="Ej: saldo compra de ganado"></div></div>
      </div>`;
    this.openModal('Nueva Cuenta por Pagar', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => this.saveSalida() },
    ]);
    let dom = 'ganaderia';
    $$('#sDomain .chip').forEach(c => c.onclick = () => { dom = c.dataset.v; $$('#sDomain .chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); });
    this._salidaDom = () => dom;
  },
  saveSalida() {
    const prov = $('#sProv').value.trim(); const total = +$('#sTotal').value;
    if (!prov) return toast('Falta el proveedor');
    if (!total || total <= 0) return toast('Ingresá el monto total');
    Store.addPayable({ proveedor: prov, descripcion: $('#sDesc').value.trim(), domain: this._salidaDom(),
      monto_total: total, pagado: +$('#sPagado').value || 0, vencimiento: $('#sVence').value });
    this.closeModal(); toast('Cuenta registrada'); this.refresh();
  },

  formEmpleado(id) {
    const e = id ? Store.employees().find(x => x.id === id) : {};
    const body = `<div class="form-grid">
      <div class="field"><label>Nombre <span class="req">*</span></label><div class="control"><input id="eNom" value="${esc(e.nombre || '')}" placeholder="Nombre completo"></div></div>
      <div class="field"><label>Documento / CI</label><div class="control"><input id="eDoc" value="${esc(e.documento || '')}" placeholder="CI"></div></div>
      <div class="field"><label>Puesto</label><div class="control"><input id="ePue" value="${esc(e.puesto || 'Vaquero')}" placeholder="Vaquero"></div></div>
      <div class="field"><label>Teléfono</label><div class="control"><input id="eTel" value="${esc(e.telefono || '')}" placeholder="Celular"></div></div>
      <div class="field"><label>Salario mensual</label><div class="control"><span class="prefix">Bs</span><input type="number" id="eSal" value="${e.salario || 0}"></div></div>
      <div class="field"><label>Estado</label><select class="control" id="eEst">${opt(['activo','inactivo'], e.estado || 'activo')}</select></div>
    </div>`;
    this.openModal(id ? 'Editar Empleado' : 'Nuevo Empleado', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const nom = $('#eNom').value.trim(); if (!nom) return toast('Falta el nombre');
        const data = { nombre: nom, documento: $('#eDoc').value.trim(), puesto: $('#ePue').value.trim() || 'Vaquero',
          telefono: $('#eTel').value.trim(), salario: +$('#eSal').value || 0, estado: $('#eEst').value };
        id ? Store.updateEmployee(id, data) : Store.addEmployee(data);
        this.closeModal(); toast('Empleado guardado'); this.refresh();
      } },
    ]);
  },
  formPagoEmpleado(id) {
    const e = Store.employees().find(x => x.id === id); if (!e) return;
    const banks = Store.banks();
    const body = `<p class="sub" style="margin-bottom:16px;color:var(--c-muted)">Pago a <b>${esc(e.nombre)}</b></p>
      <div class="form-grid">
        <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input type="number" id="pMonto" value="${e.salario || 0}"></div></div>
        <div class="field"><label>Fecha</label><div class="control"><input type="date" id="pFecha" value="${Store.today()}"></div></div>
        <div class="field"><label>Concepto</label><div class="control"><input id="pConc" value="Salario"></div></div>
        <div class="field"><label>Banco</label><select class="control" id="pBank"><option value="">Efectivo</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
      </div>`;
    this.openModal('Registrar Pago', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Registrar', cls: 'btn-primary', icon: 'check', fn: () => {
        const monto = +$('#pMonto').value; if (!monto) return toast('Monto inválido');
        Store.payEmployee(id, { monto, fecha: $('#pFecha').value, concepto: $('#pConc').value, bank_id: $('#pBank').value || null });
        this.closeModal(); toast('Pago registrado'); this.refresh();
      } },
    ]);
  },
  empleadoHist(id) {
    const e = Store.employees().find(x => x.id === id); if (!e) return;
    const pagos = (e.pagos || []).slice().reverse();
    const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
    const body = `<div class="stat-grid" style="margin-bottom:16px">
      <div class="stat"><div class="lbl">Salario</div><div class="val" style="font-size:22px">${money(e.salario)}</div></div>
      <div class="stat"><div class="lbl">Total pagado</div><div class="val income" style="font-size:22px">${money(totalPagado)}</div></div>
    </div>
    ${pagos.length ? `<table class="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Banco</th><th class="num">Monto</th></tr></thead>
      <tbody>${pagos.map(p => `<tr><td>${fdate(p.fecha)}</td><td>${esc(p.concepto)}</td><td>${esc(Store.bankName(p.bank_id))}</td><td class="num">${money(p.monto)}</td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">Sin pagos registrados todavía.</div>`}`;
    this.openModal(`Historial · ${esc(e.nombre)}`, body, [
      { label: 'Cerrar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Exportar PDF', cls: 'btn-primary', icon: 'pdf', fn: () => this.exportEmpleadoPDF(id) },
    ]);
  },
  exportEmpleadoPDF(id) {
    const e = Store.employees().find(x => x.id === id); if (!e) return;
    const pagos = (e.pagos || []).slice().reverse();
    const total = pagos.reduce((s, p) => s + p.monto, 0);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Historial ${esc(e.nombre)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#241d13;padding:38px;max-width:760px;margin:0 auto}
        .hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #2f7d55;padding-bottom:16px;margin-bottom:24px}
        .hd img{width:84px;height:84px;object-fit:contain}
        .hd h1{font-size:22px;margin:0;color:#2f7d55} .hd p{margin:2px 0;color:#666;font-size:13px}
        h2{font-size:16px;margin:22px 0 10px} .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:14px}
        .meta b{color:#555}
        table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
        th{background:#f1efe7;text-align:left;padding:9px 12px;border-bottom:2px solid #ddd}
        td{padding:9px 12px;border-bottom:1px solid #eee} .num{text-align:right}
        tfoot td{font-weight:bold;border-top:2px solid #2f7d55}
        .foot{margin-top:30px;font-size:11px;color:#999;text-align:center}
      </style></head><body>
      <div class="hd"><img src="${location.origin}${location.pathname.replace(/index\.html$/, '')}assets/img/logo.jpg">
        <div><h1>Ganadería Dyck Manantial</h1><p>Historial laboral del empleado</p>
        <p>Emitido: ${new Date().toLocaleDateString('es-BO')}</p></div></div>
      <h2>Datos del empleado</h2>
      <div class="meta">
        <div><b>Nombre:</b> ${esc(e.nombre)}</div><div><b>Documento:</b> ${esc(e.documento || '—')}</div>
        <div><b>Puesto:</b> ${esc(e.puesto)}</div><div><b>Teléfono:</b> ${esc(e.telefono || '—')}</div>
        <div><b>Salario mensual:</b> ${money(e.salario)}</div><div><b>Estado:</b> ${e.estado === 'inactivo' ? 'Inactivo' : 'Activo'}</div>
      </div>
      <h2>Historial de pagos</h2>
      ${pagos.length ? `<table><thead><tr><th>Fecha</th><th>Concepto</th><th>Banco</th><th class="num">Monto</th></tr></thead>
        <tbody>${pagos.map(p => `<tr><td>${fdate(p.fecha)}</td><td>${esc(p.concepto)}</td><td>${esc(Store.bankName(p.bank_id))}</td><td class="num">${money(p.monto)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total pagado</td><td class="num">${money(total)}</td></tr></tfoot></table>`
        : '<p>Sin pagos registrados.</p>'}
      <div class="foot">Documento generado por el sistema Dyck Manantial</div>
      <script>window.onload=()=>{window.print()}<\/script>
      </body></html>`);
    win.document.close();
  },

  formBanco(id) {
    const b = id ? Store.banks().find(x => x.id === id) : {};
    const body = `<div class="form-grid">
      <div class="field col-2"><label>Nombre del banco / cuenta <span class="req">*</span></label><div class="control"><input id="bNom" value="${esc(b.name || '')}" placeholder="Ej: Banco Ganadero"></div></div>
      <div class="field"><label>Tipo</label><select class="control" id="bTipo">${opt(['Cuenta corriente','Caja de ahorro','Caja','Tarjeta','Otro'], b.tipo || 'Cuenta corriente')}</select></div>
      <div class="field"><label>Saldo inicial</label><div class="control"><span class="prefix">Bs</span><input type="number" id="bSaldo" value="${b.saldo_inicial || 0}"></div></div>
    </div>`;
    this.openModal(id ? 'Editar Banco' : 'Agregar Banco', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const nom = $('#bNom').value.trim(); if (!nom) return toast('Falta el nombre');
        const data = { name: nom, tipo: $('#bTipo').value, saldo_inicial: +$('#bSaldo').value || 0 };
        id ? Store.updateBank(id, data) : Store.addBank(data);
        this.closeModal(); toast('Banco guardado'); this.refresh();
      } },
    ]);
  },

  // ============================================================
  //  AJUSTES
  // ============================================================
  renderAjustes() {
    let h = this.head('Ajustes', 'Personalizá el sistema');
    const cur = Store.settings().theme;
    h += `<div class="section"><div class="section-title"><span data-icon="edit"></span> Tema y color</div>
      <div class="theme-grid">${THEMES.map(t => `<div class="theme-card ${t.id === cur ? 'on' : ''}" data-theme="${t.id}">
        <div class="sw-row">${t.sw.map(c => `<span class="sw" style="background:${c}"></span>`).join('')}</div>
        <div class="nm">${t.name}</div></div>`).join('')}</div></div>`;

    // Bancos
    const banks = Store.banks();
    h += `<div class="section"><div class="section-title"><span data-icon="bank"></span> Bancos y cuentas
        <button class="btn btn-primary btn-sm" id="addBank" style="margin-left:auto"><span data-icon="plus"></span> Agregar banco</button></div>
      <div class="stat-grid">${banks.map(b => `
        <div class="stat"><div class="top"><div class="lbl">${esc(b.name)}</div><div class="ico"><span data-icon="bank"></span></div></div>
          <div class="val">${money(Store.bankBalance(b.id))}</div><div class="hint">${esc(b.tipo || 'Cuenta')}</div>
          <div style="margin-top:14px;display:flex;gap:6px">
            <button class="iconbtn" data-bedit="${b.id}"><span data-icon="edit" data-size="16"></span></button>
            <button class="iconbtn danger" data-bdel="${b.id}"><span data-icon="trash" data-size="16"></span></button>
          </div></div>`).join('')}</div>
      ${!banks.length ? this.emptyState('bank', 'Agregá tu primer banco.') : ''}</div>`;

    h += `<div class="section"><div class="section-title"><span data-icon="download"></span> Datos y ayuda</div>
      <div class="panel"><div class="panel-body" style="padding:18px 22px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" id="btnExport"><span data-icon="download"></span> Exportar datos (JSON)</button>
        <button class="btn btn-ghost" id="btnTour"><span data-icon="sparkles"></span> Ver tour de nuevo</button>
        <button class="btn btn-ghost" id="btnDemo"><span data-icon="sparkles"></span> Cargar datos de ejemplo</button>
        <button class="btn btn-danger" id="btnReset"><span data-icon="trash"></span> Borrar todo</button>
      </div>
      <div class="panel-body" style="padding:0 22px 18px"><p class="sub" style="color:var(--c-muted);font-size:13px">
        "Datos de ejemplo" llena el sistema para que veas los gráficos y reportes con vida (ideal para mostrarle a Franz). "Borrar todo" lo deja limpio para empezar en serio.</p></div></div></div>`;
    this.paint('ajustes', h);
    const root = $('#screen-ajustes');
    $$('.theme-card', root).forEach(c => c.onclick = () => { this.applyTheme(c.dataset.theme); Store.setSetting('theme', c.dataset.theme); this.refresh(); });
    $('#addBank').onclick = () => this.formBanco();
    $$('[data-bedit]', root).forEach(b => b.onclick = () => this.formBanco(b.dataset.bedit));
    $$('[data-bdel]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeBank(b.dataset.bdel)));
    $('#btnExport').onclick = () => this.exportData();
    $('#btnTour').onclick = () => { this.go('dashboard'); setTimeout(() => this.startTour(), 300); };
    $('#btnDemo').onclick = () => { Store.loadDemo(); toast('Datos de ejemplo cargados'); this.go('dashboard'); };
    $('#btnReset').onclick = () => this.openModal('¿Borrar todos los datos?',
      `<p style="color:var(--c-text-2)">Se eliminan compras, ventas, gastos, ingresos, salidas y empleados. No se puede deshacer.</p>`, [
        { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
        { label: 'Borrar todo', cls: 'btn-danger', icon: 'trash', fn: () => { Store.reset(); this.closeModal(); toast('Datos borrados'); this.go('dashboard'); } },
      ]);
  },

  // ============================================================
  //  Helpers UI
  // ============================================================
  panel(title, inner) {
    return `<div class="panel"><div class="panel-head"><h3>${esc(title)}</h3></div><div class="panel-body">${inner}</div></div>`;
  },
  emptyState(ic, msg) { return `<div class="empty"><span data-icon="${ic}" data-size="40"></span><div>${esc(msg)}</div></div>`; },

  openModal(title, body, actions = []) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modalFoot').innerHTML = actions.map((a, i) => `<button class="btn ${a.cls}" data-act="${i}">${a.icon ? `<span data-icon="${a.icon}"></span>` : ''} ${esc(a.label)}</button>`).join('');
    this.injectIcons($('#modal'));
    $$('#modalFoot [data-act]').forEach(b => b.onclick = () => actions[+b.dataset.act].fn());
    $('#modalBg').classList.add('open');
  },
  closeModal() { $('#modalBg').classList.remove('open'); },
  confirmDelete(fn) {
    this.openModal('¿Eliminar?', `<p style="color:var(--c-text-2)">Esta acción no se puede deshacer.</p>`, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Eliminar', cls: 'btn-danger', icon: 'trash', fn: () => { fn(); this.closeModal(); toast('Eliminado'); this.refresh(); } },
    ]);
  },
  exportData() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `dyck-manantial-${Store.today()}.json`; a.click();
  },

  applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    const t = THEMES.find(x => x.id === id);
    if (t) $('meta[name=theme-color]')?.setAttribute('content', t.sw[0]);
  },

  // ============================================================
  //  TOUR (globitos de onboarding)
  // ============================================================
  tourSteps: [
    { sel: '[data-go="dashboard"]', title: 'Dashboard', text: 'Tu panel general: saldo, lo que entra y sale, gráficos y un resumen separado de Ganadería y Vida Personal. Todo lo que cargues cae acá.' },
    { sel: '[data-go="ganaderia"]', title: 'Ganadería', text: 'Todo el campo en un solo lugar: animales (uno por uno, con muertes y motivos), compras, ventas, gastos, empleados y deudas.' },
    { sel: '[data-go="personales"]', title: 'Gastos personales', text: 'Tus salidas personales, separados de la ganadería: comida, salud, transporte, vivienda, etc.' },
    { sel: '[data-go="ingresos"]', title: 'Ingresos', text: 'Todo lo que entra, ganadería y personal juntos. Las ventas de ganado aparecen acá automáticamente.' },
    { sel: '#fabQuick', title: 'Gasto rápido', text: 'Este botón está siempre a mano: cargás un gasto en segundos — área, monto y banco. Ideal para el día a día.' },
    { sel: '#btnSettings', title: 'Ajustes', text: 'Tus bancos, el color del sistema, exportar datos o volver a ver este tour cuando quieras.' },
  ],
  tourIndex: 0,
  startTour() {
    this.closeDrawer();
    this.tourIndex = 0;
    $('#tourBg').classList.add('open');
    this.showTourStep();
  },
  showTourStep() {
    const step = this.tourSteps[this.tourIndex];
    const target = $(step.sel);
    if (!target) return this.endTour();
    const r = target.getBoundingClientRect();
    const spot = $('#tourSpot'); spot.classList.remove('hidden');
    spot.style.left = (r.left - 6) + 'px'; spot.style.top = (r.top - 6) + 'px';
    spot.style.width = (r.width + 12) + 'px'; spot.style.height = (r.height + 12) + 'px';

    const pop = $('#tourPop'); pop.classList.remove('hidden');
    const last = this.tourIndex === this.tourSteps.length - 1;
    pop.innerHTML = `<div class="step"><span data-icon="sparkles" data-size="14"></span> Paso ${this.tourIndex + 1} de ${this.tourSteps.length}</div>
      <h4>${esc(step.title)}</h4><p>${esc(step.text)}</p>
      <div class="row"><div class="dots">${this.tourSteps.map((_, i) => `<i class="${i === this.tourIndex ? 'on' : ''}"></i>`).join('')}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" id="tourSkip">Saltar</button>
        <button class="btn btn-primary btn-sm" id="tourNext">${last ? 'Listo' : 'Siguiente'}</button>
      </div></div>`;
    this.injectIcons(pop);
    // Posición del popup, clamp para que no se salga de pantalla
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      pop.style.left = '16px'; pop.style.right = '16px'; pop.style.maxWidth = 'none';
      const below = r.bottom + 14, ph = pop.offsetHeight || 180;
      pop.style.top = (below + ph > window.innerHeight - 12 ? Math.max(12, r.top - ph - 14) : below) + 'px';
    } else {
      const pw = 300, ph = pop.offsetHeight || 190; pop.style.right = 'auto'; pop.style.maxWidth = pw + 'px';
      let left = r.right + 18;
      if (left + pw > window.innerWidth - 12) left = r.left - pw - 18;   // a la izquierda si no entra
      if (left < 12) left = Math.max(12, (window.innerWidth - pw) / 2);  // centrado si tampoco
      let top = Math.min(Math.max(16, r.top), window.innerHeight - ph - 16);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }
    $('#tourSkip').onclick = () => this.endTour();
    $('#tourNext').onclick = () => { if (last) this.endTour(); else { this.tourIndex++; this.showTourStep(); } };
  },
  endTour() {
    $('#tourBg').classList.remove('open');
    $('#tourSpot').classList.add('hidden'); $('#tourPop').classList.add('hidden');
    Store.setSetting('onboarded', true);
  },
};

// ---------- toast ----------
let _toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove('show'), 2000);
}

document.addEventListener('DOMContentLoaded', () => App.init());
window.addEventListener('resize', () => { if ($('#tourBg').classList.contains('open')) App.showTourStep(); });
window.App = App;
