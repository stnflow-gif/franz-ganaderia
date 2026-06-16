/* ============================================================
   app.js — UI, routing, dashboard y formularios
   ============================================================ */

const THEMES = [
  { id: 'rancho',        name: 'Rancho (oscuro)', sw: ['#14110d', '#4a8c5e', '#b0763d'] },
  { id: 'rancho-claro',  name: 'Rancho (claro)',  sw: ['#f6f2ea', '#2d6a4f', '#8b5e3c'] },
  { id: 'verde-noche',   name: 'Verde noche',     sw: ['#0d1512', '#10b981', '#d97706'] },
  { id: 'tierra-clara',  name: 'Tierra clara',    sw: ['#fbf8f3', '#c9923b', '#6b4f2c'] },
  { id: 'campo-azul',    name: 'Campo azul',      sw: ['#0b1120', '#3b82f6', '#e8a830'] },
];

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const money = n => {
  const cur = Store.settings().currency || 'Bs';
  const v = Math.round(+n || 0);
  return `${cur} ${v.toLocaleString('es-BO')}`;
};
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const monthLabel = k => {
  const [y, m] = k.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
};
const fmtDate = s => new Date(s + 'T00:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });

const App = {
  current: 'dashboard',
  sheetCtx: null,

  init() {
    this.applyTheme(Store.settings().theme || 'rancho');
    $('#todayLabel').textContent = new Date().toLocaleDateString('es-BO',
      { weekday: 'long', day: 'numeric', month: 'long' });

    // Navegación
    $$('[data-go]').forEach(el => el.addEventListener('click', () => this.go(el.dataset.go)));
    $$('[data-action]').forEach(el => el.addEventListener('click', () => this.action(el.dataset.action)));
    $('#fab').addEventListener('click', () => this.openTxSheet());
    $('#sheetBg').addEventListener('click', () => this.closeSheet());
    $('#btnExport').addEventListener('click', () => this.exportData());

    // Segmento de dominio en proyecciones
    $$('#projDomainSeg button').forEach(b => b.addEventListener('click', () => {
      $$('#projDomainSeg button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); this.renderProjections(b.dataset.dom);
    }));

    window.addEventListener('store:changed', () => this.refresh());
    this.buildThemeGrid();
    this.injectIcons();
    this.refresh();
  },

  // Rellena los <span data-icon="..."> estáticos del HTML
  injectIcons(root = document) {
    $$('[data-icon]', root).forEach(el => {
      const size = el.dataset.size ? +el.dataset.size : 18;
      el.innerHTML = icon(el.dataset.icon, size);
    });
  },

  go(screen) {
    this.current = screen;
    $$('.screen').forEach(s => s.classList.remove('active'));
    $(`#screen-${screen}`)?.classList.add('active');
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === screen));
    window.scrollTo(0, 0);
    this.refresh();
  },

  refresh() {
    this.renderDashboard();
    this.renderModule('personal');
    this.renderModule('ganaderia');
    this.renderGanaderiaExtras();
    this.renderProjections($('#projDomainSeg .on')?.dataset.dom || 'ganaderia');
    this.renderBanks();
    this.updateSyncPill();
  },

  // ---------- Dashboard ----------
  renderDashboard() {
    const mk = monthKey();
    const p = Store.totals('personal', mk);
    const g = Store.totals('ganaderia', mk);
    const balance = p.balance + g.balance;
    $('#heroBalance').textContent = money(balance);
    $('#heroIncome').textContent = money(p.ingreso + g.ingreso);
    $('#heroExpense').textContent = money(p.gasto + g.gasto);
    $('#kpiPersonal').textContent = money(p.balance);
    $('#kpiPersonal').className = 'v ' + (p.balance >= 0 ? 'income' : 'expense');
    $('#kpiGanaderia').textContent = money(g.balance);
    $('#kpiGanaderia').className = 'v ' + (g.balance >= 0 ? 'income' : 'expense');

    const head = Store.headCount();
    $('#kpiHead').textContent = head;
    $('#kpiHerdValue').textContent = money(head * (Store.settings().value_per_head || 0));

    // Últimos 5 movimientos (ambos módulos)
    const recent = Store.transactions().slice(0, 5);
    $('#recentList').innerHTML = recent.length ? recent.map(t => this.txRow(t)).join('')
      : `<div class="empty">Sin movimientos todavía.<br>Tocá el botón ＋ para registrar el primero.</div>`;
    this.bindTxRows('#recentList');

    // Proyección mini
    const proj = this.computeProjection('ganaderia');
    const total = proj.reduce((s, r) => s + r.estimate, 0);
    $('#projectionMini').innerHTML = total
      ? `<div class="tx"><div class="ic">${icon('trending')}</div><div class="meta"><div class="t">Ganadería — próximo mes</div>
         <div class="s">Estimado según últimos 3 meses</div></div><div class="amt expense">${money(total)}</div></div>`
      : `<div class="empty">Cargá algunos gastos y acá aparecerá la estimación del próximo mes.</div>`;
  },

  // ---------- Módulos Personal / Ganadería ----------
  renderModule(domain) {
    const mk = monthKey();
    const t = Store.totals(domain, mk);
    $(`#${domain}Balance`).textContent = money(t.balance);
    $(`#${domain}Income`).textContent = money(t.ingreso);
    $(`#${domain}Expense`).textContent = money(t.gasto);
    const list = Store.transactions({ domain, month: mk });
    $(`#${domain}List`).innerHTML = list.length ? list.map(x => this.txRow(x)).join('')
      : `<div class="empty">Sin movimientos este mes.</div>`;
    this.bindTxRows(`#${domain}List`);
  },

  renderGanaderiaExtras() {
    $('#gHead').textContent = Store.headCount();
    const emps = Store.employees();
    $('#employeeList').innerHTML = emps.length ? emps.map(e => `
      <div class="tx"><div class="ic">${icon('workers')}</div>
        <div class="meta"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.role || 'Empleado')}</div></div>
        <div class="amt">${money(e.monthly_salary)}/mes</div></div>`).join('')
      : `<div class="empty">Sin empleados. Agregá uno para registrar salarios rápido.</div>`;
  },

  // ---------- Fila de transacción ----------
  txRow(t) {
    const cat = Store.all().categories.find(c => c.id === t.category_id);
    const bank = Store.all().banks.find(b => b.id === t.bank_id);
    const sign = t.kind === 'ingreso' ? '+' : '−';
    return `<div class="tx" data-tx="${t.id}">
      <div class="ic">${icon(cat?.icon || 'wallet')}</div>
      <div class="meta">
        <div class="t">${esc(t.description || cat?.name || 'Movimiento')}</div>
        <div class="s">${cat?.name || ''}${bank ? ' · ' + esc(bank.name) : ''} · ${fmtDate(t.occurred_on)}</div>
      </div>
      <div class="amt ${t.kind}">${sign} ${money(t.amount)}</div>
    </div>`;
  },
  bindTxRows(sel) {
    $$(`${sel} .tx[data-tx]`).forEach(row =>
      row.addEventListener('click', () => this.openTxDetail(row.dataset.tx)));
  },

  // ---------- Sheet: registrar transacción ----------
  openTxSheet(preset = {}) {
    const domain = preset.domain || (this.current === 'ganaderia' ? 'ganaderia' : 'personal');
    const kind = preset.kind || 'gasto';
    this.sheetCtx = { domain, kind, category_id: null, bank_id: null, occurred_on: new Date().toISOString().slice(0, 10) };
    this.renderTxSheet();
    this.openSheet();
  },

  renderTxSheet() {
    const c = this.sheetCtx;
    const cats = Store.categories(c.domain, c.kind);
    const banks = Store.banks();
    $('#sheetContent').innerHTML = `
      <h3>Registrar movimiento</h3>
      <div class="segment" id="segDomain">
        <button class="${c.domain==='personal'?'on':''}" data-v="personal">${icon('user')} Personal</button>
        <button class="${c.domain==='ganaderia'?'on':''}" data-v="ganaderia">${icon('cow')} Ganadería</button>
      </div>
      <div class="segment mt" id="segKind">
        <button class="${c.kind==='gasto'?'on':''}" data-v="gasto">${icon('arrowDown')} Gasto</button>
        <button class="${c.kind==='ingreso'?'on':''}" data-v="ingreso">${icon('arrowUp')} Ingreso</button>
      </div>

      <div class="field mt"><label>Monto</label>
        <div class="control"><span class="prefix">${Store.settings().currency}</span>
        <input class="amount-input" id="txAmount" type="number" inputmode="decimal" placeholder="0" value="${c.amount||''}"></div>
      </div>

      <div class="field"><label>Categoría</label>
        <div class="chips" id="txCats">
          ${cats.map(cat => `<button class="chip ${c.category_id===cat.id?'on':''}" data-id="${cat.id}">${icon(cat.icon||'dot')} ${esc(cat.name)}</button>`).join('')}
        </div>
      </div>

      <div class="field"><label>¿De qué banco salió?</label>
        <div class="chips" id="txBanks">
          ${banks.map(b => `<button class="chip ${c.bank_id===b.id?'on':''}" data-id="${b.id}">${esc(b.name)}</button>`).join('')}
        </div>
      </div>

      <div class="row">
        <div class="field"><label>Fecha</label>
          <div class="control"><input type="date" id="txDate" value="${c.occurred_on}"></div>
        </div>
      </div>
      <div class="field"><label>Detalle (opcional)</label>
        <div class="control"><input id="txDesc" placeholder="Ej: vacuna aftosa lote 2" value="${esc(c.description||'')}"></div>
      </div>

      <button class="btn btn-primary mt" id="txSave">Guardar movimiento</button>
    `;

    $$('#segDomain button').forEach(b => b.onclick = () => { c.domain = b.dataset.v; c.category_id = null; this.renderTxSheet(); });
    $$('#segKind button').forEach(b => b.onclick = () => { c.kind = b.dataset.v; c.category_id = null; this.renderTxSheet(); });
    $$('#txCats .chip').forEach(b => b.onclick = () => { c.category_id = b.dataset.id; this.syncSheetState(); this.renderTxSheet(); });
    $$('#txBanks .chip').forEach(b => b.onclick = () => { c.bank_id = b.dataset.id; this.syncSheetState(); this.renderTxSheet(); });
    $('#txSave').onclick = () => this.saveTx();
  },
  syncSheetState() {
    const c = this.sheetCtx;
    c.amount = $('#txAmount')?.value;
    c.description = $('#txDesc')?.value;
    c.occurred_on = $('#txDate')?.value || c.occurred_on;
  },

  saveTx() {
    const c = this.sheetCtx;
    const amount = parseFloat($('#txAmount').value);
    if (!amount || amount <= 0) { $('#txAmount').focus(); shake('#txAmount'); return; }
    Store.addTransaction({
      domain: c.domain, kind: c.kind, amount,
      category_id: c.category_id, bank_id: c.bank_id,
      description: $('#txDesc').value.trim(),
      occurred_on: $('#txDate').value,
    });
    this.closeSheet();
    toast('Movimiento guardado');
    this.refresh();
  },

  openTxDetail(id) {
    const t = Store.all().transactions.find(x => x.id === id);
    if (!t) return;
    const cat = Store.all().categories.find(c => c.id === t.category_id);
    const bank = Store.all().banks.find(b => b.id === t.bank_id);
    $('#sheetContent').innerHTML = `
      <h3>${t.kind === 'ingreso' ? 'Ingreso' : 'Gasto'} · ${money(t.amount)}</h3>
      <div class="card" style="background:var(--c-surface)">
        <div class="tx"><div class="ic">${icon(cat?.icon||'wallet')}</div><div class="meta">
          <div class="t">${esc(t.description || cat?.name || 'Movimiento')}</div>
          <div class="s">${cat?.name||''}${bank?' · '+esc(bank.name):''} · ${fmtDate(t.occurred_on)}</div>
        </div></div>
      </div>
      <button class="btn btn-danger mt" id="txDelete">Eliminar movimiento</button>`;
    $('#txDelete').onclick = () => { Store.deleteTransaction(id); this.closeSheet(); toast('Eliminado'); this.refresh(); };
    this.openSheet();
  },

  // ---------- Acciones varias ----------
  action(name) {
    if (name === 'add-bank') {
      const n = prompt('Nombre del banco / cuenta:');
      if (n && n.trim()) { Store.addBank(n.trim()); this.refresh(); toast('Banco agregado'); }
    }
    if (name === 'add-employee') {
      const n = prompt('Nombre del empleado:'); if (!n) return;
      const r = prompt('Cargo (opcional):') || '';
      const s = prompt('Salario mensual (Bs):') || '0';
      Store.addEmployee(n.trim(), r.trim(), s); this.refresh(); toast('Empleado agregado');
    }
    if (name === 'add-herd') this.openHerdSheet();
  },

  openHerdSheet() {
    const ctx = { kind: 'nacimiento', occurred_on: new Date().toISOString().slice(0, 10) };
    const kinds = [['nacimiento','birth','Nacimiento'],['compra','cart','Compra'],['venta','cash','Venta'],['muerte','skull','Muerte'],['ajuste','edit','Ajuste']];
    $('#sheetContent').innerHTML = `
      <h3>Movimiento de hato</h3>
      <div class="field"><label>Tipo</label><div class="chips" id="herdKind">
        ${kinds.map(([v,ic,l])=>`<button class="chip ${ctx.kind===v?'on':''}" data-v="${v}">${icon(ic)} ${l}</button>`).join('')}
      </div></div>
      <div class="row">
        <div class="field"><label>Cantidad (cabezas)</label><div class="control"><input id="herdQty" type="number" inputmode="numeric" placeholder="0"></div></div>
        <div class="field"><label>Valor por cabeza (opc.)</label><div class="control"><span class="prefix">Bs</span><input id="herdVal" type="number" placeholder="0"></div></div>
      </div>
      <div class="field"><label>Fecha</label><div class="control"><input type="date" id="herdDate" value="${ctx.occurred_on}"></div></div>
      <p class="muted" style="font-size:13px">Si ponés valor por cabeza, registro también el ingreso/gasto en Ganadería automáticamente.</p>
      <button class="btn btn-primary mt" id="herdSave">Guardar</button>`;
    $$('#herdKind .chip').forEach(b => b.onclick = () => { ctx.kind = b.dataset.v; $$('#herdKind .chip').forEach(x=>x.classList.remove('on')); b.classList.add('on'); });
    $('#herdSave').onclick = () => {
      const qty = parseInt($('#herdQty').value); if (!qty) { shake('#herdQty'); return; }
      const val = parseFloat($('#herdVal').value) || null;
      const date = $('#herdDate').value;
      Store.addHerd({ kind: ctx.kind, quantity: qty, unit_value: val, occurred_on: date });
      // Auto-transacción si hay valor
      if (val && (ctx.kind === 'venta' || ctx.kind === 'compra')) {
        Store.addTransaction({
          domain: 'ganaderia', kind: ctx.kind === 'venta' ? 'ingreso' : 'gasto',
          amount: val * qty, description: `${ctx.kind === 'venta' ? 'Venta' : 'Compra'} de ${qty} cabezas`,
          occurred_on: date,
        });
      }
      this.closeSheet(); toast('Hato actualizado'); this.refresh();
    };
    this.openSheet();
  },

  // ---------- Proyecciones ----------
  computeProjection(domain) {
    const avg = Store.avgByCategory(domain, 3);
    const cats = Store.all().categories;
    return Object.keys(avg).map(cid => {
      const cat = cats.find(c => c.id === cid);
      const base = avg[cid];
      const adj = Store.all().projections.find(p => p.domain === domain && p.category_id === cid);
      const variation = adj?.variation_pct || 0;
      const extra = adj?.extra_amount || 0;
      return { category_id: cid, name: cat?.name || 'Otros', icon: cat?.icon || 'dot',
        base, variation, extra, estimate: base * (1 + variation / 100) + extra };
    }).sort((a, b) => b.estimate - a.estimate);
  },

  renderProjections(domain) {
    const rows = this.computeProjection(domain);
    const total = rows.reduce((s, r) => s + r.estimate, 0);
    const el = $('#projectionList');
    if (!el) return;
    if (!rows.length) { el.innerHTML = `<div class="empty">Necesito al menos un mes de gastos para proyectar.</div>`; return; }
    el.innerHTML = `
      <div class="tx"><div class="ic">${icon('chart')}</div><div class="meta"><div class="t">Total estimado próximo mes</div>
        <div class="s">${rows.length} categorías</div></div><div class="amt expense">${money(total)}</div></div>
      ${rows.map(r => `
        <div class="tx" data-proj="${r.category_id}" data-dom="${domain}">
          <div class="ic">${icon(r.icon)}</div>
          <div class="meta"><div class="t">${esc(r.name)}</div>
            <div class="s">Base ${money(r.base)}${r.variation?` · ${r.variation>0?'+':''}${r.variation}%`:''}${r.extra?` · extra ${money(r.extra)}`:''}</div></div>
          <div class="amt">${money(r.estimate)}</div>
        </div>`).join('')}`;
    $$('#projectionList .tx[data-proj]').forEach(row =>
      row.onclick = () => this.editProjection(domain, row.dataset.proj));
  },

  editProjection(domain, cid) {
    const cat = Store.all().categories.find(c => c.id === cid);
    const adj = Store.all().projections.find(p => p.domain === domain && p.category_id === cid) || {};
    $('#sheetContent').innerHTML = `
      <h3>Ajustar: ${esc(cat?.name||'')}</h3>
      <div class="field"><label>Variación (%)</label><div class="control"><input id="pVar" type="number" placeholder="0" value="${adj.variation_pct||''}"></div></div>
      <div class="field"><label>Evento extraordinario (Bs)</label><div class="control"><span class="prefix">Bs</span><input id="pExtra" type="number" placeholder="0" value="${adj.extra_amount||''}"></div></div>
      <p class="muted" style="font-size:13px">Ej: "este mes compro 20k en medicinas" → poné 20000 como extra.</p>
      <button class="btn btn-primary mt" id="pSave">Guardar ajuste</button>`;
    $('#pSave').onclick = () => {
      const db = Store.all();
      let p = db.projections.find(x => x.domain === domain && x.category_id === cid);
      const data = { variation_pct: parseFloat($('#pVar').value) || 0, extra_amount: parseFloat($('#pExtra').value) || 0 };
      if (p) Object.assign(p, data);
      else db.projections.push({ id: Store.uid(), domain, category_id: cid, ...data });
      Store.setSetting('_touch', Date.now()); // fuerza persist
      this.closeSheet(); toast('Proyección ajustada'); this.renderProjections(domain); this.renderDashboard();
    };
    this.openSheet();
  },

  // ---------- Bancos ----------
  renderBanks() {
    $('#bankList').innerHTML = Store.banks().map(b =>
      `<div class="tx"><div class="ic">${icon('bank')}</div><div class="meta"><div class="t">${esc(b.name)}</div></div></div>`).join('');
  },

  // ---------- Tema ----------
  buildThemeGrid() {
    const cur = Store.settings().theme;
    $('#themeGrid').innerHTML = THEMES.map(t => `
      <div class="theme-card ${t.id===cur?'on':''}" data-theme-id="${t.id}">
        <div class="swatches">${t.sw.map(c=>`<span class="sw" style="background:${c}"></span>`).join('')}</div>
        <div class="name">${t.name}</div>
      </div>`).join('');
    $$('#themeGrid .theme-card').forEach(c => c.onclick = () => {
      this.applyTheme(c.dataset.themeId);
      Store.setSetting('theme', c.dataset.themeId);
      this.buildThemeGrid();
    });
  },
  applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    const t = THEMES.find(x => x.id === id);
    if (t) document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.sw[0]);
  },

  // ---------- Sync pill ----------
  updateSyncPill() {
    const n = Store.syncQueueSize();
    const txt = window.SUPA_READY ? 'Sincronizado' : (n ? `${n} cambios sin subir` : 'Local');
    $$('#syncPill span:last-child, #syncStatus span:last-child').forEach(e => e.textContent =
      window.SUPA_READY ? 'Sincronizado con Supabase' : 'Guardado local · falta conectar Supabase');
  },

  exportData() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gestion-dyck-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  },

  openSheet() { $('#sheetBg').classList.add('open'); $('#sheet').classList.add('open'); },
  closeSheet() { $('#sheetBg').classList.remove('open'); $('#sheet').classList.remove('open'); },
};

// ---------- Helpers ----------
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:99;background:var(--c-surface-2);color:var(--c-text);padding:12px 20px;border-radius:14px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.3);border:1px solid var(--c-border-2);transition:.3s;opacity:0';
    document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1'; t.style.bottom = '120px';
  clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = '0'; t.style.bottom = '100px'; }, 1800);
}
function shake(sel) { const el = $(sel); if (!el) return; el.style.transition='transform .07s'; let i=0;
  const iv = setInterval(()=>{ el.style.transform = `translateX(${i%2?6:-6}px)`; if(++i>5){clearInterval(iv);el.style.transform='';} },50); }

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
