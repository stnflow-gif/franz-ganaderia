/* ============================================================
   sync.js — Sincronización con Supabase (offline-first)
   Se activa SÓLO cuando config.js tiene una anonKey.
   Empuja la cola de cambios local y baja los datos del servidor.
   ============================================================ */

(function () {
  const cfg = window.SUPA_CONFIG || {};
  window.SUPA_READY = false;

  if (!cfg.anonKey) {
    // Sin key todavía: la app sigue 100% local. No hacemos nada.
    console.info('[sync] Supabase no configurado — modo local.');
    return;
  }

  // Cargar supabase-js desde CDN (cacheado por el SW tras la 1ª vez)
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = init;
  s.onerror = () => console.warn('[sync] No se pudo cargar supabase-js (offline).');
  document.head.appendChild(s);

  let sb = null;
  const SYNC = 'dyck.syncqueue.v1';

  async function init() {
    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    // TODO (cuando armemos el login): manejar sesión email/contraseña.
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      console.info('[sync] Sin sesión — mostrar login antes de sincronizar.');
      return;
    }
    window.SUPA_READY = true;
    window.dispatchEvent(new CustomEvent('store:changed'));
    await flushQueue();
    window.addEventListener('online', flushQueue);
    window.addEventListener('store:changed', () => navigator.onLine && flushQueue());
  }

  // Empuja la cola de cambios pendientes al servidor
  async function flushQueue() {
    if (!sb || !navigator.onLine) return;
    let q = [];
    try { q = JSON.parse(localStorage.getItem(SYNC) || '[]'); } catch (e) { return; }
    if (!q.length) return;

    const rest = [];
    for (const item of q) {
      try {
        if (item.op === 'insert') await sb.from(item.table).upsert(item.row);
        else if (item.op === 'update') await sb.from(item.table).update(item.row).eq('id', item.row.id);
        else if (item.op === 'delete') await sb.from(item.table).delete().eq('id', item.row.id);
      } catch (e) {
        rest.push(item); // reintentar luego
      }
    }
    localStorage.setItem(SYNC, JSON.stringify(rest));
    console.info(`[sync] ${q.length - rest.length} cambios subidos, ${rest.length} pendientes.`);
  }
})();
