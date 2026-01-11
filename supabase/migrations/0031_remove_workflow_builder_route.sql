-- =============================================================================
-- Remove legacy workflowBuilder flag from AI routes settings
-- =============================================================================

UPDATE public.settings
SET value = (value::jsonb - 'workflowBuilder')::text
WHERE key = 'ai_routes'
  AND value IS NOT NULL;

-- Reload PostgREST schema (safe)
NOTIFY pgrst, 'reload schema';
