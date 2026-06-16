-- ============================================================
--  Gestión Dyck — Esquema inicial
--  Gastos personales + Ganadería (vacas) — Franz Dyck, Santa Cruz, Bolivia
--  Moneda por defecto: BOB (Bs). Single-tenant con RLS por auth.uid().
-- ============================================================

-- ---------- Extensiones ----------
create extension if not exists "pgcrypto";

-- ============================================================
--  TABLAS
-- ============================================================

-- ---------- Bancos ----------
-- user_id NULL => banco "del sistema" (visible para todos, no editable).
-- user_id = auth.uid() => banco propio de Franz.
create table if not exists public.banks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  active       boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- Categorías ----------
-- domain: 'personal' | 'ganaderia'
-- kind:   'gasto' | 'ingreso'
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  domain      text not null check (domain in ('personal','ganaderia')),
  kind        text not null check (kind in ('gasto','ingreso')),
  name        text not null,
  icon        text,
  color       text,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- Empleados (para registrar salarios de ganadería) ----------
create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  role            text,
  monthly_salary  numeric(14,2) default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------- Transacciones (núcleo: gastos e ingresos de ambos módulos) ----------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain       text not null check (domain in ('personal','ganaderia')),
  kind         text not null check (kind in ('gasto','ingreso')),
  amount       numeric(14,2) not null check (amount >= 0),
  category_id  uuid references public.categories(id) on delete set null,
  bank_id      uuid references public.banks(id) on delete set null,
  employee_id  uuid references public.employees(id) on delete set null, -- si es un salario
  description  text,
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_tx_user_date  on public.transactions(user_id, occurred_on desc);
create index if not exists idx_tx_domain      on public.transactions(user_id, domain, occurred_on desc);

-- ---------- Movimientos de hato (inventario de cabezas de ganado) ----------
-- kind: 'nacimiento' | 'compra' | 'venta' | 'muerte' | 'ajuste'
-- quantity puede ser negativo en venta/muerte (lo maneja la app), o usamos signo según kind.
create table if not exists public.herd_movements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('nacimiento','compra','venta','muerte','ajuste')),
  quantity      int not null,                 -- cabezas (positivo entra, negativo sale)
  unit_value    numeric(14,2),                -- valor por cabeza (compra/venta)
  transaction_id uuid references public.transactions(id) on delete set null, -- vínculo opcional al gasto/ingreso
  description   text,
  occurred_on   date not null default current_date,
  created_at    timestamptz not null default now()
);
create index if not exists idx_herd_user_date on public.herd_movements(user_id, occurred_on desc);

-- ---------- Presupuestos (destinación por categoría y mes) ----------
create table if not exists public.budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain          text not null check (domain in ('personal','ganaderia')),
  category_id     uuid references public.categories(id) on delete cascade,
  month           date not null,              -- siempre el día 1 del mes
  planned_amount  numeric(14,2) not null default 0,
  created_at      timestamptz not null default now(),
  unique (user_id, domain, category_id, month)
);

-- ---------- Proyecciones (estimación próximo mes con variables) ----------
-- La app calcula la base con el histórico; aquí guardamos sólo los ajustes de Franz.
create table if not exists public.projections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain         text not null check (domain in ('personal','ganaderia')),
  category_id    uuid references public.categories(id) on delete cascade,
  target_month   date not null,               -- mes que se proyecta (día 1)
  variation_pct  numeric(6,2) not null default 0,   -- +/- % sobre la base
  extra_amount   numeric(14,2) not null default 0,  -- evento extraordinario
  note           text,
  created_at     timestamptz not null default now(),
  unique (user_id, domain, category_id, target_month)
);

-- ---------- Ajustes de la app (clave-valor por usuario: tema, moneda, valor/cabeza...) ----------
create table if not exists public.app_settings (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key         text not null,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, key)
);

-- ============================================================
--  TRIGGER: updated_at en transactions
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_tx_updated_at on public.transactions;
create trigger trg_tx_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.banks          enable row level security;
alter table public.categories     enable row level security;
alter table public.employees      enable row level security;
alter table public.transactions   enable row level security;
alter table public.herd_movements enable row level security;
alter table public.budgets        enable row level security;
alter table public.projections    enable row level security;
alter table public.app_settings   enable row level security;

-- Bancos y categorías: lectura de los del sistema (user_id null) + los propios.
drop policy if exists banks_select on public.banks;
create policy banks_select on public.banks for select
  using (user_id is null or user_id = auth.uid());
drop policy if exists banks_modify on public.banks;
create policy banks_modify on public.banks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select
  using (user_id is null or user_id = auth.uid());
drop policy if exists categories_modify on public.categories;
create policy categories_modify on public.categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Resto de tablas: sólo el dueño.
do $$
declare t text;
begin
  foreach t in array array['employees','transactions','herd_movements','budgets','projections','app_settings']
  loop
    execute format('drop policy if exists %1$s_owner on public.%1$s;', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all using (user_id = auth.uid()) with check (user_id = auth.uid());',
      t);
  end loop;
end $$;

-- ============================================================
--  SEED: bancos y categorías del sistema (user_id NULL)
-- ============================================================
insert into public.banks (user_id, name, sort_order) values
  (null, 'Banco Ganadero', 1),
  (null, 'Banco Económico', 2),
  (null, 'Banco Sol', 3),
  (null, 'Efectivo', 4)
on conflict do nothing;

-- Categorías PERSONAL — gastos
insert into public.categories (user_id, domain, kind, name, icon, sort_order) values
  (null,'personal','gasto','Alimentación','utensils',1),
  (null,'personal','gasto','Salud','health',2),
  (null,'personal','gasto','Transporte / Gasolina','fuel',3),
  (null,'personal','gasto','Vivienda','house',4),
  (null,'personal','gasto','Servicios','plug',5),
  (null,'personal','gasto','Educación','education',6),
  (null,'personal','gasto','Otros','dot',99)
on conflict do nothing;

-- Categorías PERSONAL — ingresos
insert into public.categories (user_id, domain, kind, name, icon, sort_order) values
  (null,'personal','ingreso','Sueldo / Negocio','wallet',1),
  (null,'personal','ingreso','Cafetería','coffee',2),
  (null,'personal','ingreso','Otros ingresos','plus',99)
on conflict do nothing;

-- Categorías GANADERÍA — gastos
insert into public.categories (user_id, domain, kind, name, icon, sort_order) values
  (null,'ganaderia','gasto','Veterinario','stethoscope',1),
  (null,'ganaderia','gasto','Medicamentos','pill',2),
  (null,'ganaderia','gasto','Alimentación / Forraje','wheat',3),
  (null,'ganaderia','gasto','Mano de obra / Salarios','workers',4),
  (null,'ganaderia','gasto','Compra de animales','cow',5),
  (null,'ganaderia','gasto','Insumos / Equipos','tools',6),
  (null,'ganaderia','gasto','Combustible','fuel',7),
  (null,'ganaderia','gasto','Otros','dot',99)
on conflict do nothing;

-- Categorías GANADERÍA — ingresos
insert into public.categories (user_id, domain, kind, name, icon, sort_order) values
  (null,'ganaderia','ingreso','Venta de animales','cow',1),
  (null,'ganaderia','ingreso','Venta de leche','milk',2),
  (null,'ganaderia','ingreso','Venta de carne','beef',3),
  (null,'ganaderia','ingreso','Otros ingresos','plus',99)
on conflict do nothing;
