-- Optional: map client expense to bank/statement transaction reference
ALTER TABLE client_expenses ADD COLUMN transaction_id VARCHAR(255) NULL AFTER hsn;
