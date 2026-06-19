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

## Activar el backend (paso a paso)

El backend usa **un documento JSON por usuario** (tabla `user_data`). Sincroniza
TODO el estado (animales, compras, ventas, gastos, ingresos, deudas, empleados,
bancos, ajustes) entre dispositivos. Mientras `anonKey` esté vacío, la app sigue
funcionando 100% local.

### 1. Crear la tabla
Supabase → **SQL Editor** → New query → pegá TODO `supabase/migrations/0002_user_data.sql` → **Run**.

### 2. Pegar la anon key
Supabase → **Settings → API** → copiá la **`anon` / publishable key** (NO la
`service_role`) → pegala en `assets/js/config.js` → `anonKey`. Con eso ya anda
el login con email/contraseña y la sincronización.

### 3. Activar Google (opcional pero pedido)
Supabase → **Authentication → Providers → Google** → activar y pegar el
**Client ID/Secret** de un OAuth de Google Cloud. En **URL Configuration**
agregar la URL del sitio (Cloudflare Pages) como *Site URL* y *Redirect URL*.
El botón "Iniciar sesión con Google" ya está cableado (`sync.js`).

### 4. 🔴 Rotar la service_role key
La service_role que se compartió en el chat quedó expuesta. Supabase →
**Settings → API** → **Roll** la `service_role key`. No va nunca en el frontend.

> El esquema detallado por tablas (`0001_init.sql`) queda como referencia para
> reportes/BI a futuro; la app hoy usa el documento único de `0002`.

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
