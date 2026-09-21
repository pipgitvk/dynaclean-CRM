-- Merged bulk lines store multiple models in one row; TEXT avoids VARCHAR(255) truncation.
ALTER TABLE prospects MODIFY COLUMN model TEXT NOT NULL;
