/* ============================================================
   config.js — Conexión a Supabase
   ⚠️ Acá va SÓLO la anon / publishable key (es pública por diseño).
   NUNCA pongas la service_role key en este archivo.
   Mientras esté vacío, la app funciona 100% offline (localStorage).
   ============================================================ */

window.SUPA_CONFIG = {
  url: 'https://bbigctdwpncgmgrfcfnx.supabase.co',
  anonKey: '', // <-- pegá acá la anon key (empieza con eyJ... role "anon", o sb_publishable_...)
};
