-- Bloque 4 — Notificaciones por email.
-- Tabla `booking_notifications`: registro de cada email enviado para garantizar
-- idempotencia (no duplicar confirmación, recordatorio, etc.). El identificador
-- de unicidad es (booking_id, kind, version). `version` solo se usa para
-- reprogramaciones, que pueden ocurrir varias veces sobre la misma reserva;
-- para los demás kinds queda en 0 y la unique key actúa como `(booking_id, kind)`.
--
-- También añade el flag `notify_salon_on_new_booking` a `salons` (activado por
-- defecto: el salón quiere enterarse de cada nueva reserva).

alter table salons
  add column notify_salon_on_new_booking boolean not null default true;

create table booking_notifications (
  id bigint generated always as identity primary key,
  booking_id bigint not null references bookings(id) on delete cascade,
  salon_id bigint not null references salons(id) on delete cascade,
  kind text not null check (kind in (
    'booking_confirmation',
    'booking_reminder',
    'booking_cancellation',
    'booking_reschedule',
    'salon_new_booking'
  )),
  version int not null default 0,
  sent_at timestamptz not null default now(),
  provider_message_id text,
  unique (booking_id, kind, version)
);

create index booking_notifications_salon_idx on booking_notifications (salon_id);
create index booking_notifications_booking_idx on booking_notifications (booking_id);

alter table booking_notifications enable row level security;

-- Solo miembros del salón pueden leer el log de notificaciones; el envío real
-- ocurre desde el servidor con service_role (bypassa RLS), por lo que no hay
-- política de INSERT para usuarios.
create policy booking_notifications_member_select on booking_notifications
  for select to authenticated
  using ((select is_salon_member(salon_id)));
