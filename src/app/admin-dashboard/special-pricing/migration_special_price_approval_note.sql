-- Run once on the DB: stores admin note when approving or rejecting a special price.
ALTER TABLE special_price ADD COLUMN approval_note TEXT NULL;
