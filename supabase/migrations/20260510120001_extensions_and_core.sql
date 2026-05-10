create extension if not exists btree_gist;
create extension if not exists citext;
create extension if not exists pgcrypto;

create table salons (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  timezone text not null default 'Europe/Madrid',
  locale text not null default 'es-ES',
  slot_granularity_minutes int not null default 15
    check (slot_granularity_minutes > 0 and slot_granularity_minutes <= 120),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  salon_id bigint not null references salons(id) on delete restrict,
  role text not null check (role in ('admin','staff')),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index app_users_salon_id_idx on app_users (salon_id);

create table employees (
  id bigint generated always as identity primary key,
  salon_id bigint not null references salons(id) on delete restrict,
  app_user_id uuid references app_users(id) on delete set null,
  display_name text not null,
  slug text not null,
  bio text,
  photo_path text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (salon_id, slug)
);

create index employees_salon_id_idx on employees (salon_id);
create index employees_app_user_id_idx on employees (app_user_id) where app_user_id is not null;

create table services (
  id bigint generated always as identity primary key,
  salon_id bigint not null references salons(id) on delete restrict,
  name text not null,
  slug text not null,
  description text,
  duration_minutes int not null
    check (duration_minutes > 0 and duration_minutes % 5 = 0),
  price_cents int not null check (price_cents >= 0),
  max_concurrent int check (max_concurrent is null or max_concurrent > 0),
  color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (salon_id, slug)
);

create index services_salon_id_idx on services (salon_id);

create table employee_services (
  employee_id bigint not null references employees(id) on delete cascade,
  service_id bigint not null references services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employee_id, service_id)
);

create index employee_services_service_id_idx on employee_services (service_id);

create table clients (
  id bigint generated always as identity primary key,
  salon_id bigint not null references salons(id) on delete restrict,
  email citext,
  phone text,
  display_name text not null,
  internal_notes text,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create unique index clients_salon_email_unique
  on clients (salon_id, email) where email is not null;
create unique index clients_salon_phone_unique
  on clients (salon_id, phone) where phone is not null;
create index clients_salon_id_idx on clients (salon_id);
