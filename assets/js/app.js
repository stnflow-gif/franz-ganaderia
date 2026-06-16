/* ============================================================
   app.js — ERP Dyck Manantial (front-end 100% funcional, local)
   ============================================================ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- Listas de referencia ----------
const THEMES = [
  { id: 'rancho-claro', name: 'Rancho claro', sw: ['#f3f0e7', '#2f7d55', '#8b5e3c'] },
  { id: 'rancho',       name: 'Rancho oscuro', sw: ['#14110d', '#4a8c5e', '#b0763d'] },
  { id: 'verde-noche',  name: 'Verde noche',   sw: ['#0d1512', '#10b981', '#d97706'] },
  { id: 'tierra-clara', name: 'Tierra clara',  sw: ['#fbf8f3', '#c9923b', '#6b4f2c'] },
  { id: 'campo-azul',   name: 'Campo azul',    sw: ['#0b1120', '#3b82f6', '#e8a830'] },
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

const SECTION_TITLES = { dashboard:'Dashboard', compras:'Compras', ventas:'Ventas', gastos:'Gastos',
  ingresos:'Ingresos', salidas:'Salidas', empleados:'Empleados', bancos:'Bancos', ajustes:'Ajustes' };

// ============================================================
const App = {
  current: 'dashboard',
  formItems: [],

  init() {
    this.applyTheme(Store.settings().theme || 'rancho-claro');
    this.injectIcons();
    this.bindGlobal();
    if (Store.settings().user) this.enterApp(); else this.showLogin();
  },

  injectIcons(root = document) {
    $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon, el.dataset.size ? +el.dataset.size : 20); });
  },

  bindGlobal() {
    $('#btnGoogle').onclick = () => this.login('Franz Dyck', 'franz@dyckmanantial.com', 'Google');
    $('#btnLogin').onclick = () => {
      const email = $('#logEmail').value.trim() || 'franz@dyckmanantial.com';
      this.login('Franz Dyck', email, 'email');
    };
    $('#btnLogout').onclick = () => { Store.setSetting('user', null); location.reload(); };
    $$('#nav button').forEach(b => b.onclick = () => { this.go(b.dataset.go); this.closeDrawer(); });
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
  showLogin() { $('#loginScreen').classList.remove('hidden'); $('#shell').classList.add('hidden'); },
  enterApp() {
    const u = Store.settings().user || { name: 'Franz Dyck', email: 'modo local' };
    $('#loginScreen').classList.add('hidden'); $('#shell').classList.remove('hidden');
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
    const map = { dashboard:'renderDashboard', compras:'renderCompras', ventas:'renderVentas', gastos:'renderGastos',
      ingresos:'renderIngresos', salidas:'renderSalidas', empleados:'renderEmpleados', bancos:'renderBancos', ajustes:'renderAjustes' };
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

    // Resumen rápido
    h += `<div class="section"><div class="section-title"><span data-icon="cow"></span> Resumen del hato</div>
      <div class="stat-grid">
        ${stat('Cabezas de ganado', head, 'cow', '', 'Compras − ventas')}
        ${stat('Empleados activos', Store.activeEmployees().length, 'workers', '', 'Nómina ' + money(Store.nominaMensual()))}
        ${stat('Ingresos del mes', money(Store.finance(monthKey()).totalIngresos), 'coins', 'income', 'Otros ingresos')}
      </div></div>`;
    this.paint('dashboard', h);
  },

  // ============================================================
  //  COMPRAS
  // ============================================================
  renderCompras() {
    let h = this.head('Registro de Compras', 'Gestión de compras de ganado', 'Nueva Compra', 'cart', () => this.formCompra());
    const rows = Store.purchases().slice().reverse();
    h += this.panel('Historial de compras', rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Fecha</th><th>Proveedor</th><th>Animales</th><th>Banco</th><th>Método</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${rows.map(p => `<tr>
        <td>${fdate(p.fecha)}</td><td>${esc(p.proveedor || '—')}</td>
        <td>${(p.items || []).reduce((s, i) => s + (+i.cantidad || 0), 0)} cab.</td>
        <td>${esc(Store.bankName(p.bank_id))}</td>
        <td><span class="badge ${p.metodo_pago === 'Crédito' ? 'pend' : 'off'}">${esc(p.metodo_pago)}</span></td>
        <td class="num">${money(p.total)}</td>
        <td class="actions"><button class="iconbtn danger" data-del="${p.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('cart', 'Sin compras registradas todavía.'));
    this.paint('compras', h);
    $$('#screen-compras [data-del]').forEach(b => b.onclick = () => this.confirmDelete(() => Store.removePurchase(b.dataset.del)));
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

  // ============================================================
  //  VENTAS
  // ============================================================
  renderVentas() {
    let h = this.head('Registro de Ventas', 'Gestión de ventas de ganado', 'Nueva Venta', 'trending', () => this.formVenta());
    const rows = Store.sales().slice().reverse();
    h += this.panel('Historial de ventas', rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Animales</th><th>Banco</th><th>Método</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${rows.map(s => `<tr><td>${fdate(s.fecha)}</td><td>${esc(s.cliente || '—')}</td>
        <td>${(s.items || []).reduce((a, i) => a + (+i.cantidad || 0), 0)} cab.</td>
        <td>${esc(Store.bankName(s.bank_id))}</td>
        <td><span class="badge ${s.metodo_pago === 'Crédito' ? 'pend' : 'off'}">${esc(s.metodo_pago)}</span></td>
        <td class="num">${money(s.total)}</td>
        <td class="actions"><button class="iconbtn danger" data-del="${s.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('trending', 'Sin ventas registradas.'));
    this.paint('ventas', h);
    $$('#screen-ventas [data-del]').forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeSale(b.dataset.del)));
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
  //  GASTOS / INGRESOS (genérico)
  // ============================================================
  renderGastos() { this.renderFlow('gastos'); },
  renderIngresos() { this.renderFlow('ingresos'); },
  renderFlow(kind) {
    const isGasto = kind === 'gastos';
    const data = (isGasto ? Store.expenses() : Store.incomes()).slice().reverse();
    let h = this.head(isGasto ? 'Gastos' : 'Ingresos',
      isGasto ? 'Registro de egresos personales y de ganadería' : 'Registro de ingresos personales y de ganadería',
      isGasto ? 'Nuevo Gasto' : 'Nuevo Ingreso', isGasto ? 'arrowDown' : 'coins', () => this.formFlow(kind));
    h += this.panel(isGasto ? 'Historial de gastos' : 'Historial de ingresos', data.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Fecha</th><th>Categoría</th><th>Área</th><th>Banco</th><th>Detalle</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${data.map(x => `<tr><td>${fdate(x.fecha)}</td>
        <td><span style="display:inline-flex;align-items:center;gap:7px"><span data-icon="${CAT_ICON[x.categoria] || 'dot'}" data-size="17"></span>${esc(x.categoria)}</span></td>
        <td><span class="badge ${x.domain === 'personal' ? 'per' : 'gan'}">${x.domain === 'personal' ? 'Personal' : 'Ganadería'}</span></td>
        <td>${esc(Store.bankName(x.bank_id))}</td><td>${esc(x.descripcion || '—')}</td>
        <td class="num"><span class="pill-amount ${isGasto ? 'expense' : 'income'}">${isGasto ? '−' : '+'} ${money(x.monto)}</span></td>
        <td class="actions"><button class="iconbtn danger" data-del="${x.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState(isGasto ? 'arrowDown' : 'coins', isGasto ? 'Sin gastos registrados.' : 'Sin ingresos registrados.'));
    this.paint(kind, h);
    $$(`#screen-${kind} [data-del]`).forEach(b => b.onclick = () => this.confirmDelete(() =>
      isGasto ? Store.removeExpense(b.dataset.del) : Store.removeIncome(b.dataset.del)));
  },
  formFlow(kind) {
    const isGasto = kind === 'gastos';
    const cats = (d) => (isGasto ? GASTO_CATS : INGRESO_CATS)[d];
    const banks = Store.banks();
    const body = `<div class="form-grid">
        <div class="field col-2"><label>Área</label>
          <div class="chips" id="flDomain">
            <button class="chip on" data-v="ganaderia"><span data-icon="cow"></span> Ganadería</button>
            <button class="chip" data-v="personal"><span data-icon="user"></span> Personal</button>
          </div></div>
        <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input class="amount-big" type="number" id="flMonto" placeholder="0"></div></div>
        <div class="field"><label>Fecha</label><div class="control"><input type="date" id="flFecha" value="${Store.today()}"></div></div>
        <div class="field"><label>Categoría</label><select class="control" id="flCat">${opt(cats('ganaderia'))}</select></div>
        <div class="field"><label>Banco</label><select class="control" id="flBank"><option value="">Ninguno</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field col-2"><label>Detalle</label><div class="control"><input id="flDesc" placeholder="Ej: vacuna aftosa lote 2"></div></div>
      </div>`;
    this.openModal(isGasto ? 'Registrar Gasto' : 'Registrar Ingreso', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => this.saveFlow(kind) },
    ]);
    let dom = 'ganaderia';
    $$('#flDomain .chip').forEach(c => c.onclick = () => {
      dom = c.dataset.v; $$('#flDomain .chip').forEach(x => x.classList.remove('on')); c.classList.add('on');
      $('#flCat').innerHTML = opt(cats(dom)); this.injectIcons($('#flDomain'));
    });
    this._flowDom = () => dom;
  },
  saveFlow(kind) {
    const isGasto = kind === 'gastos';
    const monto = +$('#flMonto').value;
    if (!monto || monto <= 0) return toast('Ingresá un monto válido');
    const payload = { fecha: $('#flFecha').value, domain: this._flowDom(), categoria: $('#flCat').value,
      bank_id: $('#flBank').value || null, monto, descripcion: $('#flDesc').value.trim() };
    isGasto ? Store.addExpense(payload) : Store.addIncome(payload);
    this.closeModal(); toast(isGasto ? 'Gasto registrado' : 'Ingreso registrado'); this.refresh();
  },

  // ============================================================
  //  SALIDAS (cuentas por pagar)
  // ============================================================
  renderSalidas() {
    let h = this.head('Salidas', 'Gestión de pagos y deudas pendientes', 'Nueva Cuenta', 'receipt', () => this.formSalida());
    const rows = Store.payables();
    const totalPagar = rows.filter(p => p.estado !== 'pagado').reduce((s, p) => s + (p.monto_total - p.pagado), 0);
    const pend = rows.filter(p => p.estado !== 'pagado').length;
    h += `<div class="stat-grid" style="margin-bottom:22px">
      <div class="stat"><div class="top"><div class="lbl">Total por Pagar</div><div class="ico"><span data-icon="arrowDown"></span></div></div><div class="val expense">${money(totalPagar)}</div><div class="hint">Pendiente de pagar</div></div>
      <div class="stat"><div class="top"><div class="lbl">Total Cuentas</div><div class="ico"><span data-icon="receipt"></span></div></div><div class="val">${rows.length}</div><div class="hint">Registros totales</div></div>
      <div class="stat"><div class="top"><div class="lbl">Cuentas Pendientes</div><div class="ico"><span data-icon="clock"></span></div></div><div class="val warn">${pend}</div><div class="hint">Sin pagar completamente</div></div>
    </div>`;
    h += this.panel('Listado de salidas', rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Proveedor</th><th>Descripción</th><th>Área</th><th class="num">Total</th><th class="num">Pagado</th><th class="num">Pendiente</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows.slice().reverse().map(p => `<tr>
        <td>${esc(p.proveedor || '—')}</td><td>${esc(p.descripcion || '—')}</td>
        <td><span class="badge ${p.domain === 'personal' ? 'per' : 'gan'}">${p.domain === 'personal' ? 'Personal' : 'Ganadería'}</span></td>
        <td class="num">${money(p.monto_total)}</td><td class="num">${money(p.pagado)}</td>
        <td class="num">${money(p.monto_total - p.pagado)}</td><td>${fdate(p.vencimiento)}</td>
        <td><span class="badge ${p.estado === 'pagado' ? 'ok' : 'pend'}">${p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span></td>
        <td class="actions">
          ${p.estado !== 'pagado' ? `<button class="iconbtn ok" data-pay="${p.id}" title="Marcar pagado"><span data-icon="check" data-size="17"></span></button>` : ''}
          <button class="iconbtn danger" data-del="${p.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('receipt', 'Sin cuentas por pagar.'));
    this.paint('salidas', h);
    $$('#screen-salidas [data-pay]').forEach(b => b.onclick = () => { Store.payPayable(b.dataset.pay); toast('Marcado como pagado'); this.refresh(); });
    $$('#screen-salidas [data-del]').forEach(b => b.onclick = () => this.confirmDelete(() => Store.removePayable(b.dataset.del)));
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

  // ============================================================
  //  EMPLEADOS
  // ============================================================
  renderEmpleados() {
    let h = this.head('Gestión de Empleados', 'Administración de vaqueros y trabajadores', 'Nuevo Empleado', 'workers', () => this.formEmpleado());
    const emps = Store.employees();
    const activos = emps.filter(e => e.estado !== 'inactivo');
    h += `<div class="stat-grid" style="margin-bottom:22px">
      <div class="stat"><div class="top"><div class="lbl">Total Empleados</div><div class="ico"><span data-icon="workers"></span></div></div><div class="val">${emps.length}</div></div>
      <div class="stat"><div class="top"><div class="lbl">Activos</div><div class="ico"><span data-icon="check"></span></div></div><div class="val income">${activos.length}</div></div>
      <div class="stat"><div class="top"><div class="lbl">Nómina Mensual</div><div class="ico"><span data-icon="coins"></span></div></div><div class="val">${money(Store.nominaMensual())}</div></div>
    </div>`;
    h += this.panel('Lista de empleados', emps.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Nombre</th><th>Documento</th><th>Puesto</th><th>Teléfono</th><th class="num">Salario</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${emps.map(e => `<tr>
        <td><b>${esc(e.nombre)}</b></td><td>${esc(e.documento || '—')}</td><td>${esc(e.puesto)}</td><td>${esc(e.telefono || '—')}</td>
        <td class="num">${money(e.salario)}</td>
        <td><span class="badge ${e.estado === 'inactivo' ? 'off' : 'ok'}">${e.estado === 'inactivo' ? 'Inactivo' : 'Activo'}</span></td>
        <td class="actions">
          <button class="iconbtn" data-hist="${e.id}" title="Historial"><span data-icon="eye" data-size="17"></span></button>
          <button class="iconbtn ok" data-pay="${e.id}" title="Registrar pago"><span data-icon="cash" data-size="17"></span></button>
          <button class="iconbtn" data-edit="${e.id}" title="Editar"><span data-icon="edit" data-size="17"></span></button>
          <button class="iconbtn danger" data-del="${e.id}" title="Eliminar"><span data-icon="trash" data-size="17"></span></button>
        </td></tr>`).join('')}</tbody></table></div>` : this.emptyState('workers', 'Sin empleados. Agregá el primero.'));
    this.paint('empleados', h);
    const root = $('#screen-empleados');
    $$('[data-hist]', root).forEach(b => b.onclick = () => this.empleadoHist(b.dataset.hist));
    $$('[data-pay]', root).forEach(b => b.onclick = () => this.formPagoEmpleado(b.dataset.pay));
    $$('[data-edit]', root).forEach(b => b.onclick = () => this.formEmpleado(b.dataset.edit));
    $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeEmployee(b.dataset.del)));
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

  // ============================================================
  //  BANCOS
  // ============================================================
  renderBancos() {
    let h = this.head('Bancos', 'Tus cuentas bancarias y efectivo', 'Agregar Banco', 'bank', () => this.formBanco());
    const banks = Store.banks();
    h += `<div class="stat-grid">${banks.map(b => `
      <div class="stat"><div class="top"><div class="lbl">${esc(b.name)}</div>
        <div class="ico"><span data-icon="bank"></span></div></div>
        <div class="val">${money(Store.bankBalance(b.id))}</div>
        <div class="hint">${esc(b.tipo || 'Cuenta')}</div>
        <div style="margin-top:14px;display:flex;gap:6px">
          <button class="iconbtn" data-edit="${b.id}"><span data-icon="edit" data-size="16"></span></button>
          <button class="iconbtn danger" data-del="${b.id}"><span data-icon="trash" data-size="16"></span></button>
        </div></div>`).join('')}</div>`;
    if (!banks.length) h += this.emptyState('bank', 'Agregá tu primer banco.');
    this.paint('bancos', h);
    const root = $('#screen-bancos');
    $$('[data-edit]', root).forEach(b => b.onclick = () => this.formBanco(b.dataset.edit));
    $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeBank(b.dataset.del)));
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
    h += `<div class="section"><div class="section-title"><span data-icon="download"></span> Datos y ayuda</div>
      <div class="panel"><div class="panel-body" style="padding:18px 22px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" id="btnExport"><span data-icon="download"></span> Exportar datos (JSON)</button>
        <button class="btn btn-ghost" id="btnTour"><span data-icon="sparkles"></span> Ver tour de nuevo</button>
      </div></div></div>`;
    this.paint('ajustes', h);
    const root = $('#screen-ajustes');
    $$('.theme-card', root).forEach(c => c.onclick = () => { this.applyTheme(c.dataset.theme); Store.setSetting('theme', c.dataset.theme); this.refresh(); });
    $('#btnExport').onclick = () => this.exportData();
    $('#btnTour').onclick = () => { this.go('dashboard'); setTimeout(() => this.startTour(), 300); };
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
    { go: 'dashboard',  sel: '[data-go="dashboard"]', title: 'Dashboard', text: 'Tu panel financiero: saldo total, lo que tenés por cobrar y por pagar, ventas, compras y el saldo neto proyectado.' },
    { go: 'dashboard',  sel: '[data-go="compras"]',   title: 'Compras', text: 'Registrá la compra de ganado: proveedor, banco, método de pago y cada animal con su precio.' },
    { go: 'dashboard',  sel: '[data-go="ventas"]',    title: 'Ventas', text: 'Igual que compras pero para las ventas. El sistema descuenta las cabezas del hato.' },
    { go: 'dashboard',  sel: '[data-go="gastos"]',    title: 'Gastos', text: 'Cargá gastos de Ganadería o Personales: veterinario, gasolina, comida, etc. Elegís el banco de dónde salió.' },
    { go: 'dashboard',  sel: '[data-go="ingresos"]',  title: 'Ingresos', text: 'Tus ingresos por leche, carne, o lo que entre — ganadería o personal.' },
    { go: 'dashboard',  sel: '[data-go="salidas"]',   title: 'Salidas', text: 'Cuentas por pagar: deudas con proveedores, con vencimiento y estado. Marcás cuando pagás.' },
    { go: 'dashboard',  sel: '[data-go="empleados"]', title: 'Empleados', text: 'Tus vaqueros y trabajadores. Registrás pagos y podés exportar el historial de cada uno en PDF.' },
    { go: 'dashboard',  sel: '[data-go="bancos"]',    title: 'Bancos', text: 'Agregá los bancos y cuentas que manejás. Cada movimiento se asocia a un banco.' },
    { go: 'dashboard',  sel: '[data-go="ajustes"]',   title: 'Ajustes', text: 'Cambiá el color del sistema, exportá tus datos o volvé a ver este tour cuando quieras.' },
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
    // Posición del popup: a la derecha del item (o abajo en mobile)
    const isMobile = window.innerWidth <= 900;
    if (isMobile) { pop.style.left = '16px'; pop.style.right = '16px'; pop.style.top = (r.bottom + 14) + 'px'; pop.style.maxWidth = 'none'; }
    else { pop.style.left = (r.right + 18) + 'px'; pop.style.top = Math.max(16, r.top) + 'px'; pop.style.right = 'auto'; pop.style.maxWidth = '300px'; }
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
