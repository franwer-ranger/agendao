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

create trigger t02_booking_items_validate
before insert or update on booking_items
for each row execute function booking_items_validate();

-- Capacity check using advisory xact lock per service.
-- Only enforced for active statuses; cancelled rows release capacity.
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
