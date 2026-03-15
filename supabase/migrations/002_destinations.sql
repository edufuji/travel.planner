create table if not exists public.destinations (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  title      text        not null,
  emoji      text        not null default '✈️',
  start_date date        not null,
  end_date   date        not null,
  created_at timestamptz not null default now()
);

alter table public.destinations enable row level security;

create policy "Users can view own destinations"
  on public.destinations for select
  using (user_id = auth.uid());

create policy "Users can update own destinations"
  on public.destinations for update
  using (user_id = auth.uid());

create policy "Users can delete own destinations"
  on public.destinations for delete
  using (user_id = auth.uid());

create policy "Users can insert destinations within plan limit"
  on public.destinations for insert
  with check (
    user_id = auth.uid()
    and (
      select count(*)
      from public.destinations
      where user_id = auth.uid()
    ) < get_plan_trip_limit(
      (select plan from public.profiles where id = auth.uid())
    )
  );
