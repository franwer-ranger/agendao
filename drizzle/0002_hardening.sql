-- Custom SQL migration file, put your code below! --

-- 1. Columna generada `during` en booking_items (única tabla que usan el
--    EXCLUDE y el trigger de capacidad; YAGNI, no se añade a bookings).
alter table booking_items
  add column during tstzrange
  generated always as (tstzrange(starts_at, ends_at, '[)')) stored;

-- 2. EXCLUDE de no-solape por empleado (recuperado verbatim de
--    supabase/migrations/20260510120003_bookings.sql @ c490267).
alter table booking_items
  add constraint booking_items_no_overlap_per_employee
  exclude using gist (
    employee_id with =,
    during with &&
  ) where (booking_status in ('pending','confirmed','in_progress'));

-- 3. SOLO el trigger de capacidad (booking_items_check_capacity), recuperado
--    verbatim de supabase/migrations/20260510120004_booking_validations.sql
--    @ c490267. NO se instala `booking_items_validate` (el trigger de
--    validación completo): esas comprobaciones (horario, descansos,
--    time-off, cierres, horas de salón, antelación mínima) se quedan en el
--    pre-check TS de lib/availability/booking.ts (decisión híbrida, opción A).
create or replace function booking_items_check_capacity()
returns trigger
language plpgsql
as $$
declare
  cap int;
  cnt int;
begin
  if new.booking_status not in ('pending','confirmed','in_progress') then
    return new;
  end if;

  select max_concurrent into cap from services where id = new.service_id;
  if cap is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('cap:' || new.service_id::text, 0)
  );

  select count(*) into cnt
    from booking_items bi
   where bi.service_id = new.service_id
     and bi.booking_status in ('pending','confirmed','in_progress')
     and bi.during && new.during
     and bi.id <> coalesce(new.id, -1);

  if cnt >= cap then
    raise exception 'service_capacity_exceeded'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger t03_booking_items_check_capacity
before insert or update on booking_items
for each row execute function booking_items_check_capacity();
