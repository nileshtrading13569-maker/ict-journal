-- 0005_journal_indexes.sql
-- Performance optimization for journal and trade queries in Neon Postgres

create index if not exists idx_google_user_databases_trade_history on google_user_databases using gin (trade_history);
create index if not exists idx_google_user_databases_desk_state on google_user_databases using gin (desk_state);
create index if not exists idx_user_desk_state_updated_at on user_desk_state (updated_at);
