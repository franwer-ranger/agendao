create table bookings (
  id bigint generated always as identity primary key,
  public_id uuid not null default gen_random_uuid(),
  salon_id bigint not null references salons(id) on delete restrict,
  client_id bigint not null references clients(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  status text not null
    check (status in ('pending','confirmed','in_progress','completed','cancelled_client','cancelled_salon','no_show')),
  client_note text,
  internal_note text,
  source text not null default 'web'
    check (source in ('web','admin','phone','walk_in')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  version int not null default 0,
  constraint bookings_public_id_unique unique (public_id),
  constraint bookings_idempotency_unique unique nulls not distinct (idempotency_key)
);

create index bookings_salon_id_idx on bookings (salon_id);
create index bookings_client_id_idx on bookings (client_id);
create index bookings_salon_starts_idx on bookings (salon_id, starts_at);

create table booking_items (
  id bigint generated always as identity primary key,
  booking_id bigint not null references bookings(id) on delete cascade,
  salon_id bigint not null references salons(id) on delete restrict,
  position smallint not null check (position >= 0),
  service_id bigint not null references services(id) on delete restrict,
  employee_id bigint not null references employees(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  service_snapshot jsonb not null,
  booking_status text not null,
  created_at timestamptz not null default now(),
  unique (booking_id, position),
  constraint booking_items_no_overlap_per_employee
    exclude using gist (
      employee_id with =,
      during with &&
    ) where (booking_status in ('pending','confirmed','in_progress'))
);

create index booking_items_booking_id_idx on booking_items (booking_id);
create index booking_items_service_id_idx on booking_items (service_id);
create index booking_items_employee_id_idx on booking_items (employee_id);

create index booking_items_employee_starts_active_idx
  on booking_items (employee_id, starts_at)
  where booking_status in ('pending','confirmed','in_progress');

create index booking_items_service_starts_active_idx
  on booking_items (service_id, starts_at)
  where booking_status in ('pending','confirmed','in_progress');

create table booking_status_events (
  id bigint generated always as identity primary key,
  booking_id bigint not null references bookings(id) on delete cascade,
  salon_id bigint not null references salons(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_type text not null check (actor_type in ('client','staff','system')),
  actor_id text,
  reason text,
  at timestamptz not null default now()
);

create index booking_status_events_booking_id_idx on booking_status_events (booking_id);

create table booking_tokens (
  id bigint generated always as identity primary key,
  booking_id bigint not null references bookings(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null default 'manage' check (purpose in ('manage')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index booking_tokens_booking_id_idx on booking_tokens (booking_id);

-- Sync: items inherit salon_id and booking_status from their parent booking.
-- Names prefixed t01_ so this fires before the validation triggers in 0004.
create or replace function booking_items_inherit_from_booking()
returns trigger
language plpgsql
as $$
declare
  parent_salon_id bigint;
  parent_status text;
begin
  select salon_id, status
    into parent_salon_id, parent_status
    from bookings
   where id = new.booking_id;

  if parent_salon_id is null then
    raise exception 'booking_not_found' using errcode = 'foreign_key_violation';
  end if;

  new.salon_id := parent_salon_id;
  new.booking_status := parent_status;
  return new;
end $$;

create trigger t01_booking_items_inherit_from_booking
before insert or update of booking_id on booking_items
for each row execute function booking_items_inherit_from_booking();

-- Sync: when bookings.status changes, propagate to all items so the partial
-- EXCLUDE on booking_status reflects reality.
create or replace function bookings_propagate_status_to_items()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    update booking_items
       set booking_status = new.status
     where booking_id = new.id;
  end if;
  return null;
end $$;

create trigger bookings_propagate_status_to_items
after update of status on bookings
for each row execute function bookings_propagate_status_to_items();

-- Recompute booking window (starts_at/ends_at) from items.
-- The first item insert sets the window; subsequent changes keep it in sync.
create or replace function bookings_recompute_window()
returns trigger
language plpgsql
as $$
declare
  bid bigint;
  v_start timestamptz;
  v_end timestamptz;
begin
  bid := coalesce(new.booking_id, old.booking_id);

  select min(starts_at), max(ends_at)
    into v_start, v_end
  from booking_items
  where booking_id = bid;

  if v_start is not null and v_end is not null then
    update bookings
       set starts_at = v_start,
           ends_at = v_end
     where id = bid
       and (starts_at is distinct from v_start or ends_at is distinct from v_end);
  end if;

  return null;
end $$;

create trigger bookings_recompute_window
after insert or update of starts_at, ends_at, booking_id or delete on booking_items
for each row execute function bookings_recompute_window();

-- Items must be contiguous within a booking (item[i].starts_at == item[i-1].ends_at).
-- Deferred so all items can be inserted in one transaction before validating.
create or replace function booking_items_check_contiguous()
returns trigger
language plpgsql
as $$
declare
  bid bigint;
  prev_end timestamptz;
  rec record;
begin
  bid := coalesce(new.booking_id, old.booking_id);

  prev_end := null;
  for rec in
    select position, starts_at, ends_at
      from booking_items
     where booking_id = bid
     order by position
  loop
    if prev_end is not null and rec.starts_at <> prev_end then
      raise exception 'booking_items_not_contiguous'
        using detail = format('position %s expected to start at %s, got %s',
                              rec.position, prev_end, rec.starts_at);
    end if;
    prev_end := rec.ends_at;
  end loop;

  return null;
end $$;

create constraint trigger booking_items_contiguous_check
after insert or update or delete on booking_items
deferrable initially deferred
for each row execute function booking_items_check_contiguous();

-- Status event log: initial event on insert + transition events on update.
create or replace function bookings_log_status_event()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into booking_status_events (booking_id, salon_id, from_status, to_status, actor_type, actor_id, reason)
      values (new.id, new.salon_id, null, new.status, 'system', null, null);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into booking_status_events (booking_id, salon_id, from_status, to_status, actor_type, actor_id, reason)
      values (new.id, new.salon_id, old.status, new.status, 'system', null, new.cancellation_reason);
  end if;
  return null;
end $$;

create trigger bookings_log_status_event_insert
after insert on bookings
for each row execute function bookings_log_status_event();

create trigger bookings_log_status_event_update
after update of status on bookings
for each row execute function bookings_log_status_event();
