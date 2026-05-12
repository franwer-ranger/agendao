-- Bloque 2.3 — Configuración del salón.
-- Añade campos de identidad, reglas de reserva, política de cancelación y
-- aviso legal a `salons`. Crea `salon_working_hours` (horario semanal del
-- salón) y extiende el trigger de validación de reservas para que tratar el
-- salón cerrado como un bloqueo duro en BD.

-- ─── salons: nuevas columnas ───────────────────────────────────────────────

alter table salons add column address text;
alter table salons add column phone text;
alter table salons add column contact_email text;
alter table salons add column logo_path text;

alter table salons add column booking_min_hours_ahead int not null default 2
  check (booking_min_hours_ahead >= 0 and booking_min_hours_ahead <= 168);
alter table salons add column booking_max_days_ahead int not null default 60
  check (booking_max_days_ahead >= 1 and booking_max_days_ahead <= 365);

alter table salons add column cancellation_min_hours int not null default 12
  check (cancellation_min_hours >= 0 and cancellation_min_hours <= 720);
alter table salons add column cancellation_policy_text text;

alter table salons add column terms_text text;

-- ─── salon_working_hours: horario semanal del salón ────────────────────────
-- Una fila por (salon_id, weekday). Tramo único por día. Si no hay fila
-- para un weekday, el salón está cerrado ese día. `opens_at`/`closes_at` ambos
-- NULL también significa cerrado (permitimos guardar el día explícitamente
-- como cerrado si conviene a la UI).

create table salon_working_hours (
  id bigint generated always as identity primary key,
  salon_id bigint not null references salons(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now(),
  unique (salon_id, weekday),
  check (
    (opens_at is null and closes_at is null)
    or (opens_at is not null and closes_at is not null and closes_at > opens_at)
  )
);

create index salon_working_hours_salon_idx on salon_working_hours (salon_id);

alter table salon_working_hours enable row level security;

create policy swh_public_select on salon_working_hours
  for select to anon, authenticated using (true);

create policy swh_member_write on salon_working_hours
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

-- ─── booking_items_validate: bloqueo por horario del salón ─────────────────
-- Reemplaza la función (CREATE OR REPLACE preserva el trigger ya enganchado).
-- Si existe horario configurado para ese weekday del salón, la reserva debe
-- caer dentro. Si no existe fila o `opens_at` es NULL, el salón está cerrado.
-- Para no romper instalaciones que aún no hayan configurado el horario, si la
-- tabla está completamente vacía para el salón (count = 0), no aplicamos el
-- bloqueo todavía — el dueño verá el aviso en la UI y configurará el horario.

create or replace function booking_items_validate()
returns trigger
language plpgsql
as $$
declare
  tz text;
  emp_salon bigint;
  svc_salon bigint;
  local_start timestamp;
  local_end timestamp;
  local_date date;
  iso_dow smallint;
  swh record;
  hours_configured boolean;
begin
  if new.booking_status not in ('pending','confirmed','in_progress') then
    return new;
  end if;

  select s.timezone into tz
    from bookings b
    join salons s on s.id = b.salon_id
   where b.id = new.booking_id;

  if tz is null then
    raise exception 'booking_or_salon_not_found' using errcode = 'foreign_key_violation';
  end if;

  select salon_id into emp_salon from employees where id = new.employee_id;
  select salon_id into svc_salon from services where id = new.service_id;

  if emp_salon is null or emp_salon <> new.salon_id then
    raise exception 'employee_salon_mismatch';
  end if;
  if svc_salon is null or svc_salon <> new.salon_id then
    raise exception 'service_salon_mismatch';
  end if;

  if not exists (
    select 1 from employee_services es
     where es.employee_id = new.employee_id
       and es.service_id = new.service_id
  ) then
    raise exception 'employee_not_authorized_for_service';
  end if;

  local_start := (new.starts_at at time zone tz);
  local_end := (new.ends_at at time zone tz);
  local_date := local_start::date;

  if local_start::date <> local_end::date then
    raise exception 'booking_spans_multiple_days';
  end if;

  iso_dow := extract(isodow from local_start)::smallint;

  -- Bloqueo por horario del salón. Solo se aplica si el dueño ya ha
  -- configurado algún día (al menos una fila para este salón). Mientras la
  -- tabla esté vacía para el salón, el horario del salón no bloquea — sólo el
  -- del empleado.
  select exists (
    select 1 from salon_working_hours where salon_id = new.salon_id
  ) into hours_configured;

  if hours_configured then
    select opens_at, closes_at into swh
      from salon_working_hours
     where salon_id = new.salon_id and weekday = iso_dow;

    if not found or swh.opens_at is null or swh.closes_at is null then
      raise exception 'booking_outside_salon_hours' using detail = 'salon_closed_that_day';
    end if;

    if local_start::time < swh.opens_at or local_end::time > swh.closes_at then
      raise exception 'booking_outside_salon_hours';
    end if;
  end if;

  if not exists (
    select 1 from employee_weekly_schedule ws
     where ws.employee_id = new.employee_id
       and ws.weekday = iso_dow
       and ws.starts_at <= local_start::time
       and ws.ends_at >= local_end::time
       and ws.effective_from <= local_date
       and (ws.effective_until is null or ws.effective_until >= local_date)
  ) then
    raise exception 'booking_outside_schedule';
  end if;

  if exists (
    select 1 from employee_recurring_breaks rb
     where rb.employee_id = new.employee_id
       and rb.weekday = iso_dow
       and rb.effective_from <= local_date
       and (rb.effective_until is null or rb.effective_until >= local_date)
       and rb.starts_at < local_end::time
       and rb.ends_at > local_start::time
  ) then
    raise exception 'booking_overlaps_break';
  end if;

  if exists (
    select 1 from employee_time_off t
     where t.employee_id = new.employee_id
       and t.during && new.during
  ) then
    raise exception 'booking_overlaps_time_off';
  end if;

  if exists (
    select 1 from salon_closures c
     where c.salon_id = new.salon_id
       and c.during && new.during
  ) then
    raise exception 'booking_overlaps_closure';
  end if;

  return new;
end $$;

-- ─── Storage bucket público para activos del salón (logo) ──────────────────
-- En CLI Supabase los buckets viven en el schema `storage`. Idempotente.

insert into storage.buckets (id, name, public)
values ('salon-assets', 'salon-assets', true)
on conflict (id) do nothing;

-- Lectura pública del bucket (logo se muestra en la landing).
create policy "salon_assets_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'salon-assets');

-- Escritura solo desde el servidor con service_role (no se concede a authenticated
-- aquí porque aún no hay auth real; cuando llegue Block 10 se acotará por salón).
