-- Multi-User Isolated Notebook Storage & Tables
create table if not exists user_notebook_state (
  user_id text primary key references "user" ("id") on delete cascade,
  folders jsonb not null default '["All notes","Trade Notes","Daily Journal","Sessions Recap","My notes"]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table google_user_databases
  add column if not exists notebook_state jsonb not null default '{"folders":["All notes","Trade Notes","Daily Journal","Sessions Recap","My notes"],"notes":[]}'::jsonb;

create index if not exists idx_user_notebook_state_updated_at on user_notebook_state (updated_at);
