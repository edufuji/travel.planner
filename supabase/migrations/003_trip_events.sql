create table if not exists public.trip_events (
  id             uuid        primary key default gen_random_uuid(),
  destination_id uuid        not null references public.destinations(id) on delete cascade,
  user_id        uuid        not null references public.profiles(id),
  type           text        not null check (type in ('transport', 'accommodation', 'ticket', 'restaurant')),
  title          text        not null,
  place          text        not null,
  place_id       text,
  lat            float8,
  lng            float8,
  place_to       text,
  place_id_to    text,
  lat_to         float8,
  lng_to         float8,
  arrival_time   text,
  date           date        not null,
  time           text        not null,
  value          float8,
  notes          text,
  arrived_on_foot boolean    default false,
  created_at     timestamptz not null default now()
);

alter table public.trip_events enable row level security;

create policy "Users can view own events"
  on public.trip_events for select
  using (user_id = auth.uid());

create policy "Users can update own events"
  on public.trip_events for update
  using (user_id = auth.uid());

create policy "Users can delete own events"
  on public.trip_events for delete
  using (user_id = auth.uid());

create policy "Users can insert events within plan limit"
  on public.trip_events for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.destinations
      where id = destination_id
      and user_id = auth.uid()
    )
    and (
      select count(*)
      from public.trip_events
      where destination_id = NEW.destination_id
    ) < get_plan_event_limit(
      (select plan from public.profiles where id = auth.uid())
    )
  );
