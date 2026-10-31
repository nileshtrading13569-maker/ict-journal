create table if not exists user_desk_state (
  user_id text primary key references "user" ("id") on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
