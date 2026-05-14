-- Demo data for local development.
-- Skips entirely if the demo salon already exists, so re-running is safe.

do $$
declare
  v_salon_id bigint;
  v_marina bigint;
  v_ana bigint;
begin
  if exists (select 1 from salons where slug = 'demo') then
    return;
  end if;

  insert into salons (slug, name, timezone, locale, slot_granularity_minutes)
  values ('demo', 'Salón Demo', 'Europe/Madrid', 'es-ES', 15)
  returning id into v_salon_id;

  insert into employees (salon_id, display_name, slug, display_order, bio, color_hex)
  values
    (v_salon_id, 'Marina Pérez', 'marina', 0, 'Especialista en color y mechas.', '#4F46E5'),
    (v_salon_id, 'Ana Ruiz',     'ana',    1, 'Cortes y peinados de novia.',     '#0EA5E9');

  select id into v_marina from employees where salon_id = v_salon_id and slug = 'marina';
  select id into v_ana    from employees where salon_id = v_salon_id and slug = 'ana';

  insert into services (salon_id, name, slug, duration_minutes, price_cents, max_concurrent, color_hex, display_order) values
    (v_salon_id, 'Corte',   'corte',    30, 1800, null, '#4F46E5', 0),
    (v_salon_id, 'Peinado', 'peinado',  45, 2500, null, '#0EA5E9', 1),
    (v_salon_id, 'Color',   'color',    90, 6500, 1,    '#DB2777', 2),
    (v_salon_id, 'Mechas',  'mechas',  120, 9500, 1,    '#F59E0B', 3);

  -- Both employees can do all demo services
  insert into employee_services (employee_id, service_id)
  select e.id, sv.id
    from employees e
    cross join services sv
   where e.salon_id = v_salon_id and sv.salon_id = v_salon_id;

  -- Schedule: Mon–Fri, split shift 09:00–14:00 / 17:00–20:00
  insert into employee_weekly_schedule (employee_id, weekday, starts_at, ends_at)
  select emp_id, d.weekday, t.starts_at, t.ends_at
    from (values (v_marina), (v_ana)) as e(emp_id)
    cross join (values (1),(2),(3),(4),(5)) as d(weekday)
    cross join (values
      (time '09:00', time '14:00'),
      (time '17:00', time '20:00')
    ) as t(starts_at, ends_at);

  -- Lunch break Mon–Fri 14:00–17:00 is implicit (gap in schedule).
  -- A short coffee break example for Marina, Tue 11:00–11:15:
  insert into employee_recurring_breaks (employee_id, weekday, starts_at, ends_at, label)
  values (v_marina, 2, time '11:00', time '11:15', 'Café');
end $$;
