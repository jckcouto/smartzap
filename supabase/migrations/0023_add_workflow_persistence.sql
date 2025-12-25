-- Workflow persistence core tables
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  owner_company_id TEXT,
  active_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

ALTER TABLE workflows
  ADD CONSTRAINT workflows_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES workflow_versions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_versions_workflow_version_idx
  ON workflow_versions (workflow_id, version);

CREATE INDEX IF NOT EXISTS workflow_versions_workflow_id_idx
  ON workflow_versions (workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES workflow_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',
  trigger_type TEXT,
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS workflow_runs_workflow_id_idx
  ON workflow_runs (workflow_id, started_at DESC);

CREATE INDEX IF NOT EXISTS workflow_runs_version_id_idx
  ON workflow_runs (version_id, started_at DESC);

CREATE TABLE IF NOT EXISTS workflow_run_logs (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_name TEXT,
  node_type TEXT,
  status TEXT NOT NULL,
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS workflow_run_logs_run_id_idx
  ON workflow_run_logs (run_id, started_at DESC);
