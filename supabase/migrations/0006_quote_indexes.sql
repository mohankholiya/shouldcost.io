-- 0006_quote_indexes.sql — optional performance indexes for Phase 2 quotes.
-- Non-blocking: the app functions without these; apply via `supabase migration up --linked`.
create index if not exists quote_lines_quote_id_idx on quote_lines (quote_id);
create index if not exists quote_lines_cost_node_id_idx on quote_lines (cost_node_id);
-- quotes(model_id) index already exists from 0001_init_schema.sql.
