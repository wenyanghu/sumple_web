create table if not exists public.app_data (
  key text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

create policy "Allow anon read/write app_data"
  on public.app_data
  for all
  to anon
  using (true)
  with check (true);

insert into public.app_data (key, value)
values ('todos', '[]'::jsonb)
on conflict (key) do nothing;
