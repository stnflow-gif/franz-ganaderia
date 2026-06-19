/* ============================================================
   sync.js — Backend Supabase (auth + sync de documento único)
   - SIN anonKey en config.js  -> modo 100% local (no hace nada).
   - CON anonKey -> login Google/email + sincroniza todo el estado.
   El estado completo (Store.snapshot) se guarda en user_data.data.
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

  let sb = null, pushTimer = null, pulling = false, uid = null;

  async function init() {
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
    window.Sync = {
      ready: true,
      signInPassword: (email, password) => sb.auth.signInWithPassword({ email, password }),
      signUp: (email, password) => sb.auth.signUp({ email, password }),
      signInGoogle: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } }),
      signOut: () => sb.auth.signOut(),
    };
    sb.auth.onAuthStateChange((_e, session) => handleSession(session));
    const { data: { session } } = await sb.auth.getSession();
    handleSession(session);
  }

  async function handleSession(session) {
    if (!session || !session.user) { window.SUPA_READY = false; uid = null; return; }
    uid = session.user.id;
    window.SUPA_READY = true;
    const u = session.user;
    Store.setSetting('user', { name: u.user_metadata?.full_name || u.user_metadata?.name || u.email, email: u.email, via: 'supabase', id: uid });
    await pull();
    if (window.App) App.enterApp();
    window.removeEventListener('store:changed', schedulePush);
    window.addEventListener('store:changed', schedulePush);
    window.addEventListener('online', () => push());
  }

  async function pull() {
    pulling = true;
    try {
      const { data, error } = await sb.from('user_data').select('data').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      if (data && data.data && Object.keys(data.data).length) {
        Store.loadSnapshot(data.data);           // el servidor manda
      } else {
        await push(true);                         // primera vez: subo lo local
      }
    } catch (e) { console.warn('[sync] pull', e.message || e); }
    pulling = false;
  }

  function schedulePush() { if (pulling || !window.SUPA_READY) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => push(), 1200); }

  async function push() {
    if (!sb || !window.SUPA_READY || !uid || !navigator.onLine) return;
    try {
      await sb.from('user_data').upsert({ user_id: uid, data: Store.snapshot(), updated_at: new Date().toISOString() });
    } catch (e) { console.warn('[sync] push', e.message || e); }
  }
})();
