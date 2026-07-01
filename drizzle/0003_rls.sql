-- Custom SQL migration file, put your code below! --

-- Task 16: RLS por tenant (GUC app.current_salon_id) en todas las tablas de negocio.
-- Fuente de verdad: .superpowers/sdd/task-16-design.md
--
-- GUC: current_setting('app.current_salon_id', true)::bigint
-- El segundo argumento `true` (missing_ok) hace que devuelva NULL si no hay tenant
-- fijado -> salon_id = NULL -> NULL -> 0 filas -> fail-closed (deniega por defecto).
--
-- `force row level security`: la app se conecta como owner de las tablas en Neon;
-- sin `force` el owner bypassea RLS. Con `force`, aplica también a la conexión app.
--
-- Tablas de auth `auth_sessions` y `auth_password_reset_tokens` NO llevan RLS
-- (se acceden por token/sid opaco, infraestructura de autenticación).

-- ============================================================
-- B. app_users — SELECT abierto (lo necesita el login sin tenant fijado),
--    escrituras scoped por GUC.
-- ============================================================
alter table app_users enable row level security;
alter table app_users force row level security;

create policy app_users_select on app_users
  for select using (true);

create policy app_users_insert on app_users
  for insert
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

create policy app_users_update on app_users
  for update
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

create policy app_users_delete on app_users
  for delete
  using (salon_id = current_setting('app.current_salon_id', true)::bigint);

-- ============================================================
-- C. salons — SELECT público (slug/nombre no son secretos, el flujo público
--    resuelve el salón por slug antes de fijar tenant), INSERT abierto
--    (onboarding crea el primer salón sin salon_id todavía), UPDATE/DELETE por id.
-- ============================================================
alter table salons enable row level security;
alter table salons force row level security;

create policy salons_select on salons
  for select using (true);

create policy salons_insert on salons
  for insert with check (true);

create policy salons_update on salons
  for update
  using (id = current_setting('app.current_salon_id', true)::bigint)
  with check (id = current_setting('app.current_salon_id', true)::bigint);

create policy salons_delete on salons
  for delete
  using (id = current_setting('app.current_salon_id', true)::bigint);

-- ============================================================
-- D. Tablas de negocio con salon_id directo — policy for all.
-- ============================================================
alter table employees enable row level security;
alter table employees force row level security;
create policy employees_tenant on employees
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

alter table services enable row level security;
alter table services force row level security;
create policy services_tenant on services
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

alter table clients enable row level security;
alter table clients force row level security;
create policy clients_tenant on clients
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

alter table salon_closures enable row level security;
alter table salon_closures force row level security;
create policy salon_closures_tenant on salon_closures
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

alter table salon_working_hours enable row level security;
alter table salon_working_hours force row level security;
create policy salon_working_hours_tenant on salon_working_hours
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

alter table bookings enable row level security;
alter table bookings force row level security;
create policy bookings_tenant on bookings
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

alter table booking_items enable row level security;
alter table booking_items force row level security;
create policy booking_items_tenant on booking_items
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

alter table booking_status_events enable row level security;
alter table booking_status_events force row level security;
create policy booking_status_events_tenant on booking_status_events
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

alter table booking_notifications enable row level security;
alter table booking_notifications force row level security;
create policy booking_notifications_tenant on booking_notifications
  for all
  using (salon_id = current_setting('app.current_salon_id', true)::bigint)
  with check (salon_id = current_setting('app.current_salon_id', true)::bigint);

-- ============================================================
-- E. Tablas hijas sin salon_id — policy vía employees.employee_id.
-- ============================================================
alter table employee_services enable row level security;
alter table employee_services force row level security;
create policy employee_services_tenant on employee_services
  for all
  using (exists (
    select 1 from employees e
     where e.id = employee_services.employee_id
       and e.salon_id = current_setting('app.current_salon_id', true)::bigint))
  with check (exists (
    select 1 from employees e
     where e.id = employee_services.employee_id
       and e.salon_id = current_setting('app.current_salon_id', true)::bigint));

alter table employee_weekly_schedule enable row level security;
alter table employee_weekly_schedule force row level security;
create policy employee_weekly_schedule_tenant on employee_weekly_schedule
  for all
  using (exists (
    select 1 from employees e
     where e.id = employee_weekly_schedule.employee_id
       and e.salon_id = current_setting('app.current_salon_id', true)::bigint))
  with check (exists (
    select 1 from employees e
     where e.id = employee_weekly_schedule.employee_id
       and e.salon_id = current_setting('app.current_salon_id', true)::bigint));

alter table employee_recurring_breaks enable row level security;
alter table employee_recurring_breaks force row level security;
create policy employee_recurring_breaks_tenant on employee_recurring_breaks
  for all
  using (exists (
    select 1 from employees e
     where e.id = employee_recurring_breaks.employee_id
       and e.salon_id = current_setting('app.current_salon_id', true)::bigint))
  with check (exists (
    select 1 from employees e
     where e.id = employee_recurring_breaks.employee_id
       and e.salon_id = current_setting('app.current_salon_id', true)::bigint));

alter table employee_time_off enable row level security;
alter table employee_time_off force row level security;
create policy employee_time_off_tenant on employee_time_off
  for all
  using (exists (
    select 1 from employees e
     where e.id = employee_time_off.employee_id
       and e.salon_id = current_setting('app.current_salon_id', true)::bigint))
  with check (exists (
    select 1 from employees e
     where e.id = employee_time_off.employee_id
       and e.salon_id = current_setting('app.current_salon_id', true)::bigint));

-- ============================================================
-- F. booking_tokens — sin salon_id, vía bookings.booking_id.
-- ============================================================
alter table booking_tokens enable row level security;
alter table booking_tokens force row level security;
create policy booking_tokens_tenant on booking_tokens
  for all
  using (exists (
    select 1 from bookings b
     where b.id = booking_tokens.booking_id
       and b.salon_id = current_setting('app.current_salon_id', true)::bigint))
  with check (exists (
    select 1 from bookings b
     where b.id = booking_tokens.booking_id
       and b.salon_id = current_setting('app.current_salon_id', true)::bigint));
