ALTER TABLE uipath_generation_runs ADD COLUMN IF NOT EXISTS pdd_document_id INTEGER;
ALTER TABLE uipath_generation_runs ADD COLUMN IF NOT EXISTS sdd_document_id INTEGER;
ALTER TABLE uipath_generation_runs ADD COLUMN IF NOT EXISTS quality_gate_results JSONB;
ALTER TABLE uipath_generation_runs ADD COLUMN IF NOT EXISTS meta_validation_results JSONB;
ALTER TABLE uipath_generation_runs ADD COLUMN IF NOT EXISTS final_quality_report JSONB;
