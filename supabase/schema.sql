
create extension if not exists pgcrypto;

create table if not exists salon_info (
  slug text primary key,
  name text not null,
  salon_type text not null,
  location text not null,
  map_url text,
  phone text not null,
  category text,
  area text,
  rating numeric(2,1),
  review_count integer,
  opening_hours jsonb not null,
  today_hours text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text,
  duration_minutes integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_code text not null unique,
  manage_token uuid not null unique default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  service_id uuid references services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_status_check check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'))
);

create index if not exists appointments_starts_at_idx on appointments (starts_at);
create index if not exists appointments_customer_id_idx on appointments (customer_id);
create index if not exists appointments_service_id_idx on appointments (service_id);

-- Enable RLS on every table so access stays explicit.
alter table salon_info enable row level security;
alter table services enable row level security;
alter table customers enable row level security;
alter table appointments enable row level security;

-- Public read access for the salon catalog used by the landing page/chatbot.
drop policy if exists "Public can read salon info" on salon_info;
create policy "Public can read salon info"
  on salon_info
  for select
  using (true);

drop policy if exists "Service role can manage salon info" on salon_info;
create policy "Service role can manage salon info"
  on salon_info
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Public can read services" on services;
create policy "Public can read services"
  on services
  for select
  using (true);

drop policy if exists "Service role can manage services" on services;
create policy "Service role can manage services"
  on services
  for all
  to service_role
  using (true)
  with check (true);

-- Appointment/customer rows are handled through the server-side service role.
drop policy if exists "Service role can manage customers" on customers;
create policy "Service role can manage customers"
  on customers
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage appointments" on appointments;
create policy "Service role can manage appointments"
  on appointments
  for all
  to service_role
  using (true)
  with check (true);

insert into salon_info (
  slug,
  name,
  salon_type,
  location,
  map_url,
  phone,
  category,
  area,
  rating,
  review_count,
  opening_hours,
  today_hours,
  description
)
values (
  'hairplay-zone',
  'Hairplay-Zone',
  'Beauty Salon',
  'Bishal Chowk, Nakhipot Rd, Lalitpur 44700, Nepal',
  'https://maps.app.goo.gl/Q9Z8iEsXqEiY2CYV8',
  '9803010069',
  'Beauty salon',
  'Nakhipot, Lalitpur',
  4.7,
  120,
  '{"monday":"10:00 AM - 7:00 PM","tuesday":"10:00 AM - 7:00 PM","wednesday":"10:00 AM - 7:00 PM","thursday":"10:00 AM - 7:00 PM","friday":"10:00 AM - 7:00 PM","saturday":"10:00 AM - 7:00 PM","sunday":"10:00 AM - 7:00 PM"}'::jsonb,
  'Friday — 10:00 AM - 7:00 PM',
  'Hairplay-Zone is a friendly beauty salon in Lalitpur with guest booking, chat-based support, and quick appointment actions.'
)
on conflict (slug) do update
set
  name = excluded.name,
  salon_type = excluded.salon_type,
  location = excluded.location,
  map_url = excluded.map_url,
  phone = excluded.phone,
  category = excluded.category,
  area = excluded.area,
  rating = excluded.rating,
  review_count = excluded.review_count,
  opening_hours = excluded.opening_hours,
  today_hours = excluded.today_hours,
  description = excluded.description,
  updated_at = now();

insert into services (slug, name, description, category, duration_minutes)
values
  ('haircut', 'Haircut', 'Basic haircut and shaping for everyday salon visits.', 'Hair', 45),
  ('hair-styling', 'Hair Styling', 'Blow-dry, styling, and finish for events or regular grooming.', 'Hair', 60),
  ('beard-trim', 'Beard Trim', 'Beard shaping and trimming.', 'Men', 20),
  ('facial', 'Facial', 'Refreshing facial treatment.', 'Skin', 60),
  ('hair-treatment', 'Hair Treatment', 'Deep treatment for hair care and repair.', 'Hair', 75),
  ('hair-color', 'Hair Coloring', 'Coloring service for selected hair styles.', 'Hair', 120)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  duration_minutes = excluded.duration_minutes,
  active = true,
  updated_at = now();
