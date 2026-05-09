ALTER TABLE reports
  ADD COLUMN score float4,
  ADD COLUMN verdict text,
  ADD COLUMN validation_warnings jsonb DEFAULT '[]';

-- Required for Supabase Realtime Postgres Changes to send full row data on UPDATE
ALTER TABLE report_fields REPLICA IDENTITY FULL;
ALTER TABLE reports REPLICA IDENTITY FULL;
