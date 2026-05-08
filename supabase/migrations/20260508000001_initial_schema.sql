-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE templates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id  text NOT NULL,
    version      text NOT NULL,
    name         text NOT NULL,
    description  text,
    yaml_content text NOT NULL,
    created_at   timestamptz DEFAULT now(),
    UNIQUE (template_id, version)
);

CREATE TABLE reports (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id      uuid NOT NULL REFERENCES templates(id),
    template_version text NOT NULL,
    status           text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'generating', 'review', 'approved', 'exported')),
    intake_data      jsonb DEFAULT '{}',
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

CREATE TABLE report_fields (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id  uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    field_id   text NOT NULL,
    section_id text NOT NULL,
    strategy   text NOT NULL,
    status     text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'generating', 'draft', 'edited', 'approved', 'failed')),
    value      text,
    metadata   jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (report_id, field_id)
);

CREATE TABLE audit_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    field_id        text NOT NULL,
    event_type      text NOT NULL
        CHECK (event_type IN ('generated', 'regenerated', 'edited', 'approved', 'failed')),
    strategy        text,
    inputs_snapshot jsonb DEFAULT '{}',
    output_value    text,
    model           text,
    created_at      timestamptz DEFAULT now()
    -- No updated_at — append-only by design (AD-005)
);

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX reports_user_id_idx      ON reports(user_id);
CREATE INDEX report_fields_report_idx ON report_fields(report_id);
CREATE INDEX audit_log_report_idx     ON audit_log(report_id);
CREATE INDEX audit_log_created_at_idx ON audit_log(created_at);

-- ── updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER report_fields_updated_at
    BEFORE UPDATE ON report_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────

ALTER TABLE templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;

-- templates: globally readable; no user writes (seeded by backend service key)
CREATE POLICY "templates_public_read"
    ON templates FOR SELECT USING (true);

-- reports: user sees only their own
CREATE POLICY "reports_select" ON reports FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "reports_insert" ON reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports_update" ON reports FOR UPDATE
    USING (auth.uid() = user_id);

-- report_fields: scoped through parent report ownership
CREATE POLICY "report_fields_select" ON report_fields FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM reports
        WHERE reports.id = report_id AND reports.user_id = auth.uid()
    ));
CREATE POLICY "report_fields_insert" ON report_fields FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM reports
        WHERE reports.id = report_id AND reports.user_id = auth.uid()
    ));
CREATE POLICY "report_fields_update" ON report_fields FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM reports
        WHERE reports.id = report_id AND reports.user_id = auth.uid()
    ));

-- audit_log: users can read their own; no anon INSERT (service key only — enforces append-only)
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM reports
        WHERE reports.id = report_id AND reports.user_id = auth.uid()
    ));
