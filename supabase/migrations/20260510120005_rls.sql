-- Helpers
create or replace function is_salon_member(target_salon_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.app_users
     where salon_id = target_salon_id
       and id = (select auth.uid())
       and is_active
  );
$$;

revoke all on function is_salon_member(bigint) from public;
grant execute on function is_salon_member(bigint) to authenticated;

-- Enable RLS on every business table
alter table salons enable row level security;
alter table app_users enable row level security;
alter table employees enable row level security;
alter table services enable row level security;
alter table employee_services enable row level security;
alter table clients enable row level security;
alter table employee_weekly_schedule enable row level security;
alter table employee_recurring_breaks enable row level security;
alter table employee_time_off enable row level security;
alter table salon_closures enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;
alter table booking_status_events enable row level security;
alter table booking_tokens enable row level security;

-- salons: public read (slug, name, timezone are not secrets); writes by members.
create policy salons_public_select on salons
  for select to anon, authenticated using (true);

create policy salons_member_write on salons
  for update to authenticated
  using ((select is_salon_member(id)))
  with check ((select is_salon_member(id)));

-- app_users: see your own row + see fellow members of your salon.
create policy app_users_self_select on app_users
  for select to authenticated using (id = (select auth.uid()));

create policy app_users_salon_select on app_users
  for select to authenticated using ((select is_salon_member(salon_id)));

create policy app_users_salon_write on app_users
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

-- employees: active employees readable by anon (public booking UI); members full.
create policy employees_public_active_select on employees
  for select to anon using (is_active);

create policy employees_member_select on employees
  for select to authenticated using ((select is_salon_member(salon_id)));

create policy employees_member_write on employees
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

-- services: same shape as employees
create policy services_public_active_select on services
  for select to anon using (is_active);

create policy services_member_select on services
  for select to authenticated using ((select is_salon_member(salon_id)));

create policy services_member_write on services
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

-- employee_services: anon needs it to know who can do which service.
create policy employee_services_public_select on employee_services
  for select to anon using (true);

create policy employee_services_member_all on employee_services
  for all to authenticated
  using (
    exists (select 1 from employees e
             where e.id = employee_services.employee_id
               and (select is_salon_member(e.salon_id)))
  )
  with check (
    exists (select 1 from employees e
             where e.id = employee_services.employee_id
               and (select is_salon_member(e.salon_id)))
  );

-- clients: salon members only. Public booking creates clients via service role / RPC.
create policy clients_member_all on clients
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

-- Schedules/breaks/time-off/closures: salon members only.
-- Anon availability is computed server-side with the service role.
create policy ews_member_all on employee_weekly_schedule
  for all to authenticated
  using (
    exists (select 1 from employees e
             where e.id = employee_weekly_schedule.employee_id
               and (select is_salon_member(e.salon_id)))
  )
  with check (
    exists (select 1 from employees e
             where e.id = employee_weekly_schedule.employee_id
               and (select is_salon_member(e.salon_id)))
  );

create policy erb_member_all on employee_recurring_breaks
  for all to authenticated
  using (
    exists (select 1 from employees e
             where e.id = employee_recurring_breaks.employee_id
               and (select is_salon_member(e.salon_id)))
  )
  with check (
    exists (select 1 from employees e
             where e.id = employee_recurring_breaks.employee_id
               and (select is_salon_member(e.salon_id)))
  );

create policy eto_member_all on employee_time_off
  for all to authenticated
  using (
    exists (select 1 from employees e
             where e.id = employee_time_off.employee_id
               and (select is_salon_member(e.salon_id)))
  )
  with check (
    exists (select 1 from employees e
             where e.id = employee_time_off.employee_id
               and (select is_salon_member(e.salon_id)))
  );

create policy sc_member_all on salon_closures
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

-- Bookings: salon members only. Public access via RPC.
create policy bookings_member_all on bookings
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

create policy booking_items_member_all on booking_items
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

create policy booking_status_events_member_all on booking_status_events
  for all to authenticated
  using ((select is_salon_member(salon_id)))
  with check ((select is_salon_member(salon_id)));

create policy booking_tokens_member_all on booking_tokens
  for all to authenticated
  using (
    exists (select 1 from bookings b
             where b.id = booking_tokens.booking_id
               and (select is_salon_member(b.salon_id)))
  )
  with check (
    exists (select 1 from bookings b
             where b.id = booking_tokens.booking_id
               and (select is_salon_member(b.salon_id)))
  );


-- Public RPCs for the magic-link flow.
-- TS hashes the token (SHA-256, hex) before calling these — the raw token never
-- reaches SQL.

create or replace function lookup_booking_via_token(
  p_public_id uuid,
  p_token_hash text
)
returns table (
  public_id uuid,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  client_note text,
  salon_slug text,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select b.public_id,
         b.status,
         b.starts_at,
         b.ends_at,
         b.client_note,
         s.slug,
         t.expires_at
    from public.bookings b
    join public.salons s on s.id = b.salon_id
    join public.booking_tokens t on t.booking_id = b.id
   where b.public_id = p_public_id
     and t.token_hash = p_token_hash
     and t.expires_at > now();
$$;

revoke all on function lookup_booking_via_token(uuid, text) from public;
grant execute on function lookup_booking_via_token(uuid, text) to anon, authenticated;


create or replace function cancel_booking_via_token(
  p_public_id uuid,
  p_token_hash text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id bigint;
  v_token_id bigint;
  v_status text;
begin
  select b.id, b.status, t.id
    into v_booking_id, v_status, v_token_id
  from public.bookings b
  join public.booking_tokens t on t.booking_id = b.id
  where b.public_id = p_public_id
    and t.token_hash = p_token_hash
    and t.expires_at > now();

  if v_booking_id is null then
    raise exception 'invalid_or_expired_token' using errcode = 'insufficient_privilege';
  end if;

  if v_status not in ('pending','confirmed') then
    raise exception 'booking_not_cancellable' using errcode = 'check_violation', detail = v_status;
  end if;

  update public.bookings
     set status = 'cancelled_client',
         cancelled_at = now(),
         cancellation_reason = p_reason
   where id = v_booking_id;

  update public.booking_tokens
     set used_at = coalesce(used_at, now())
   where id = v_token_id;

  return 'cancelled_client';
end $$;

revoke all on function cancel_booking_via_token(uuid, text, text) from public;
grant execute on function cancel_booking_via_token(uuid, text, text) to anon, authenticated;
