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
  ingresos:'Ingresos', tareas:'Tareas', ajustes:'Ajustes' };

// ============================================================
const App = {
  current: 'dashboard',
  formItems: [],

  init() {
    // Migración una sola vez al tema vidrio (nuevo default); luego el usuario puede cambiarlo
    if (!Store.settings().glassMigrated) { Store.setSetting('theme', 'glass'); Store.setSetting('glassMigrated', true); }
    if (!THEMES.some(t => t.id === Store.settings().theme)) Store.setSetting('theme', 'glass');
    this.applyTheme(Store.settings().theme || 'glass');
    this.injectIcons();
    this.bindGlobal();
    if (Store.settings().user) this.enterApp(); else this.showLogin();
  },

  injectIcons(root = document) {
    $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon, el.dataset.size ? +el.dataset.size : 20); });
  },

  authMode: 'login',
  bindGlobal() {
    const supaConfigured = () => !!(window.SUPA_CONFIG && window.SUPA_CONFIG.anonKey);
    const note = (m) => { const n = $('#loginNote'); if (n) n.textContent = m || ''; };

    // Alternar Entrar / Crear cuenta
    $('#authToggle').onclick = () => {
      this.authMode = this.authMode === 'login' ? 'signup' : 'login';
      $('#btnLogin').textContent = this.authMode === 'login' ? 'Entrar' : 'Crear cuenta';
      $('#authToggle').innerHTML = this.authMode === 'login' ? '¿Primera vez? <b>Creá tu cuenta</b>' : '¿Ya tenés cuenta? <b>Iniciá sesión</b>';
      note('');
    };

    const btnG = $('#btnGoogle');
    if (btnG) btnG.onclick = async () => {
      if (!supaConfigured()) return this.login('Franz Dyck', 'franz@dyckmanantial.com', 'Google'); // modo local
      if (!window.Sync) return toast('Conectando con el servidor, probá en un segundo…');
      note('Abriendo Google…');
      const r = await window.Sync.signInGoogle();
      if (r && r.error) note(/not enabled|Unsupported/i.test(r.error.message) ? 'Google todavía no está activado en el servidor. Usá tu email por ahora.' : r.error.message);
    };

    const doLogin = async (e) => {
      if (e) e.preventDefault();
      const email = $('#logEmail').value.trim(), pass = $('#logPass').value;
      if (!supaConfigured()) return this.login('Franz Dyck', email || 'franz@dyckmanantial.com', 'email'); // modo local
      if (!window.Sync) return toast('Conectando con el servidor, probá en un segundo…');
      if (!email || !pass) return note('Ingresá tu email y contraseña.');
      if (pass.length < 6 && this.authMode === 'signup') return note('La contraseña debe tener al menos 6 caracteres.');

      if (this.authMode === 'signup') {
        note('Creando cuenta…');
        const r = await window.Sync.signUp(email, pass);
        if (r.error) return note(this.authError(r.error.message));
        this.saveCredential(email, pass);
        if (r.data && r.data.session) note('¡Cuenta creada! Entrando…');         // autoconfirm activado
        else note('Te enviamos un correo para confirmar la cuenta. Confirmalo y volvé a entrar.');
      } else {
        note('Entrando…');
        const r = await window.Sync.signInPassword(email, pass);
        if (r.error) return note(this.authError(r.error.message));
        this.saveCredential(email, pass);   // ofrece guardar la contraseña en Google
        // onAuthStateChange hace enterApp()
      }
    };
    const lf = $('#loginForm'); if (lf) lf.onsubmit = doLogin;
    const bl = $('#btnLogin'); if (bl) bl.onclick = doLogin;
    $('#btnLogout').onclick = async () => { if (window.Sync) { try { await window.Sync.signOut(); } catch (e) {} } Store.setSetting('user', null); location.reload(); };
    $$('#nav button, #btnSettings').forEach(b => b.onclick = () => { this.go(b.dataset.go); this.closeDrawer(); });
    $('#fabQuick').onclick = () => this.quickExpense();
    $('#ham').onclick = () => $('#sidebar').classList.toggle('open') | $('#scrim').classList.toggle('open');
    $('#scrim').onclick = () => this.closeDrawer();
    // Abrir el calendario al tocar cualquier parte de un campo de fecha (no solo el iconito)
    document.addEventListener('click', (e) => { const t = e.target;
      if (t && t.tagName === 'INPUT' && t.type === 'date') { try { t.showPicker(); } catch (_) {} } });
    $('#modalClose').onclick = () => this.closeModal();
    $('#modalBg').onclick = e => { if (e.target === $('#modalBg')) this.closeModal(); };
  },

  closeDrawer() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); },

  // ---------- Auth ----------
  // Ofrece guardar la contraseña en el gestor de Google/Chrome (Credential Management API)
  saveCredential(email, pass) {
    try {
      if (window.PasswordCredential && navigator.credentials) {
        const cred = new window.PasswordCredential({ id: email, password: pass, name: email });
        navigator.credentials.store(cred).catch(() => {});
      }
    } catch (e) {}
  },
  login(name, email, via) {          // modo local (sin backend configurado)
    Store.setSetting('user', { name, email, via });
    this.enterApp();
  },
  authError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login')) return 'Email o contraseña incorrectos.';
    if (m.includes('not confirmed')) return 'Confirmá tu email primero (revisá tu correo).';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Ese email ya tiene cuenta. Iniciá sesión.';
    if (m.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
    return msg || 'No se pudo completar. Probá de nuevo.';
  },
  showLogin() {
    $('#loginScreen').classList.remove('hidden'); $('#shell').classList.add('hidden'); $('#fabQuick').classList.add('hidden');
    const cfg = window.SUPA_CONFIG || {};
    const n = $('#loginNote'); if (n) n.textContent = cfg.anonKey ? '' : 'Modo local — sin conexión a la nube configurada.';
  },
  enterApp() {
    const u = Store.settings().user || { name: 'Franz Dyck', email: 'modo local' };
    $('#loginScreen').classList.add('hidden'); $('#shell').classList.remove('hidden'); $('#fabQuick').classList.remove('hidden');
    $('#userName').textContent = u.name; $('#userEmail').textContent = u.email;
    $('#userAv').textContent = (u.name || 'F').charAt(0).toUpperCase();
    this.go('dashboard');
    if (!Store.settings().onboarded) setTimeout(() => this.startTour(), 500);
    this.handleLaunchParams();
  },
  // Atajos del APK / accesos directos (?go=ganaderia | ?quick=1)
  handleLaunchParams() {
    let p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
    const go = p.get('go'); const quick = p.get('quick');
    const valid = ['dashboard', 'ganaderia', 'personales', 'ingresos', 'ajustes'];
    if (go && valid.includes(go)) this.go(go);
    if (quick) setTimeout(() => this.quickExpense(), 350);
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
      ingresos:'renderIngresos', tareas:'renderTareas', ajustes:'renderAjustes' };
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
    this.addTableSearch(el);
  },
  // Lupa de búsqueda automática sobre cada tabla con varias filas
  addTableSearch(el) {
    $$('.table-wrap', el).forEach(w => {
      const tb = $('table', w); if (!tb) return;
      const rows = $$('tbody tr', tb); if (rows.length < 3) return;
      const box = document.createElement('div'); box.className = 'tbl-search';
      box.innerHTML = `<span data-icon="search" data-size="16"></span><input type="text" placeholder="Buscar..." aria-label="Buscar en la tabla">`;
      w.parentNode.insertBefore(box, w);
      const inp = $('input', box);
      inp.oninput = () => { const q = inp.value.toLowerCase().trim();
        let visibles = 0;
        $$('tbody tr', tb).forEach(tr => { const ok = !q || tr.textContent.toLowerCase().includes(q); tr.style.display = ok ? '' : 'none'; if (ok) visibles++; });
        let empty = $('.tbl-noresult', w);
        if (!visibles) { if (!empty) { empty = document.createElement('div'); empty.className = 'tbl-noresult'; empty.textContent = 'Sin resultados para "' + inp.value + '"'; w.appendChild(empty); } }
        else if (empty) empty.remove();
      };
      this.injectIcons(box);
    });
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
      ['ventas','Ventas','trending'],['gastos','Gastos','arrowDown'],['fijos','Fijos','clock'],['empleados','Empleados','workers'],
      ['prestamos','Préstamos','coins'],['deudas','Deudas','receipt']];
    let h = this.head('Ganadería', 'Operación del campo');
    h += `<div class="subtabs">${tabs.map(([k, l, ic]) =>
      `<button class="subtab ${k === t ? 'on' : ''}" data-sub="${k}"><span data-icon="${ic}" data-size="17"></span> ${l}</button>`).join('')}</div>`;
    h += `<div class="subtab-body">${this['gan_' + t]()}</div>`;
    this.paint('ganaderia', h);
    const root = $('#screen-ganaderia');
    $$('.subtab', root).forEach(b => b.onclick = () => { this.ganTab = b.dataset.sub; this.renderGanaderia(); });
    const addMap = { animales:() => this.formAnimal(), compras:() => this.formCompra(), ventas:() => this.formVenta(),
      gastos:() => this.formExpense('ganaderia'), empleados:() => this.formEmpleado(), prestamos:() => this.formLoan(), deudas:() => this.formSalida('ganaderia') };
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
      ['Muertes', Store.totalMuertes(), 'skull', 'expense', 'Cabezas registradas'],
      ['Ingresos ganadería', money(f.ingreso), 'coins', 'income', 'Ventas + otros'],
      ['Salidas ganadería', money(f.salida), 'arrowDown', 'expense', 'Compras, gastos, salarios'],
    ]);
    h += this.panel('Muertes por motivo', reasons.length ? `<div style="padding:8px 22px 18px">${reasons.map(r => `
        <div class="cat-row"><div class="cat-top"><span><span data-icon="skull" data-size="15"></span> ${esc(r.motivo)}</span><b>${r.n}</b></div>
        <div class="cat-track"><div class="cat-fill" style="width:${(r.n / maxR) * 100}%"></div></div></div>`).join('')}</div>`
      : this.emptyState('skull', 'Sin muertes registradas. Registrá los animales en la pestaña Animales.'));
    return h;
  },

  // ----- Animales (nacimientos por cantidad) + muertes del hato -----
  gan_animales() {
    const all = Store.animals();
    const deaths = Store.deaths();
    const nacTable = all.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>#</th><th>Categoría</th><th>Raza</th><th class="num">Cantidad</th><th>Edad</th><th>Fecha</th><th>Acciones</th></tr></thead>
      <tbody>${all.slice().reverse().map((a, i) => `<tr>
        <td><b>#${all.length - i}</b></td><td>${esc(a.categoria)}</td><td>${esc(a.raza || '—')}</td>
        <td class="num"><b>${Store.loteTotal(a)}</b></td><td>${a.edad_meses || 0} m</td><td>${fdate(a.fecha_ingreso)}</td>
        <td class="actions">
          <button class="iconbtn" data-edit="${a.id}" title="Editar"><span data-icon="edit" data-size="16"></span></button>
          <button class="iconbtn danger" data-del="${a.id}" title="Eliminar"><span data-icon="trash" data-size="16"></span></button>
        </td></tr>`).join('')}</tbody></table></div>` : this.emptyState('cow', 'Sin nacimientos. Las crías del campo se registran acá; los comprados van en Compras.');
    const deathTable = deaths.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Fecha</th><th>Categoría</th><th>Motivo</th><th class="num">Cabezas</th><th></th></tr></thead>
      <tbody>${deaths.slice().reverse().map(d => `<tr><td>${fdate(d.fecha)}</td><td>${esc(d.categoria || '—')}</td>
        <td><span style="display:inline-flex;align-items:center;gap:7px"><span data-icon="skull" data-size="15"></span>${esc(d.motivo)}</span></td>
        <td class="num"><b>${d.cantidad}</b></td>
        <td class="actions"><button class="iconbtn danger" data-deldeath="${d.id}" title="Eliminar"><span data-icon="trash" data-size="16"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('skull', 'Sin muertes registradas.');
    return `<p class="muted" style="font-size:13px;margin-bottom:14px">Cabezas vivas = <b>nacidas + compradas − vendidas − muertas</b>. Las muertes (de nacidas o compradas) se registran con el botón rojo.</p>`
      + this.miniStats([
      ['Cabezas vivas (total)', Store.headCount(), 'cow', 'income'], ['Nacidas', Store.bornHeads(), 'sparkles', ''],
      ['Compradas', Store.boughtHeads(), 'cart', ''], ['Muertas', Store.totalMuertes(), 'skull', 'expense'],
    ])
    + `<div class="panel"><div class="panel-head"><h3>Hato — nacimientos</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-danger btn-sm" id="addDeath"><span data-icon="skull"></span> Registrar muerte</button>
          <button class="btn btn-primary btn-sm" id="subAdd"><span data-icon="plus"></span> Registrar nacimiento</button>
        </div></div><div class="panel-body">${nacTable}</div></div>`
    + `<div class="section"><div class="section-title"><span data-icon="skull"></span> Muertes registradas</div>
        <div class="panel"><div class="panel-body">${deathTable}</div></div></div>`;
  },
  // Botón grande y claro para registrar muertes del hato (nacidas o compradas)
  deathModal() {
    const body = `<p class="sub" style="margin-bottom:16px;color:var(--c-muted)">Registrá las cabezas que murieron. Se descuentan del total del hato.</p>
      <div class="form-grid">
        <div class="field"><label>¿Cuántas murieron? <span class="req">*</span></label><div class="control"><input type="number" id="dCant" min="1" value="1" autofocus></div></div>
        <div class="field"><label>Categoría (opcional)</label><div class="control"><input id="dCat" list="dl-animalcats" placeholder="Ej: Vaca, Ternero..."></div></div>
        <div class="field col-2"><label>Motivo <span class="req">*</span></label><div class="control"><input id="dMot" list="dl-motivos" placeholder="Ej: enfermedad, accidente, parto, robo..."></div></div>
        <div class="field col-2"><label>Fecha</label><div class="control"><input type="date" id="dFecha" value="${Store.today()}"></div></div>
      </div>`;
    this.openModal('Registrar muerte', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Registrar muerte', cls: 'btn-danger', icon: 'skull', fn: () => {
        const c = +$('#dCant').value || 0; if (c < 1) return toast('Ingresá cuántas murieron');
        Store.addDeath({ cantidad: c, motivo: $('#dMot').value.trim() || 'Sin especificar', categoria: $('#dCat').value.trim(), fecha: $('#dFecha').value });
        this.closeModal(); toast('Muerte registrada'); this.refresh();
      } },
    ]);
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
        <td class="actions">
          ${x.comprobante ? `<button class="iconbtn" data-vcexp="${x.id}" title="Ver comprobante"><span data-icon="receipt" data-size="16"></span></button>` : ''}
          <button class="iconbtn danger" data-del="${x.id}"><span data-icon="trash" data-size="17"></span></button></td>
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
    const rows = Store.payables().filter(p => p.domain !== 'personal');
    const totalPagar = rows.filter(p => p.estado !== 'pagado').reduce((s, p) => s + (p.monto_total - p.pagado), 0);
    const table = rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Proveedor</th><th>Descripción</th><th class="num">Total</th><th class="num">Pagado</th><th class="num">Pendiente</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows.slice().reverse().map(p => `<tr><td>${esc(p.proveedor || '—')}</td><td>${esc(p.descripcion || '—')}</td>
        <td class="num">${money(p.monto_total)}</td><td class="num">${money(p.pagado)}</td><td class="num">${money(p.monto_total - p.pagado)}</td>
        <td>${fdate(p.vencimiento)}</td><td><span class="badge ${p.estado === 'pagado' ? 'ok' : 'pend'}">${p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span></td>
        <td class="actions">${p.estado !== 'pagado' ? `<button class="iconbtn ok" data-pay="${p.id}" title="Marcar pagado"><span data-icon="check" data-size="17"></span></button>` : ''}
          <button class="iconbtn danger" data-del="${p.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('receipt', 'Sin cuentas por pagar.');
    return this.miniStats([['Total por pagar', money(totalPagar), 'arrowDown', 'expense'],
      ['Cuentas', rows.length, 'receipt'], ['Pendientes', rows.filter(p => p.estado !== 'pagado').length, 'clock', 'warn']])
      + this.panelAdd('Cuentas por pagar', 'Nueva cuenta', 'receipt', table);
  },

  // ----- Préstamos -----
  gan_prestamos() {
    const loans = Store.loans();
    const totalPrestado = loans.reduce((s, l) => s + (+l.monto || 0), 0);
    const totalPend = Store.loansPendingTotal();
    const table = loans.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Prestamista</th><th>Fecha</th><th class="num">Monto</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Vence</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${loans.slice().reverse().map(l => { const pagado = Store.loanPaid(l), saldo = Store.loanBalance(l); const pagado_full = saldo <= 0;
        return `<tr><td><b>${esc(l.prestamista || '—')}</b>${l.interes_pct ? ` <span class="muted" style="font-size:11px">${l.interes_pct}%</span>` : ''}</td>
        <td>${fdate(l.fecha)}</td><td class="num">${money(l.monto)}</td><td class="num">${money(pagado)}</td>
        <td class="num"><b>${money(saldo)}</b></td><td>${fdate(l.vencimiento)}</td>
        <td><span class="badge ${pagado_full ? 'ok' : 'pend'}">${pagado_full ? 'Pagado' : 'Pendiente'}</span></td>
        <td class="actions">
          ${!pagado_full ? `<button class="iconbtn ok" data-payloan="${l.id}" title="Registrar pago"><span data-icon="cash" data-size="16"></span></button>` : ''}
          <button class="iconbtn" data-editloan="${l.id}" title="Editar"><span data-icon="edit" data-size="16"></span></button>
          <button class="iconbtn danger" data-delloan="${l.id}" title="Eliminar"><span data-icon="trash" data-size="16"></span></button>
        </td></tr>`; }).join('')}</tbody></table></div>` : this.emptyState('coins', 'Sin préstamos registrados. Acá cargás los créditos que pediste; después podés pagar compras "con el préstamo".');
    return this.miniStats([
      ['Total prestado', money(totalPrestado), 'coins', ''], ['Saldo por pagar', money(totalPend), 'arrowDown', 'expense'],
      ['Préstamos', loans.length, 'receipt'],
    ]) + this.panelAdd('Préstamos', 'Nuevo préstamo', 'coins', table);
  },
  formLoan(id) {
    const l = id ? Store.loans().find(x => x.id === id) : {};
    const banks = Store.banks();
    const body = `<div class="form-grid">
      <div class="field"><label>Prestamista <span class="req">*</span></label><div class="control"><input id="lProv" list="dl-prestamistas" value="${esc(l.prestamista || '')}" placeholder="Banco / persona que prestó"></div></div>
      <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input type="number" id="lMonto" value="${l.monto || 0}"></div></div>
      <div class="field"><label>Fecha</label><div class="control"><input type="date" id="lFecha" value="${l.fecha || Store.today()}"></div></div>
      <div class="field"><label>Vencimiento</label><div class="control"><input type="date" id="lVence" value="${l.vencimiento || ''}"></div></div>
      <div class="field"><label>Interés (%)</label><div class="control"><input type="number" id="lInt" value="${l.interes_pct || 0}"></div></div>
      <div class="field"><label>Banco donde entró</label><select class="control" id="lBank"><option value="">Ninguno</option>${banks.map(b => `<option value="${b.id}" ${l.bank_id === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div>
      <div class="field col-2"><label>Notas</label><div class="control"><input id="lNotas" value="${esc(l.notas || '')}" placeholder="Para qué fue, condiciones, etc."></div></div>
    </div>`;
    this.openModal(id ? 'Editar préstamo' : 'Nuevo préstamo', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const prov = $('#lProv').value.trim(); const monto = +$('#lMonto').value;
        if (!prov) return toast('Falta el prestamista'); if (!monto || monto <= 0) return toast('Ingresá el monto');
        const data = { prestamista: prov, monto, fecha: $('#lFecha').value, vencimiento: $('#lVence').value,
          interes_pct: +$('#lInt').value || 0, bank_id: $('#lBank').value || null, notas: $('#lNotas').value.trim() };
        id ? Store.updateLoan(id, data) : Store.addLoan(data);
        this.closeModal(); toast('Préstamo guardado'); this.refresh();
      } },
    ]);
  },
  payLoanModal(id) {
    const l = Store.loans().find(x => x.id === id); if (!l) return;
    const saldo = Store.loanBalance(l); const banks = Store.banks();
    const body = `<p class="sub" style="margin-bottom:16px;color:var(--c-muted)">Pago a <b>${esc(l.prestamista)}</b> — saldo: <b>${money(saldo)}</b></p>
      <div class="form-grid">
        <div class="field"><label>Monto a pagar <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input type="number" id="plMonto" value="${saldo}"></div></div>
        <div class="field"><label>Fecha</label><div class="control"><input type="date" id="plFecha" value="${Store.today()}"></div></div>
        <div class="field col-2"><label>Banco</label><select class="control" id="plBank"><option value="">Efectivo</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
      </div>`;
    this.openModal('Registrar pago de préstamo', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Registrar pago', cls: 'btn-primary', icon: 'check', fn: () => {
        const monto = +$('#plMonto').value; if (!monto || monto <= 0) return toast('Ingresá el monto');
        Store.payLoan(id, { monto, fecha: $('#plFecha').value, bank_id: $('#plBank').value || null });
        this.closeModal(); toast('Pago registrado'); this.refresh();
      } },
    ]);
  },

  // ----- Binding de filas según sub-tab -----
  bindGan(root, t) {
    if (t === 'compras') $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removePurchase(b.dataset.del)));
    if (t === 'ventas') $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeSale(b.dataset.del)));
    if (t === 'gastos') {
      $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeExpense(b.dataset.del)));
      $$('[data-vcexp]', root).forEach(b => b.onclick = () => { const e = Store.expenses().find(x => x.id === b.dataset.vcexp); if (e) this.verComprobante(e.comprobante); });
    }
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
      const ad = $('#addDeath', root); if (ad) ad.onclick = () => this.deathModal();
      $$('[data-edit]', root).forEach(b => b.onclick = () => this.formAnimal(b.dataset.edit));
      $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeAnimal(b.dataset.del)));
      $$('[data-deldeath]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeDeath(b.dataset.deldeath)));
    }
    if (t === 'prestamos') {
      $$('[data-payloan]', root).forEach(b => b.onclick = () => this.payLoanModal(b.dataset.payloan));
      $$('[data-editloan]', root).forEach(b => b.onclick = () => this.formLoan(b.dataset.editloan));
      $$('[data-delloan]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeLoan(b.dataset.delloan)));
    }
    if (t === 'fijos') this.bindFijos(root, 'ganaderia');
  },

  // ============================================================
  //  GASTOS FIJOS / RECURRENTES + sueldos del mes
  // ============================================================
  fijosView(domain, withSalaries) {
    const month = monthKey();
    const monthName = new Date().toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
    const total = Store.recurringMonthlyTotal(domain) + (withSalaries ? Store.nominaMensual() : 0);
    let h = this.miniStats([
      ['Fijos mensuales', money(total), 'clock', 'warn', 'Se repiten cada mes'],
      ['Mes actual', monthName, 'calendar', '', 'Pagos y pendientes'],
    ]);
    h += `<p class="muted" style="font-size:13px;margin:-6px 2px 16px">Los gastos fijos se contemplan automáticamente para el próximo mes. Marcá cada uno cuando lo pagues.</p>`;

    if (withSalaries) {
      const emps = Store.activeEmployees();
      h += `<div class="panel"><div class="panel-head"><h3>Sueldos del mes</h3>
        <button class="btn btn-ghost btn-sm" id="shareMonth"><span data-icon="pdf"></span> Compartir resumen (PDF)</button></div>
        <div class="panel-body">${emps.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Empleado</th><th>Puesto</th><th class="num">Sueldo</th><th>Estado (${monthName})</th><th>Acciones</th></tr></thead>
        <tbody>${emps.map(e => { const pago = Store.employeePaidIn(e.id, month); return `<tr>
          <td><b>${esc(e.nombre)}</b></td><td>${esc(e.puesto)}</td><td class="num">${money(e.salario)}</td>
          <td>${pago ? `<span class="badge ok">Pagado ${fdate(pago.fecha)}</span>` : `<span class="badge pend">Pendiente</span>`}</td>
          <td class="actions">
            ${pago ? (pago.comprobante ? `<button class="iconbtn" data-vercompemp="${e.id}" title="Ver comprobante"><span data-icon="receipt" data-size="16"></span></button>` : '')
                   : `<button class="btn btn-primary btn-sm" data-paysal="${e.id}">Pagar sueldo</button>`}
            <button class="iconbtn" data-histemp="${e.id}" title="Extracto / PDF"><span data-icon="eye" data-size="16"></span></button>
          </td></tr>`; }).join('')}</tbody></table></div>` : this.emptyState('workers', 'Sin empleados activos. Agregalos en la pestaña Empleados.')}</div></div>`;
    }

    const recs = Store.recurring(domain);
    h += `<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Otros gastos fijos</h3>
      <button class="btn btn-primary btn-sm" id="addRec"><span data-icon="plus"></span> Agregar gasto fijo</button></div>
      <div class="panel-body">${recs.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Nombre</th><th>Categoría</th><th class="num">Monto</th><th>Estado (${monthName})</th><th>Acciones</th></tr></thead>
      <tbody>${recs.map(r => { const paid = Store.recurringPaidIn(r.id, month); return `<tr>
        <td><b>${esc(r.nombre)}</b></td><td>${esc(r.categoria)}</td><td class="num">${money(r.monto)}</td>
        <td>${paid ? '<span class="badge ok">Pagado</span>' : '<span class="badge pend">Pendiente</span>'}</td>
        <td class="actions">
          ${paid ? `<button class="iconbtn" data-unpay="${r.id}" title="Desmarcar pago"><span data-icon="close" data-size="16"></span></button>`
                 : `<button class="btn btn-primary btn-sm" data-payrec="${r.id}">Marcar pagado</button>`}
          <button class="iconbtn" data-editrec="${r.id}"><span data-icon="edit" data-size="16"></span></button>
          <button class="iconbtn danger" data-delrec="${r.id}"><span data-icon="trash" data-size="16"></span></button>
        </td></tr>`; }).join('')}</tbody></table></div>` : this.emptyState('clock', 'Sin gastos fijos. Agregá uno (ej: alquiler, internet, forraje mensual).')}</div></div>`;
    return h;
  },
  gan_fijos() { return this.fijosView('ganaderia', true); },

  bindFijos(root, domain) {
    const month = monthKey();
    const sm = $('#shareMonth', root); if (sm) sm.onclick = () => this.exportMonthlyStatement(month);
    const ar = $('#addRec', root); if (ar) ar.onclick = () => this.formRecurring(null, domain);
    $$('[data-paysal]', root).forEach(b => b.onclick = () => this.formPagoEmpleado(b.dataset.paysal));
    $$('[data-histemp]', root).forEach(b => b.onclick = () => this.empleadoHist(b.dataset.histemp));
    $$('[data-vercompemp]', root).forEach(b => b.onclick = () => { const p = Store.employeePaidIn(b.dataset.vercompemp, month); if (p) this.verComprobante(p.comprobante); });
    $$('[data-payrec]', root).forEach(b => b.onclick = () => this.payRecurringModal(b.dataset.payrec));
    $$('[data-unpay]', root).forEach(b => b.onclick = () => { Store.unmarkRecurringPaid(b.dataset.unpay, month); toast('Pago desmarcado'); this.refresh(); });
    $$('[data-editrec]', root).forEach(b => b.onclick = () => this.formRecurring(b.dataset.editrec, domain));
    $$('[data-delrec]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeRecurring(b.dataset.delrec)));
  },

  formRecurring(id, domain) {
    const r = id ? Store.recurring().find(x => x.id === id) || Store.all().recurring.find(x => x.id === id) : {};
    const banks = Store.banks();
    const body = `<div class="form-grid">
      <div class="field col-2"><label>¿Qué gasto fijo es? <span class="req">*</span></label><div class="control"><input id="rcNom" list="dl-gastos" value="${esc(r.nombre || '')}" placeholder="Ej: Alquiler del campo, Sueldo del vaquero..."></div></div>
      <div class="field"><label>Monto mensual <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input type="number" id="rcMonto" value="${r.monto || ''}" placeholder="0"></div></div>
      <div class="field"><label>Día del mes</label><div class="control"><input type="number" id="rcDia" min="1" max="31" value="${r.dia || 1}"></div></div>
      <div class="field col-2"><label>Banco</label><select class="control" id="rcBank"><option value="">Ninguno</option>${banks.map(b => `<option value="${b.id}" ${r.bank_id === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div>
    </div>`;
    this.openModal(id ? 'Editar gasto fijo' : 'Nuevo gasto fijo', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const nom = $('#rcNom').value.trim(), monto = +$('#rcMonto').value;
        if (!nom) return toast('Falta el nombre'); if (!monto) return toast('Falta el monto');
        const data = { domain: domain || r.domain || 'ganaderia', nombre: nom, monto, dia: +$('#rcDia').value || 1, categoria: nom, bank_id: $('#rcBank').value || null };
        id ? Store.updateRecurring(id, data) : Store.addRecurring(data);
        this.closeModal(); toast('Gasto fijo guardado'); this.refresh();
      } },
    ]);
  },

  payRecurringModal(id) {
    const r = Store.all().recurring.find(x => x.id === id); if (!r) return;
    const month = monthKey();
    const banks = Store.banks();
    const body = `<p class="sub" style="margin-bottom:16px;color:var(--c-muted)">Marcar <b>${esc(r.nombre)}</b> (${money(r.monto)}) como pagado este mes.</p>
      <div class="form-grid">
        <div class="field"><label>Banco</label><select class="control" id="prBank"><option value="">Efectivo</option>${banks.map(b => `<option value="${b.id}" ${r.bank_id === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Comprobante (foto/PDF)</label><div class="control"><input type="file" id="prComp" accept="image/*,application/pdf"></div></div>
      </div>`;
    this.openModal('Pagar gasto fijo', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Marcar pagado', cls: 'btn-primary', icon: 'check', fn: async () => {
        const comp = await this.fileToDataURL($('#prComp'));
        Store.markRecurringPaid(id, month, { bank_id: $('#prBank').value || null, comprobante: comp });
        this.closeModal(); toast('Pago registrado'); this.refresh();
      } },
    ]);
  },

  // Extracto del mes para compartir con los trabajadores (PDF imprimible)
  exportMonthlyStatement(month) {
    const monthName = new Date(month + '-01T00:00:00').toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
    const emps = Store.activeEmployees();
    const recs = Store.recurring('ganaderia');
    const filas = emps.map(e => { const p = Store.employeePaidIn(e.id, month);
      return `<tr><td>${esc(e.nombre)}</td><td>${esc(e.puesto)}</td><td class="num">${money(e.salario)}</td>
        <td>${p ? 'PAGADO (' + fdate(p.fecha) + ')' : 'PENDIENTE'}</td></tr>`; }).join('');
    const recFilas = recs.map(r => { const paid = Store.recurringPaidIn(r.id, month);
      return `<tr><td>${esc(r.nombre)}</td><td>${esc(r.categoria)}</td><td class="num">${money(r.monto)}</td><td>${paid ? 'PAGADO' : 'PENDIENTE'}</td></tr>`; }).join('');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Extracto ${monthName}</title>
      <style>body{font-family:Arial,sans-serif;color:#1c1a14;padding:38px;max-width:760px;margin:0 auto}
      .hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #c8a44d;padding-bottom:16px;margin-bottom:24px}
      .hd img{width:80px;height:80px;object-fit:contain}.hd h1{font-size:21px;margin:0}.hd p{margin:2px 0;color:#666;font-size:13px}
      h2{font-size:15px;margin:22px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#f3efe3;text-align:left;padding:9px 12px;border-bottom:2px solid #ddd}
      td{padding:9px 12px;border-bottom:1px solid #eee}.num{text-align:right}
      .foot{margin-top:30px;font-size:11px;color:#999;text-align:center}</style></head><body>
      <div class="hd"><img src="${location.origin}${location.pathname.replace(/index\.html$/, '')}assets/img/logo.jpg">
        <div><h1>Ganadería Dyck Manantial</h1><p>Extracto de pagos — ${monthName}</p>
        <p>Emitido: ${new Date().toLocaleDateString('es-BO')}</p></div></div>
      <h2>Sueldos</h2><table><thead><tr><th>Empleado</th><th>Puesto</th><th class="num">Sueldo</th><th>Estado</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="4">Sin empleados</td></tr>'}</tbody></table>
      <h2>Gastos fijos</h2><table><thead><tr><th>Nombre</th><th>Categoría</th><th class="num">Monto</th><th>Estado</th></tr></thead>
        <tbody>${recFilas || '<tr><td colspan="4">Sin gastos fijos</td></tr>'}</tbody></table>
      <div class="foot">Documento generado por el sistema Dyck Manantial</div>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  },

  // Helpers de comprobantes
  fileToDataURL(input) {
    return new Promise(res => {
      const f = input && input.files && input.files[0]; if (!f) return res(null);
      if (f.size > 2 * 1024 * 1024) { toast('Archivo muy pesado (máx 2MB)'); return res(null); }
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f);
    });
  },
  verComprobante(data) {
    if (!data) return toast('Sin comprobante');
    const w = window.open('', '_blank');
    if (String(data).startsWith('data:application/pdf')) w.document.write(`<iframe src="${data}" style="border:0;width:100%;height:100vh"></iframe>`);
    else w.document.write(`<img src="${data}" style="max-width:100%;display:block;margin:auto">`);
    w.document.close();
  },

  // ----- Form animal -----
  formAnimal(id) {
    const a = id ? Store.animals().find(x => x.id === id) : {};
    const body = `<p class="sub" style="margin-bottom:14px;color:var(--c-muted)">Para crías nacidas en el campo. Los animales <b>comprados</b> se registran en la pestaña <b>Compras</b> (con precio).</p>
    <div class="form-grid">
      <div class="field"><label>Cantidad de crías <span class="req">*</span></label><div class="control"><input type="number" id="anCant" min="1" value="${id ? Store.loteTotal(a) : 1}" placeholder="Ej: 12"></div></div>
      <div class="field"><label>Categoría</label><select class="control" id="anCat">${opt(ANIMAL_CATS, a.categoria || 'Ternero')}</select></div>
      <div class="field"><label>Raza</label><div class="control"><input id="anRaza" value="${esc(a.raza || '')}" placeholder="Ej: Nelore"></div></div>
      <div class="field"><label>Edad promedio (meses)</label><div class="control"><input type="number" id="anEdad" value="${a.edad_meses || 0}"></div></div>
      <div class="field"><label>Peso promedio (kg)</label><div class="control"><input type="number" id="anPeso" value="${a.peso || 0}"></div></div>
      <div class="field"><label>Fecha de nacimiento</label><div class="control"><input type="date" id="anFecha" value="${a.fecha_ingreso || Store.today()}"></div></div>
    </div>${id ? `<p class="muted" style="font-size:12.5px;margin-top:6px">Para registrar muertes usá el botón de la fila.</p>` : ''}`;
    this.openModal(id ? 'Editar nacimiento' : 'Registrar nacimiento', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const cant = +$('#anCant').value || 0; if (cant < 1) return toast('Ingresá la cantidad de crías');
        const data = { cantidad: cant, categoria: $('#anCat').value, raza: $('#anRaza').value.trim(),
          edad_meses: +$('#anEdad').value || 0, peso: +$('#anPeso').value || 0,
          origen: 'nacimiento', fecha_ingreso: $('#anFecha').value };
        id ? Store.updateAnimal(id, data) : Store.addAnimal(data);
        this.closeModal(); toast('Nacimiento registrado'); this.refresh();
      } },
    ]);
  },
  formCompra() {
    this.formItems = [];
    const banks = Store.banks();
    const loans = Store.loans().filter(l => Store.loanBalance(l) > 0 || true);
    const metodos = [...METODOS, 'Préstamo'];
    const loanOpts = loans.length ? loans.map(l => `<option value="${l.id}">${esc(l.prestamista)} — saldo ${money(Store.loanBalance(l))}</option>`).join('')
      : `<option value="">(no hay préstamos registrados — cargalos en la pestaña Préstamos)</option>`;
    const body = `
      <div class="form-grid">
        <div class="field"><label>Fecha <span class="req">*</span></label><div class="control"><input type="date" id="cFecha" value="${Store.today()}"></div></div>
        <div class="field"><label>Proveedor <span class="req">*</span></label><div class="control"><input id="cProv" list="dl-proveedores" placeholder="Nombre del proveedor"></div></div>
        <div class="field"><label>Cuenta Bancaria</label><select class="control" id="cBank"><option value="">Ninguna</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Método de Pago</label><select class="control" id="cMetodo">${opt(metodos, 'Efectivo')}</select></div>
        <div class="field col-2" id="cLoanWrap" style="display:none"><label>¿Con qué préstamo se pagó?</label><select class="control" id="cLoan">${loanOpts}</select>
          <p class="muted" style="font-size:12px;margin-top:5px">Pagar con préstamo NO genera deuda nueva (la deuda ya es el préstamo).</p></div>
        <div class="field col-2"><label>Precio total de la compra (opcional)</label><div class="control"><span class="prefix">Bs</span><input type="number" id="cTotal" placeholder="Si comprás a precio cerrado, poné el total acá"></div></div>
        <div class="field col-2"><label>Observaciones</label><textarea class="control" id="cObs" placeholder="Notas adicionales"></textarea></div>
      </div>
      <div class="section-title" style="margin-top:18px"><span data-icon="cow"></span> Agregar animales</div>
      <div class="form-grid">
        <div class="field"><label>Categoría</label><select class="control" id="aCat">${opt(ANIMAL_CATS, 'Vaca')}</select></div>
        <div class="field"><label>Raza</label><div class="control"><input id="aRaza" list="dl-razas" placeholder="Raza del animal"></div></div>
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
    $('#cMetodo').onchange = () => { $('#cLoanWrap').style.display = $('#cMetodo').value === 'Préstamo' ? '' : 'none'; };
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
    const metodo = $('#cMetodo').value;
    const loan_id = metodo === 'Préstamo' ? ($('#cLoan').value || null) : null;
    Store.addPurchase({ fecha: $('#cFecha').value, proveedor: prov, bank_id: $('#cBank').value || null,
      metodo_pago: metodo, observaciones: $('#cObs').value, items: this.formItems,
      total: +$('#cTotal').value || 0, loan_id });
    this.closeModal(); toast('Compra registrada'); this.refresh();
  },

  formVenta() {
    this.formItems = [];
    const banks = Store.banks();
    const body = `<div class="form-grid">
        <div class="field"><label>Fecha <span class="req">*</span></label><div class="control"><input type="date" id="vFecha" value="${Store.today()}"></div></div>
        <div class="field"><label>Cliente <span class="req">*</span></label><div class="control"><input id="vCli" list="dl-clientes" placeholder="Nombre del cliente"></div></div>
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
    const deudas = Store.payables().filter(p => p.domain === 'personal');
    const totalDeuda = deudas.filter(p => p.estado !== 'pagado').reduce((s, p) => s + (p.monto_total - p.pagado), 0);
    let h = this.head('Gastos personales', 'Tus salidas de la vida personal', 'Nuevo gasto', 'arrowDown', () => this.formExpense('personal'));
    h += this.miniStats([['Total gastado', money(total), 'arrowDown', 'expense'], ['Movimientos', rows.length, 'receipt'],
      ['Deudas pendientes', money(totalDeuda), 'clock', 'warn']]);
    h += this.panel('Historial de gastos personales', this.expenseTable(rows));
    const deudaTable = deudas.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>A quién</th><th>Descripción</th><th class="num">Total</th><th class="num">Pagado</th><th class="num">Pendiente</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
      <tbody>${deudas.slice().reverse().map(p => `<tr><td>${esc(p.proveedor || '—')}</td><td>${esc(p.descripcion || '—')}</td>
        <td class="num">${money(p.monto_total)}</td><td class="num">${money(p.pagado)}</td><td class="num">${money(p.monto_total - p.pagado)}</td>
        <td>${fdate(p.vencimiento)}</td><td><span class="badge ${p.estado === 'pagado' ? 'ok' : 'pend'}">${p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span></td>
        <td class="actions">${p.estado !== 'pagado' ? `<button class="iconbtn ok" data-ppay="${p.id}" title="Marcar pagado"><span data-icon="check" data-size="17"></span></button>` : ''}
          <button class="iconbtn danger" data-pdel="${p.id}"><span data-icon="trash" data-size="17"></span></button></td></tr>`).join('')}</tbody></table></div>`
      : this.emptyState('receipt', 'Sin deudas personales.');
    h += `<div class="section"><div class="section-title"><span data-icon="receipt"></span> Deudas personales</div>
      <div class="panel"><div class="panel-head"><h3>Cuentas por pagar personales</h3>
        <button class="btn btn-primary btn-sm" id="persDeudaAdd"><span data-icon="receipt"></span> Nueva deuda</button></div>
        <div class="panel-body">${deudaTable}</div></div></div>`;
    h += `<div class="section"><div class="section-title"><span data-icon="clock"></span> Gastos fijos personales</div>${this.fijosView('personal', false)}</div>`;
    this.paint('personales', h);
    const root = $('#screen-personales');
    $$('[data-del]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeExpense(b.dataset.del)));
    $$('[data-vcexp]', root).forEach(b => b.onclick = () => { const e = Store.expenses().find(x => x.id === b.dataset.vcexp); if (e) this.verComprobante(e.comprobante); });
    const da = $('#persDeudaAdd', root); if (da) da.onclick = () => this.formSalida('personal');
    $$('[data-ppay]', root).forEach(b => b.onclick = () => { Store.payPayable(b.dataset.ppay); toast('Marcado como pagado'); this.refresh(); });
    $$('[data-pdel]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removePayable(b.dataset.pdel)));
    this.bindFijos(root, 'personal');
  },

  // ============================================================
  //  INGRESOS (unificado: ingresos + ventas de ganado)
  // ============================================================
  renderIngresos() {
    const inc = Store.incomes().map(x => ({ k: 'inc', id: x.id, fecha: x.fecha, fuente: x.categoria, area: x.domain,
      bank: x.bank_id, monto: x.monto, det: x.descripcion || '—', venta: false, comp: x.comprobante }));
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
        <td class="actions">
          ${r.k === 'inc' && r.comp ? `<button class="iconbtn" data-vcinc="${r.id}" title="Ver comprobante"><span data-icon="receipt" data-size="16"></span></button>` : ''}
          <button class="iconbtn danger" data-${r.k}="${r.id}"><span data-icon="trash" data-size="17"></span></button></td>
      </tr>`).join('')}</tbody></table></div>` : this.emptyState('coins', 'Sin ingresos. Las ventas de ganado también aparecen acá.'));
    this.paint('ingresos', h);
    const root = $('#screen-ingresos');
    $$('[data-inc]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeIncome(b.dataset.inc)));
    $$('[data-sale]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeSale(b.dataset.sale)));
    $$('[data-vcinc]', root).forEach(b => b.onclick = () => { const i = Store.incomes().find(x => x.id === b.dataset.vcinc); if (i) this.verComprobante(i.comprobante); });
  },

  // ============================================================
  //  TAREAS / PENDIENTES
  // ============================================================
  renderTareas() {
    const tasks = Store.tasks();
    const pend = tasks.filter(t => !t.done);
    const done = tasks.filter(t => t.done);
    const today = Store.today();
    const hoyCount = pend.filter(t => t.fecha === today).length;
    const sorted = pend.slice().sort((a, b) => {
      if (!a.fecha && !b.fecha) return (a.created_at || '').localeCompare(b.created_at || '');
      if (!a.fecha) return 1; if (!b.fecha) return -1; return a.fecha.localeCompare(b.fecha);
    });
    const taskRow = t => {
      const vencida = t.fecha && t.fecha < today, esHoy = t.fecha === today;
      const badge = t.fecha
        ? `<span class="badge ${vencida ? 'pend' : esHoy ? 'warn' : 'off'}">${vencida ? 'Vencida · ' : esHoy ? 'Hoy · ' : ''}${fdate(t.fecha)}</span>`
        : `<span class="badge off">Sin fecha</span>`;
      return `<div class="task-item ${t.done ? 'done' : ''}">
        <button class="task-check ${t.done ? 'on' : ''}" data-toggle="${t.id}" title="${t.done ? 'Marcar pendiente' : 'Marcar hecho'}">${t.done ? '<span data-icon="check" data-size="15"></span>' : ''}</button>
        <div class="task-main"><span class="task-text">${esc(t.texto)}</span> ${badge}</div>
        <button class="iconbtn danger" data-deltask="${t.id}" title="Eliminar"><span data-icon="trash" data-size="16"></span></button>
      </div>`;
    };
    let h = this.head('Tareas', 'Tu lista de pendientes — que no se te escape nada');
    h += this.miniStats([['Pendientes', pend.length, 'tasks', pend.length ? 'warn' : ''],
      ['Para hoy', hoyCount, 'clock', hoyCount ? 'expense' : ''], ['Completadas', done.length, 'check', 'income']]);
    h += `<div class="panel"><div class="panel-body" style="padding:16px">
      <div class="task-add">
        <input id="tkText" placeholder="Escribí una tarea... (ej: vacunar el lote nuevo)" autocomplete="off">
        <input type="date" id="tkDate" title="Fecha (opcional)">
        <button class="btn btn-primary" id="tkAdd"><span data-icon="plus"></span> Agregar</button>
      </div>
      <p class="muted" style="font-size:12px;margin-top:8px">La fecha es opcional. Sin fecha = pendiente general.</p>
    </div></div>`;
    h += `<div class="section"><div class="section-title"><span data-icon="tasks"></span> Pendientes (${pend.length})</div>
      <div class="panel"><div class="panel-body" style="padding:12px 14px">${sorted.length ? sorted.map(taskRow).join('') : this.emptyState('check', '¡Todo al día! No tenés pendientes.')}</div></div></div>`;
    if (done.length) h += `<div class="section"><div class="section-title" style="display:flex;align-items:center;gap:8px"><span data-icon="check"></span> Completadas (${done.length})
        <button class="btn btn-ghost btn-sm" id="tkClear" style="margin-left:auto"><span data-icon="trash"></span> Limpiar</button></div>
      <div class="panel"><div class="panel-body" style="padding:12px 14px">${done.map(taskRow).join('')}</div></div></div>`;
    this.paint('tareas', h);
    const root = $('#screen-tareas');
    const addFn = () => { const txt = $('#tkText', root).value.trim(); if (!txt) return toast('Escribí una tarea');
      Store.addTask({ texto: txt, fecha: $('#tkDate', root).value }); this.refresh(); };
    $('#tkAdd', root).onclick = addFn;
    $('#tkText', root).onkeydown = (e) => { if (e.key === 'Enter') addFn(); };
    $$('[data-toggle]', root).forEach(b => b.onclick = () => { Store.toggleTask(b.dataset.toggle); this.refresh(); });
    $$('[data-deltask]', root).forEach(b => b.onclick = () => { Store.removeTask(b.dataset.deltask); this.refresh(); });
    const cl = $('#tkClear', root); if (cl) cl.onclick = () => this.confirmDelete(() => Store.clearDoneTasks());
  },

  // ----- Formulario de gasto (área fija) -----
  formExpense(domain) {
    const banks = Store.banks();
    const label = domain === 'personal' ? 'Gasto personal' : 'Gasto de ganadería';
    // Sin categorías: Franz escribe libremente en qué fue el gasto.
    const ph = domain === 'personal' ? 'Ej: Almuerzo en el mercado, repuesto en la ferretería...' : 'Ej: Vacunas, forraje, combustible, sueldo del vaquero...';
    const catField = `<div class="field col-2"><label>¿En qué fue el gasto?</label><div class="control"><input id="exCat" list="dl-gastos" placeholder="${ph}"></div></div>`;
    const body = `<div class="form-grid">
        <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input class="amount-big" type="number" id="exMonto" placeholder="0"></div></div>
        <div class="field"><label>Fecha</label><div class="control"><input type="date" id="exFecha" value="${Store.today()}"></div></div>
        ${catField}
        <div class="field"><label>Banco</label><select class="control" id="exBank"><option value="">Ninguno</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Detalle</label><div class="control"><input id="exDesc" placeholder="Opcional"></div></div>
        <div class="field"><label>Comprobante (foto/PDF)</label><div class="control"><input type="file" id="exComp" accept="image/*,application/pdf"></div></div>
      </div>`;
    this.openModal('Registrar ' + label, body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: async () => {
        const monto = +$('#exMonto').value; if (!monto || monto <= 0) return toast('Ingresá un monto válido');
        const comp = await this.fileToDataURL($('#exComp'));
        const categoria = $('#exCat').value.trim() || (domain === 'personal' ? 'Gasto personal' : 'Gasto ganadería');
        Store.addExpense({ domain, fecha: $('#exFecha').value, categoria, bank_id: $('#exBank').value || null, monto, descripcion: $('#exDesc').value.trim(), comprobante: comp });
        this.closeModal(); toast('Gasto registrado'); this.refresh();
      } },
    ]);
  },

  // ----- Formulario de ingreso (área elegible) -----
  formIncome() {
    const banks = Store.banks();
    const body = `<div class="form-grid">
        <div class="field col-2"><label>Área</label><div class="chips area-sel" id="inDom">
          <button class="chip on" data-v="ganaderia"><span data-icon="cow"></span> Ganadería</button>
          <button class="chip" data-v="personal"><span data-icon="user"></span> Personal</button></div></div>
        <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input class="amount-big" type="number" id="inMonto" placeholder="0"></div></div>
        <div class="field"><label>Fecha</label><div class="control"><input type="date" id="inFecha" value="${Store.today()}"></div></div>
        <div class="field col-2"><label>¿De qué fue el ingreso?</label><div class="control"><input id="inCat" list="dl-ingresos" placeholder="Ej: Venta de leche, asesoría, cosecha de soya..."></div></div>
        <div class="field"><label>Banco</label><select class="control" id="inBank"><option value="">Ninguno</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Detalle</label><div class="control"><input id="inDesc" placeholder="Opcional"></div></div>
        <div class="field"><label>Comprobante (foto/PDF)</label><div class="control"><input type="file" id="inComp" accept="image/*,application/pdf"></div></div>
      </div>`;
    this.openModal('Registrar Ingreso', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: async () => {
        const monto = +$('#inMonto').value; if (!monto || monto <= 0) return toast('Ingresá un monto válido');
        const comp = await this.fileToDataURL($('#inComp'));
        Store.addIncome({ domain: this._inDom(), fecha: $('#inFecha').value, categoria: $('#inCat').value.trim() || 'Ingreso', bank_id: $('#inBank').value || null, monto, descripcion: $('#inDesc').value.trim(), comprobante: comp });
        this.closeModal(); toast('Ingreso registrado'); this.refresh();
      } },
    ]);
    let dom = 'ganaderia';
    $$('#inDom .chip').forEach(c => c.onclick = () => { dom = c.dataset.v; $$('#inDom .chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); });
    this._inDom = () => dom;
  },

  // ----- Gasto rápido (botón flotante) -----
  quickExpense() {
    const banks = Store.banks();
    const body = `<p class="sub" style="margin-bottom:16px;color:var(--c-muted)">Registrá un gasto en segundos.</p>
      <div class="form-grid">
        <div class="field col-2"><label>¿Qué tipo de gasto?</label><div class="chips area-sel" id="qDom">
          <button class="chip" data-v="ganaderia"><span data-icon="cow"></span> Ganadería</button>
          <button class="chip on" data-v="personal"><span data-icon="user"></span> Personal</button></div></div>
        <div class="field"><label>Monto <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input class="amount-big" type="number" id="qMonto" placeholder="0" autofocus></div></div>
        <div class="field"><label>Banco</label><select class="control" id="qBank"><option value="">Efectivo</option>${banks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field col-2"><label>¿Qué fue y dónde lo compraste?</label><div class="control"><input id="qCat" list="dl-gastos" placeholder="Ej: Almuerzo en el mercado, repuesto en la ferretería..."></div></div>
      </div>`;
    this.openModal('Gasto rápido', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar gasto', cls: 'btn-primary', icon: 'check', fn: () => {
        const monto = +$('#qMonto').value; if (!monto || monto <= 0) return toast('Ingresá un monto');
        Store.addExpense({ domain: this._qDom(), fecha: Store.today(), categoria: $('#qCat').value.trim() || 'Gasto rápido', bank_id: $('#qBank').value || null, monto, descripcion: '' });
        this.closeModal(); toast('Gasto registrado'); this.refresh();
      } },
    ]);
    let dom = 'personal';
    $$('#qDom .chip').forEach(c => c.onclick = () => { dom = c.dataset.v; $$('#qDom .chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); });
    this._qDom = () => dom;
  },

  formSalida(forceDomain) {
    const areaField = forceDomain ? '' : `<div class="field col-2"><label>Área</label>
          <div class="chips" id="sDomain">
            <button class="chip on" data-v="ganaderia"><span data-icon="cow"></span> Ganadería</button>
            <button class="chip" data-v="personal"><span data-icon="user"></span> Personal</button>
          </div></div>`;
    const placeholder = forceDomain === 'personal' ? 'Ej: cuota del crédito, fiado en la tienda' : 'Ej: saldo compra de ganado';
    const body = `<div class="form-grid">
        ${areaField}
        <div class="field"><label>Proveedor <span class="req">*</span></label><div class="control"><input id="sProv" list="dl-proveedores" placeholder="A quién se le debe"></div></div>
        <div class="field"><label>Vencimiento</label><div class="control"><input type="date" id="sVence"></div></div>
        <div class="field"><label>Monto Total <span class="req">*</span></label><div class="control"><span class="prefix">Bs</span><input type="number" id="sTotal" placeholder="0"></div></div>
        <div class="field"><label>Ya pagado</label><div class="control"><span class="prefix">Bs</span><input type="number" id="sPagado" value="0"></div></div>
        <div class="field col-2"><label>Descripción</label><div class="control"><input id="sDesc" placeholder="${placeholder}"></div></div>
      </div>`;
    const title = forceDomain === 'personal' ? 'Nueva Deuda Personal' : forceDomain === 'ganaderia' ? 'Nueva Deuda de Ganadería' : 'Nueva Cuenta por Pagar';
    this.openModal(title, body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => this.saveSalida() },
    ]);
    let dom = forceDomain || 'ganaderia';
    if (!forceDomain) $$('#sDomain .chip').forEach(c => c.onclick = () => { dom = c.dataset.v; $$('#sDomain .chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); });
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
      <div class="field"><label>Nombre <span class="req">*</span></label><div class="control"><input id="eNom" list="dl-empleados" value="${esc(e.nombre || '')}" placeholder="Nombre completo"></div></div>
      <div class="field"><label>Documento / CI</label><div class="control"><input id="eDoc" value="${esc(e.documento || '')}" placeholder="CI"></div></div>
      <div class="field"><label>Puesto</label><div class="control"><input id="ePue" value="${esc(e.puesto || 'Vaquero')}" placeholder="Vaquero"></div></div>
      <div class="field"><label>Teléfono</label><div class="control"><input id="eTel" value="${esc(e.telefono || '')}" placeholder="Celular"></div></div>
      <div class="field"><label>Salario mensual</label><div class="control"><span class="prefix">Bs</span><input type="number" id="eSal" value="${e.salario || 0}"></div></div>
      <div class="field"><label>Estado</label><select class="control" id="eEst">${opt(['activo','inactivo'], e.estado || 'activo')}</select></div>
      <div class="field"><label>Fecha de ingreso</label><div class="control"><input type="date" id="eIng" value="${e.fecha_ingreso || ''}"></div></div>
      <div class="field"><label>Fecha de nacimiento</label><div class="control"><input type="date" id="eNac" value="${e.fecha_nacimiento || ''}"></div></div>
      <div class="field col-2"><label>Dirección</label><div class="control"><input id="eDir" value="${esc(e.direccion || '')}" placeholder="Dónde vive"></div></div>
      <div class="field col-2"><label>Contacto de emergencia</label><div class="control"><input id="eEmg" value="${esc(e.contacto_emergencia || '')}" placeholder="Nombre y teléfono de un familiar"></div></div>
      <div class="field col-2"><label>Notas</label><div class="control"><input id="eNot" value="${esc(e.notas || '')}" placeholder="Observaciones (opcional)"></div></div>
    </div>`;
    this.openModal(id ? 'Editar Empleado' : 'Nuevo Empleado', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Guardar', cls: 'btn-primary', icon: 'check', fn: () => {
        const nom = $('#eNom').value.trim(); if (!nom) return toast('Falta el nombre');
        const data = { nombre: nom, documento: $('#eDoc').value.trim(), puesto: $('#ePue').value.trim() || 'Vaquero',
          telefono: $('#eTel').value.trim(), salario: +$('#eSal').value || 0, estado: $('#eEst').value,
          fecha_ingreso: $('#eIng').value, fecha_nacimiento: $('#eNac').value, direccion: $('#eDir').value.trim(),
          contacto_emergencia: $('#eEmg').value.trim(), notas: $('#eNot').value.trim() };
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
        <div class="field col-2"><label>Comprobante (foto/PDF)</label><div class="control"><input type="file" id="pComp" accept="image/*,application/pdf"></div></div>
      </div>`;
    this.openModal('Registrar Pago', body, [
      { label: 'Cancelar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Registrar', cls: 'btn-primary', icon: 'check', fn: async () => {
        const monto = +$('#pMonto').value; if (!monto) return toast('Monto inválido');
        const comp = await this.fileToDataURL($('#pComp'));
        Store.payEmployee(id, { monto, fecha: $('#pFecha').value, concepto: $('#pConc').value, bank_id: $('#pBank').value || null, comprobante: comp });
        this.closeModal(); toast('Pago registrado'); this.refresh();
      } },
    ]);
  },
  empleadoHist(id) {
    const e = Store.employees().find(x => x.id === id); if (!e) return;
    const pagos = (e.pagos || []).slice().reverse();
    const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
    const byMonth = {};
    pagos.forEach(p => { const m = (p.fecha || '').slice(0, 7); (byMonth[m] = byMonth[m] || []).push(p); });
    const months = Object.keys(byMonth).sort().reverse();
    const monthBlocks = months.map(m => {
      const label = m ? new Date(m + '-01T00:00:00').toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }) : 'Sin fecha';
      const list = byMonth[m];
      const subt = list.reduce((s, p) => s + p.monto, 0);
      return `<div style="margin-bottom:18px">
        <div class="panel-head" style="padding:0 0 8px">
          <h3 style="text-transform:capitalize">${esc(label)} · ${money(subt)}</h3>
          <button class="btn btn-primary btn-sm" data-mes="${m}"><span data-icon="pdf"></span> Extracto PDF</button></div>
        <table class="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Banco</th><th class="num">Monto</th><th>Comp.</th></tr></thead>
        <tbody>${list.map(p => `<tr><td>${fdate(p.fecha)}</td><td>${esc(p.concepto)}</td><td>${esc(Store.bankName(p.bank_id))}</td><td class="num">${money(p.monto)}</td>
          <td>${p.comprobante ? `<button class="iconbtn" data-vcp="${p.id}" title="Ver comprobante"><span data-icon="receipt" data-size="16"></span></button>` : '—'}</td></tr>`).join('')}</tbody></table>
      </div>`;
    }).join('');
    const fichaRow = (k, v) => v ? `<div class="ficha-row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>` : '';
    const ficha = `<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Ficha del empleado</h3>
        <button class="btn btn-ghost btn-sm" data-editficha title="Editar datos"><span data-icon="edit"></span> Editar</button></div>
      <div class="panel-body" style="padding:14px 18px"><div class="ficha-grid">
        ${fichaRow('Documento / CI', e.documento)}
        ${fichaRow('Puesto', e.puesto)}
        ${fichaRow('Teléfono', e.telefono)}
        ${fichaRow('Fecha de ingreso', e.fecha_ingreso ? fdate(e.fecha_ingreso) : '')}
        ${fichaRow('Fecha de nacimiento', e.fecha_nacimiento ? fdate(e.fecha_nacimiento) : '')}
        ${fichaRow('Dirección', e.direccion)}
        ${fichaRow('Contacto de emergencia', e.contacto_emergencia)}
        ${fichaRow('Estado', e.estado === 'inactivo' ? 'Inactivo' : 'Activo')}
        ${e.notas ? `<div class="ficha-row" style="grid-column:1/-1"><span class="k">Notas</span><span class="v">${esc(e.notas)}</span></div>` : ''}
      </div></div></div>`;
    const body = `<div class="stat-grid" style="margin-bottom:16px">
      <div class="stat"><div class="lbl">Salario</div><div class="val" style="font-size:22px">${money(e.salario)}</div></div>
      <div class="stat"><div class="lbl">Total pagado</div><div class="val income" style="font-size:22px">${money(totalPagado)}</div></div>
    </div>
    ${ficha}
    ${pagos.length ? monthBlocks : `<div class="empty">Sin pagos registrados todavía.</div>`}`;
    this.openModal(`Historial · ${esc(e.nombre)}`, body, [
      { label: 'Cerrar', cls: 'btn-ghost', fn: () => this.closeModal() },
      { label: 'Exportar todo', cls: 'btn-primary', icon: 'pdf', fn: () => this.exportEmpleadoPDF(id) },
    ]);
    $$('#modalBody [data-vcp]').forEach(b => b.onclick = () => { const p = (e.pagos || []).find(x => x.id === b.dataset.vcp); if (p) this.verComprobante(p.comprobante); });
    $$('#modalBody [data-mes]').forEach(b => b.onclick = () => this.exportEmpleadoMes(id, b.dataset.mes));
    const ef = $('#modalBody [data-editficha]'); if (ef) ef.onclick = () => this.formEmpleado(id);
  },
  exportEmpleadoMes(id, month) {
    const e = Store.employees().find(x => x.id === id); if (!e) return;
    const list = (e.pagos || []).filter(p => (p.fecha || '').slice(0, 7) === month).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    if (!list.length) return toast('Sin pagos ese mes');
    const monthName = month ? new Date(month + '-01T00:00:00').toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }) : 'Sin fecha';
    const total = list.reduce((s, p) => s + p.monto, 0);
    const logo = `${location.origin}${location.pathname.replace(/index\.html$/, '')}assets/img/logo.jpg`;
    const filas = list.map(p => `<tr><td>${fdate(p.fecha)}</td><td>${esc(p.concepto)}</td><td>${esc(Store.bankName(p.bank_id))}</td><td class="num">${money(p.monto)}</td></tr>`).join('');
    const comps = list.filter(p => p.comprobante).map(p => {
      const inner = String(p.comprobante).startsWith('data:application/pdf')
        ? `<div class="pdfbox">Comprobante PDF adjunto</div>` : `<img src="${p.comprobante}">`;
      return `<div class="comp"><div class="cap">${fdate(p.fecha)} · ${money(p.monto)}</div>${inner}</div>`;
    }).join('');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Extracto ${esc(e.nombre)} ${monthName}</title>
      <style>body{font-family:Arial,sans-serif;color:#1c1a14;padding:38px;max-width:760px;margin:0 auto}
      .hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #c8a44d;padding-bottom:16px;margin-bottom:18px}
      .hd img{width:78px;height:78px;object-fit:contain}.hd h1{font-size:20px;margin:0}.hd p{margin:2px 0;color:#666;font-size:13px}
      .meta{font-size:13px;color:#555;margin:0 0 14px}
      h2{font-size:15px;margin:20px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#f3efe3;text-align:left;padding:9px 12px;border-bottom:2px solid #ddd}
      td{padding:9px 12px;border-bottom:1px solid #eee}.num{text-align:right}
      tfoot td{font-weight:bold;border-top:2px solid #c8a44d}
      .comps{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px}
      .comp{width:160px;border:1px solid #e6e1d4;border-radius:8px;padding:8px;font-size:10px}
      .comp img{width:100%;height:auto;border-radius:4px;display:block}
      .comp .cap{color:#666;margin-bottom:6px}
      .pdfbox{background:#f3efe3;border-radius:4px;padding:24px 8px;text-align:center;color:#888}
      .foot{margin-top:28px;font-size:11px;color:#999;text-align:center}</style></head><body>
      <div class="hd"><img src="${logo}">
        <div><h1>Ganadería Dyck Manantial</h1><p>Extracto de pagos — ${esc(e.nombre)}</p>
        <p>Emitido: ${new Date().toLocaleDateString('es-BO')}</p></div></div>
      <p class="meta"><b>Empleado:</b> ${esc(e.nombre)} · <b>Puesto:</b> ${esc(e.puesto)} · <b>Período:</b> <span style="text-transform:capitalize">${monthName}</span></p>
      <h2>Movimientos del mes</h2>
      <table><thead><tr><th>Fecha</th><th>Concepto</th><th>Banco</th><th class="num">Monto</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="3">Total pagado en el mes</td><td class="num">${money(total)}</td></tr></tfoot></table>
      ${comps ? `<h2>Comprobantes</h2><div class="comps">${comps}</div>` : ''}
      <div class="foot">Documento generado por el sistema Dyck Manantial</div>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  },
  exportEmpleadoPDF(id) {
    const e = Store.employees().find(x => x.id === id); if (!e) return;
    const pagos = (e.pagos || []).slice().reverse();
    const total = pagos.reduce((s, p) => s + p.monto, 0);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Historial ${esc(e.nombre)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#241d13;padding:38px;max-width:760px;margin:0 auto}
        .hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #c8a44d;padding-bottom:16px;margin-bottom:24px}
        .hd img{width:84px;height:84px;object-fit:contain}
        .hd h1{font-size:22px;margin:0;color:#c8a44d} .hd p{margin:2px 0;color:#666;font-size:13px}
        h2{font-size:16px;margin:22px 0 10px} .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:14px}
        .meta b{color:#555}
        table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
        th{background:#f1efe7;text-align:left;padding:9px 12px;border-bottom:2px solid #ddd}
        td{padding:9px 12px;border-bottom:1px solid #eee} .num{text-align:right}
        tfoot td{font-weight:bold;border-top:2px solid #c8a44d}
        .foot{margin-top:30px;font-size:11px;color:#999;text-align:center}
      </style></head><body>
      <div class="hd"><img src="${location.origin}${location.pathname.replace(/index\.html$/, '')}assets/img/logo.jpg">
        <div><h1>Ganadería Dyck Manantial</h1><p>Historial laboral del empleado</p>
        <p>Emitido: ${new Date().toLocaleDateString('es-BO')}</p></div></div>
      <h2>Datos del empleado</h2>
      <div class="meta">
        <div><b>Nombre:</b> ${esc(e.nombre)}</div><div><b>Documento:</b> ${esc(e.documento || '—')}</div>
        <div><b>Puesto:</b> ${esc(e.puesto)}</div><div><b>Teléfono:</b> ${esc(e.telefono || '—')}</div>
        <div><b>Fecha de ingreso:</b> ${e.fecha_ingreso ? fdate(e.fecha_ingreso) : '—'}</div><div><b>Fecha de nacimiento:</b> ${e.fecha_nacimiento ? fdate(e.fecha_nacimiento) : '—'}</div>
        <div><b>Dirección:</b> ${esc(e.direccion || '—')}</div><div><b>Contacto de emergencia:</b> ${esc(e.contacto_emergencia || '—')}</div>
        <div><b>Salario mensual:</b> ${money(e.salario)}</div><div><b>Estado:</b> ${e.estado === 'inactivo' ? 'Inactivo' : 'Activo'}</div>
        ${e.notas ? `<div style="grid-column:1/-1"><b>Notas:</b> ${esc(e.notas)}</div>` : ''}
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

    // Estado del sistema + verificación
    const cfg = window.SUPA_CONFIG || {};
    const estado = window.SUPA_READY ? ['ok', 'Conectado y sincronizando'] : cfg.anonKey ? ['pend', 'Configurado — iniciá sesión para sincronizar'] : ['off', 'Modo local (sin nube)'];
    h += `<div class="section"><div class="section-title"><span data-icon="check"></span> Estado y verificación</div>
      <div class="panel"><div class="panel-body" style="padding:18px 22px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <span class="badge ${estado[0] === 'ok' ? 'ok' : estado[0] === 'pend' ? 'pend' : 'off'}">${esc(estado[1])}</span>
          <button class="btn btn-primary btn-sm" id="btnVerify"><span data-icon="check"></span> Verificar sistema</button>
        </div>
        <p class="sub" style="color:var(--c-muted);font-size:13px">Tus datos se guardan <b>en este dispositivo</b> y, al iniciar sesión, también en la nube como respaldo. Aunque no entres por más de 7 días, la información <b>no se borra</b>: queda local y en la nube (si el servidor se pausa por inactividad, se reactiva solo al volver a entrar). Igual conviene <b>exportar un respaldo</b> de vez en cuando.</p>
      </div></div></div>`;

    h += `<div class="section"><div class="section-title"><span data-icon="download"></span> Datos y ayuda</div>
      <div class="panel"><div class="panel-body" style="padding:18px 22px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" id="btnExport"><span data-icon="download"></span> Exportar respaldo (JSON)</button>
        <button class="btn btn-ghost" id="btnImport"><span data-icon="download"></span> Importar respaldo</button>
        <button class="btn btn-ghost" id="btnTour"><span data-icon="sparkles"></span> Ver tour de nuevo</button>
        <button class="btn btn-ghost" id="btnDemo"><span data-icon="sparkles"></span> Cargar datos de ejemplo</button>
        <button class="btn btn-danger" id="btnReset"><span data-icon="trash"></span> Borrar todo</button>
      </div>
      <div class="panel-body" style="padding:0 22px 18px"><p class="sub" style="color:var(--c-muted);font-size:13px">
        "Datos de ejemplo" llena el sistema para mostrarlo con vida. "Borrar todo" lo deja limpio para empezar en serio. "Importar" restaura un respaldo exportado antes.</p></div></div></div>
      <input type="file" id="importFile" accept="application/json" style="display:none">`;
    this.paint('ajustes', h);
    const root = $('#screen-ajustes');
    $$('.theme-card', root).forEach(c => c.onclick = () => { this.applyTheme(c.dataset.theme); Store.setSetting('theme', c.dataset.theme); this.refresh(); });
    $('#addBank').onclick = () => this.formBanco();
    $$('[data-bedit]', root).forEach(b => b.onclick = () => this.formBanco(b.dataset.bedit));
    $$('[data-bdel]', root).forEach(b => b.onclick = () => this.confirmDelete(() => Store.removeBank(b.dataset.bdel)));
    $('#btnVerify').onclick = () => this.runDiagnostics();
    $('#btnImport').onclick = () => $('#importFile').click();
    $('#importFile').onchange = async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      try { const txt = await f.text(); const obj = JSON.parse(txt); Store.loadSnapshot(obj); toast('Respaldo importado'); this.go('dashboard'); }
      catch (e) { toast('Archivo inválido'); }
    };
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
  //  Verificación del sistema (diagnóstico en vivo)
  // ============================================================
  async runDiagnostics() {
    const cfg = window.SUPA_CONFIG || {};
    this.openModal('Verificación del sistema', `<div id="diagBody"><p class="sub" style="color:var(--c-muted)">Verificando…</p></div>`, [
      { label: 'Cerrar', cls: 'btn-ghost', fn: () => this.closeModal() },
    ]);
    const checks = [];
    const ok = (n, c, hint) => checks.push({ n, c, hint });

    // --- Lógica y datos locales ---
    try {
      const before = Store.expenses().length;
      const t = Store.addExpense({ domain: 'ganaderia', categoria: 'Otros', monto: 1 });
      const added = Store.expenses().length === before + 1;
      Store.removeExpense(t.id);
      const restored = Store.expenses().length === before;
      ok('Lógica de datos (alta/baja)', added && restored);
    } catch (e) { ok('Lógica de datos (alta/baja)', false, e.message); }
    ok('Datos guardados en este dispositivo', !!localStorage.getItem('dyck.db.v3'));
    const d = Store.domainBreakdown('ganaderia');
    ok('Cálculos financieros coherentes', Math.round(d.balance) === Math.round(d.ingreso - d.salida));
    ok('Terminología correcta (sin "egreso")', !('egreso' in d) && ('salida' in d));

    // --- Backend / nube ---
    let reach = false, table = false;
    if (cfg.anonKey) {
      try { const r = await fetch(cfg.url + '/auth/v1/health', { headers: { apikey: cfg.anonKey } }); reach = r.ok; } catch (e) {}
      try { const r = await fetch(cfg.url + '/rest/v1/user_data?select=user_id&limit=1', { headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey } }); table = r.status !== 404; } catch (e) {}
      ok('Conexión con Supabase', reach);
      ok('Tabla de respaldo creada (user_data)', table, table ? '' : 'Falta pegar el SQL de 0002_user_data.sql en Supabase');
      ok('Sesión iniciada (sync activo)', !!window.SUPA_READY, window.SUPA_READY ? '' : 'Iniciá sesión para sincronizar');
    } else {
      ok('Backend configurado', false, 'Falta pegar la anon key en config.js');
    }

    const allCore = checks.slice(0, 4).every(c => c.c);
    const cloudReady = cfg.anonKey && reach && table;
    let verdict;
    if (allCore && cloudReady && window.SUPA_READY) verdict = ['ok', 'Listo y sincronizando — Franz puede usarlo en cualquier dispositivo.'];
    else if (allCore && cloudReady) verdict = ['pend', 'Todo OK. Falta solo iniciar sesión para activar la sincronización en la nube.'];
    else if (allCore && cfg.anonKey && reach && !table) verdict = ['pend', 'La app funciona. Falta crear la tabla en Supabase (pegar el SQL) para el respaldo en la nube.'];
    else if (allCore) verdict = ['pend', 'La app funciona 100% en este dispositivo. La nube es opcional.'];
    else verdict = ['off', 'Hay algo que revisar — mirá los ✗ de arriba.'];

    const body = $('#diagBody'); if (!body) return;
    body.innerHTML = `<div style="display:flex;flex-direction:column;gap:9px">
      ${checks.map(c => `<div style="display:flex;align-items:flex-start;gap:10px">
        <span style="color:${c.c ? 'var(--c-income)' : 'var(--c-expense)'};font-weight:800;font-size:16px;line-height:1.3">${c.c ? '✓' : '✗'}</span>
        <div><div style="font-weight:600">${esc(c.n)}</div>${c.hint && !c.c ? `<div class="sub" style="color:var(--c-muted);font-size:12px">${esc(c.hint)}</div>` : ''}</div>
      </div>`).join('')}
      <div class="badge ${verdict[0] === 'ok' ? 'ok' : verdict[0] === 'pend' ? 'pend' : 'off'}" style="margin-top:8px;align-self:flex-start;white-space:normal;line-height:1.5;padding:10px 14px">${esc(verdict[1])}</div>
    </div>`;
  },

  // ============================================================
  //  Helpers UI
  // ============================================================
  panel(title, inner) {
    return `<div class="panel"><div class="panel-head"><h3>${esc(title)}</h3></div><div class="panel-body">${inner}</div></div>`;
  },
  emptyState(ic, msg) { return `<div class="empty"><span data-icon="${ic}" data-size="40"></span><div>${esc(msg)}</div></div>`; },

  // Autocompletado: datalists construidos con la data existente
  uniqVals(arr) { return [...new Set(arr.map(x => (x == null ? '' : String(x)).trim()).filter(Boolean))].sort().slice(0, 300); },
  datalistsHTML() {
    const items = [...Store.purchases(), ...Store.sales()].flatMap(x => x.items || []);
    const dl = (id, vals) => `<datalist id="${id}">${this.uniqVals(vals).map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
    return dl('dl-proveedores', [...Store.purchases().map(p => p.proveedor), ...Store.payables().map(p => p.proveedor), ...Store.loans().map(l => l.prestamista)])
      + dl('dl-clientes', Store.sales().map(s => s.cliente))
      + dl('dl-razas', [...Store.animals().map(a => a.raza), ...items.map(i => i.raza)])
      + dl('dl-gastos', [...Store.expenses().map(e => e.categoria), ...Store.expenses().map(e => e.descripcion)])
      + dl('dl-ingresos', Store.incomes().map(i => i.categoria))
      + dl('dl-prestamistas', Store.loans().map(l => l.prestamista))
      + dl('dl-empleados', Store.employees().map(e => e.nombre))
      + dl('dl-motivos', [...Store.deaths().map(d => d.motivo), 'Enfermedad', 'Accidente', 'Parto', 'Depredador', 'Robo', 'Vejez'])
      + dl('dl-animalcats', [...ANIMAL_CATS, ...Store.animals().map(a => a.categoria), ...Store.deaths().map(d => d.categoria)]);
  },
  openModal(title, body, actions = []) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body + this.datalistsHTML();
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
    { sel: '[data-go="ganaderia"]', title: 'Ganadería', text: 'Todo el campo en un solo lugar: animales (uno por uno, con muertes y motivos), compras, ventas, gastos, gastos FIJOS (sueldos y mensuales) con botón Pagado, empleados y deudas.' },
    { sel: '[data-go="personales"]', title: 'Gastos personales', text: 'Tus salidas personales, separadas de la ganadería: comida, salud, transporte, vivienda. También tus gastos fijos personales.' },
    { sel: '[data-go="ingresos"]', title: 'Ingresos', text: 'Todo lo que entra, ganadería y personal juntos. Las ventas de ganado aparecen acá automáticamente.' },
    { sel: '[data-go="tareas"]', title: 'Tareas', text: 'Tu lista de pendientes para que no se te olvide nada: con fecha (para un día) o sin fecha (pendiente general). Tildás lo que hacés.' },
    { sel: '#fabQuick', title: 'Gasto rápido', text: 'Para gastos personales que pasan y ya: en segundos cargás monto, banco y qué fue. Los gastos FIJOS (que se repiten cada mes) se cargan en la pestaña Fijos de Ganadería.' },
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
