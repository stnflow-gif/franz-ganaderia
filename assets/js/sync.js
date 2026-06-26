/* ============================================================
   sync.js — Backend Supabase con sincronización POR REGISTRO + Realtime
   - Cada registro (gasto, animal, etc.) es una fila en la tabla `records`.
   - Agregar/editar = sube solo ese registro (no pisa el resto).
   - Realtime: lo que sube un dispositivo aparece al instante en los otros.
   - Offline: se guarda local y se sube al reconectar (outbox en localStorage).
   ============================================================ */

(function () {
  const cfg = window.SUPA_CONFIG || {};
  window.SUPA_READY = false;
  if (!cfg.anonKey) { console.info('[sync] Sin anonKey — modo local.'); return; }

  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = init;
  s.onerror = () => console.warn('[sync] No se pudo cargar supabase-js (offline).');
  document.head.appendChild(s);

  let sb = null, uid = null, flushing = false, flushTimer = null, channel = null;

  async function init() {
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
    window.Sync = {
      ready: true,
      signInPassword: (email, password) => sb.auth.signInWithPassword({ email, password }),
      signUp: (email, password) => sb.auth.signUp({ email, password }),
      signInGoogle: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } }),
      signOut: () => sb.auth.signOut(),
      resync: () => { Store.enqueueAll(); flush(); },           // tras importar respaldo
      wipeCloud: async () => { try { if (uid) await sb.from('records').delete().eq('user_id', uid); Store.clearOps(); } catch (e) {} },
    };
    sb.auth.onAuthStateChange((_e, session) => handleSession(session));
    const { data: { session } } = await sb.auth.getSession();
    handleSession(session);
  }

  async function handleSession(session) {
    if (!session || !session.user) { teardown(); return; }
    if (uid === session.user.id && window.SUPA_READY) return;    // ya inicializado para este usuario
    uid = session.user.id;
    window.SUPA_READY = true;
    const u = session.user;
    Store.setSetting('user', { name: u.user_metadata?.full_name || u.user_metadata?.name || u.email, email: u.email, via: 'supabase', id: uid });
    await flush();                                              // subo ediciones offline ANTES de bajar (no las pierdo)
    await pull();                                               // luego traigo el estado de la nube
    if (window.App) App.enterApp();
    subscribeRealtime();
    window.removeEventListener('store:op', scheduleFlush);
    window.addEventListener('store:op', scheduleFlush);
    window.removeEventListener('online', flush);
    window.addEventListener('online', flush);
    scheduleFlush();                                            // sube lo que haya pendiente
  }

  function teardown() {
    window.SUPA_READY = false; uid = null;
    if (channel) { try { sb.removeChannel(channel); } catch (e) {} channel = null; }
  }

  // Trae todos los registros del usuario y reconstruye el estado local
  async function pull() {
    try {
      const { data: rows, error } = await sb.from('records').select('coll,id,data,deleted').eq('user_id', uid);
      if (error) throw error;
      if (rows && rows.length) {
        const obj = {};
        rows.forEach(r => {
          if (r.deleted) return;
          if (r.coll === 'settings') obj.settings = r.data;
          else { (obj[r.coll] = obj[r.coll] || []).push(r.data); }
        });
        Store.loadSnapshot(obj);                                // la nube manda al entrar
      } else {
        Store.enqueueAll();                                     // nube vacía -> siembro con lo local
      }
    } catch (e) { console.warn('[sync] pull', e.message || e); }
  }

  function scheduleFlush() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 500); }

  // Sube el outbox: upserts (estado actual de cada registro) y deletes
  async function flush() {
    if (flushing || !sb || !window.SUPA_READY || !uid || !navigator.onLine) return;
    flushing = true;
    try {
      const ops = Store.pendingOps();
      if (ops.length) {
        const map = new Map();                                  // dedup por coll|id, última operación gana
        ops.forEach(o => map.set(o.coll + '|' + o.id, o));
        const upserts = [], deletes = [];
        for (const o of map.values()) {
          if (o.op === 'delete') { deletes.push(o); continue; }
          const data = Store.recordData(o.coll, o.id);
          if (data == null) deletes.push(o);
          else upserts.push({ user_id: uid, coll: o.coll, id: o.id, data, updated_at: new Date().toISOString(), deleted: false });
        }
        if (upserts.length) { const { error } = await sb.from('records').upsert(upserts); if (error) throw error; }
        for (const d of deletes) { const { error } = await sb.from('records').delete().match({ user_id: uid, coll: d.coll, id: d.id }); if (error) throw error; }
        Store.clearOps();
      }
    } catch (e) { console.warn('[sync] flush', e.message || e); /* queda en outbox para reintentar */ }
    flushing = false;
  }

  // Realtime: aplica los cambios que llegan de otros dispositivos al instante
  function subscribeRealtime() {
    if (channel) { try { sb.removeChannel(channel); } catch (e) {} channel = null; }
    channel = sb.channel('rec-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: 'user_id=eq.' + uid }, (payload) => {
        try {
          if (payload.eventType === 'DELETE') { const o = payload.old || {}; Store.applyRemote('delete', o.coll, o.id); }
          else { const n = payload.new || {}; Store.applyRemote(n.deleted ? 'delete' : 'upsert', n.coll, n.id, n.data); }
          if (window.App && App.current) App.refresh();
        } catch (e) { console.warn('[sync] realtime', e.message || e); }
      })
      .subscribe();
  }
})();
