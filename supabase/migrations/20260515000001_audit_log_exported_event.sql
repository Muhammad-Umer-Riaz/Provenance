-- Add 'exported' to the audit_log event_type check constraint.
-- The export route appends an _export sentinel row; the original migration omitted this event type.
ALTER TABLE audit_log DROP CONSTRAINT audit_log_event_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_event_type_check
    CHECK (event_type IN ('generated', 'regenerated', 'edited', 'approved', 'failed', 'exported'));
