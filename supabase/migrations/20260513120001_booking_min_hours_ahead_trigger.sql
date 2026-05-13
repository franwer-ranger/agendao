-- Re-valida la antelación mínima en BD para reservas creadas desde el flujo
-- público (source='web'). El motor ya filtra slots fuera de la ventana al
-- listar disponibilidad, pero un wizard lento puede llegar al INSERT con un
-- slot que ya cayó dentro de la ventana mínima desde que se mostró.
-- Walk-ins y reservas admin no se ven afectadas (source != 'web').

create or replace function booking_items_check_min_hours_ahead()
returns trigger
language plpgsql
as $$
declare
  src text;
  min_hours int;
begin
  if new.booking_status not in ('pending','confirmed','in_progress') then
    return new;
  end if;

  select b.source, s.booking_min_hours_ahead
    into src, min_hours
    from bookings b
    join salons s on s.id = b.salon_id
   where b.id = new.booking_id;

  if src is null then
    raise exception 'booking_or_salon_not_found' using errcode = 'foreign_key_violation';
  end if;

  if src <> 'web' then
    return new;
  end if;

  if min_hours is null or min_hours <= 0 then
    return new;
  end if;

  if new.starts_at < now() + (min_hours || ' hours')::interval then
    raise exception 'booking_too_close_to_now';
  end if;

  return new;
end $$;

create trigger t04_booking_items_check_min_hours_ahead
before insert on booking_items
for each row execute function booking_items_check_min_hours_ahead();
