-- Add UNIQUE constraint on trans_id
ALTER TABLE statements ADD UNIQUE KEY unique_trans_id (trans_id);
