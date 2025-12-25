ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS schedule_cron TEXT,
  ADD COLUMN IF NOT EXISTS schedule_timezone TEXT,
  ADD COLUMN IF NOT EXISTS schedule_qstash_message_id TEXT,
  ADD COLUMN IF NOT EXISTS schedule_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_updated_at TIMESTAMPTZ;
