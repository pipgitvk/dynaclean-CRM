-- Add transaction posted date column
ALTER TABLE statements ADD COLUMN txn_posted_date DATE NULL AFTER txn_dated_deb;
