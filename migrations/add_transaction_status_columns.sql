-- Add columns to track failed and cancelled transactions
ALTER TABLE statements ADD COLUMN failed_transaction_id INT UNSIGNED NULL AFTER linked_module_id;
ALTER TABLE statements ADD COLUMN cancelled_transaction_id INT UNSIGNED NULL AFTER failed_transaction_id;

-- Add indexes for better query performance
CREATE INDEX idx_failed_transaction_id ON statements(failed_transaction_id);
CREATE INDEX idx_cancelled_transaction_id ON statements(cancelled_transaction_id);
