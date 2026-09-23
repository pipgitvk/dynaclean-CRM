-- Follow-up remarks were truncated at ~255 chars (VARCHAR). Use TEXT for full notes.
ALTER TABLE customers_followup
  MODIFY COLUMN notes TEXT NULL;
