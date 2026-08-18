-- Store Notes field language code per follow-up (e.g. en, kn, hi)
ALTER TABLE customers_followup
  ADD COLUMN notes_language VARCHAR(10) NOT NULL DEFAULT 'en' AFTER notes;
