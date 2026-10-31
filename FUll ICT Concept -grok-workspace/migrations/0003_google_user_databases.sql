-- Isolated database and storage for each Google account (keyed by Google User ID).
--
-- After Google OAuth authentication, each unique Google User ID receives an
-- independent, isolated data environment for trade history, map-related
-- collections, screenshots, and related desk state.

create table if not exists google_user_databases (
  google_user_id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  email text,
  name text,
  picture text,
  trade_history jsonb not null default '[]'::jsonb,
  map_data jsonb not null default '{}'::jsonb,
  screenshots jsonb not null default '{}'::jsonb,
  desk_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_google_user_databases_user_id on google_user_databases (user_id);
