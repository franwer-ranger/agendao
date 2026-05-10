create table employee_weekly_schedule (
  id bigint generated always as identity primary key,
  employee_id bigint not null references employees(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null check (ends_at > starts_at),
  effective_from date not null default current_date,
  effective_until date,
  check (effective_until is null or effective_until >= effective_from),
  created_at timestamptz not null default now()
);

create index employee_weekly_schedule_employee_id_idx
  on employee_weekly_schedule (employee_id);
create index employee_weekly_schedule_lookup_idx
  on employee_weekly_schedule (employee_id, weekday, effective_from, effective_until);

create table employee_recurring_breaks (
  id bigint generated always as identity primary key,
  employee_id bigint not null references employees(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null check (ends_at > starts_at),
  effective_from date not null default current_date,
  effective_until date,
  check (effective_until is null or effective_until >= effective_from),
  label text,
  created_at timestamptz not null default now()
);

create index employee_recurring_breaks_employee_id_idx
  on employee_recurring_breaks (employee_id);
create index employee_recurring_breaks_lookup_idx
  on employee_recurring_breaks (employee_id, weekday, effective_from, effective_until);

create table employee_time_off (
  id bigint generated always as identity primary key,
  employee_id bigint not null references employees(id) on delete cascade,
  during tstzrange not null,
  reason text not null check (reason in ('vacation','sick','personal','training','other')),
  note text,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  exclude using gist (employee_id with =, during with &&)
);

create index employee_time_off_employee_id_idx on employee_time_off (employee_id);

create table salon_closures (
  id bigint generated always as identity primary key,
  salon_id bigint not null references salons(id) on delete cascade,
  during tstzrange not null,
  label text not null,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  exclude using gist (salon_id with =, during with &&)
);

create index salon_closures_salon_id_idx on salon_closures (salon_id);
