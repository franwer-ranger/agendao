-- "Dumb" data helpers for the TS availability composer.
-- They return raw blocking intervals; composition (subtract from schedule,
-- chunk into slots, chain services, assign "any employee") lives in TS.

-- All blocking intervals for an employee inside the requested range,
-- already cropped to the range. Returns: time-off, salon closures, and
-- active booking items.
create or replace function employee_blocking_intervals(
  p_employee_id bigint,
  p_range tstzrange
)
returns table (
  source text,         -- 'time_off' | 'closure' | 'booking_item'
  source_id bigint,    -- id within its source table
  during tstzrange     -- intersection with p_range
)
language sql
stable
as $$
  select 'time_off'::text, t.id, (t.during * p_range)
    from employee_time_off t
   where t.employee_id = p_employee_id
     and t.during && p_range

  union all

  select 'closure'::text, c.id, (c.during * p_range)
    from salon_closures c
    join employees e on e.salon_id = c.salon_id
   where e.id = p_employee_id
     and c.during && p_range

  union all

  select 'booking_item'::text, bi.id, (bi.during * p_range)
    from booking_items bi
   where bi.employee_id = p_employee_id
     and bi.booking_status in ('pending','confirmed','in_progress')
     and bi.during && p_range;
$$;

revoke all on function employee_blocking_intervals(bigint, tstzrange) from public;
grant execute on function employee_blocking_intervals(bigint, tstzrange)
  to authenticated, service_role;
