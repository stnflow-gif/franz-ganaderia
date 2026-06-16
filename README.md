# Gestión Dyck

App de **gastos personales + ganadería** para Franz Dyck (Santa Cruz, Bolivia).
PWA offline-first en HTML/CSS/JS vanilla. Backend: Supabase. Hosting: Cloudflare Pages.

## Probar ahora (local)
Abrí `index.html` en el navegador. Ya funciona 100% offline: registra movimientos,
hato, empleados, proyecciones y cambio de tema. Todo se guarda en el teléfono/navegador.

## Estructura
```
index.html              # app (todas las pantallas)
assets/css/app.css      # diseño + 5 temas
assets/js/config.js     # ⚠️ URL + anon key de Supabase (NUNCA service_role)
assets/js/store.js      # capa de datos offline (localStorage + cola de sync)
assets/js/app.js        # UI, dashboard, formularios, theming
assets/js/sync.js       # sincronización con Supabase (se activa con la anon key)
sw.js                   # service worker (offline)
manifest.webmanifest    # PWA instalable
supabase/migrations/0001_init.sql  # esquema de la base
```

## Puesta en marcha del backend (paso a paso)

### 1. Crear las tablas
Supabase → **SQL Editor** → New query → pegá TODO el contenido de
`supabase/migrations/0001_init.sql` → **Run**.

### 2. Conseguir la anon key
Supabase → **Settings → API** → copiá la **`anon` / publishable key**
(NO la `service_role`). Pegala en `assets/js/config.js` → `anonKey`.

### 3. 🔴 Rotar la service_role key
La service_role que se compartió quedó expuesta. Supabase → **Settings → API** →
**Roll** la `service_role key`. No va nunca en el frontend.

### 4. (futuro) Login
La pantalla de login email/contraseña está lista en el HTML; falta cablear
`sync.js` con `sb.auth.signInWithPassword` cuando definamos el alta de Franz.

## Empaquetar como APK (sin Play Store)
1. Subir a **Cloudflare Pages** (gratis).
2. Opción rápida: "Agregar a pantalla de inicio" desde Chrome (PWA instalable).
3. Opción APK real: **PWABuilder** o **Bubblewrap** (TWA) → genera el APK que apunta a la PWA.

## Pendientes para el meet con Franz
- ¿Múltiples propiedades/potreros?
- ¿Hato por animal individual o sólo total de cabezas? (hoy: total)
- ¿Cuántos empleados?
- ¿Quiere exportar reportes PDF/Excel?
- Logo definitivo de la ganadería (reemplazar `assets/img/logo.svg`).
- Capturas del software actual ("débitos y créditos") para replicar lo bueno / sacar lo que no quiere.
