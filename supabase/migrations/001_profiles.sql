-- Plan limit helper functions
create or replace function get_plan_trip_limit(plan text)
returns int language sql immutable as $$
  select case plan
    when 'free'     then 1
    when 'premium'  then 10
    when 'pro'      then 30
    when 'business' then 2147483647
    else 1
  end;
$$;

create or replace function get_plan_event_limit(plan text)
returns int language sql immutable as $$
  select case plan
    when 'free'     then 10
    when 'premium'  then 30
    when 'pro'      then 2147483647
    when 'business' then 2147483647
    else 10
  end;
$$;

-- Profiles table
create table if not exists public.profiles (
  id                     uuid        primary key references auth.users on delete cascade,
  email                  text,
  full_name              text,
  avatar_url             text,
  phone                  text,
  country                text,
  plan                   text        not null default 'free'
                                     check (plan in ('free', 'premium', 'pro', 'business')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text,
  created_at             timestamptz not null default now()
);

-- RLS on profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
