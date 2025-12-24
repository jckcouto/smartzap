-- Workflow Builder Executions
CREATE TABLE IF NOT EXISTS workflow_builder_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS workflow_builder_executions_workflow_id_idx
  ON workflow_builder_executions (workflow_id, started_at DESC);

-- Workflow Builder Logs (per node)
CREATE TABLE IF NOT EXISTS workflow_builder_logs (
  id BIGSERIAL PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES workflow_builder_executions(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS workflow_builder_logs_execution_id_idx
  ON workflow_builder_logs (execution_id, started_at DESC);
