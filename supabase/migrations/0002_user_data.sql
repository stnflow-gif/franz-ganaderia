-- ============================================================
--  Gestión Dyck Manantial — Backend simple (sync de estado)
--  Un documento JSON por usuario. Sincroniza TODO el sistema
--  (animales, compras, ventas, gastos, ingresos, deudas,
--  empleados, bancos, ajustes) sin tablas por entidad.
--  Last-write-wins entre dispositivos. Ideal single-user.
-- ============================================================

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists user_data_owner on public.user_data;
create policy user_data_owner on public.user_data
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nota: el esquema detallado por tablas (0001_init.sql) queda como
-- referencia para reportes/BI a futuro; la app usa este modelo de
-- documento único por su simplicidad y robustez offline.
