-- ============================================================
-- Remove auto-inserted TL_followups rows that came from
-- Facebook/Meta lead import. These should never have been
-- inserted — TL_followups is ONLY for manual TL follow-ups.
-- ============================================================

-- Step 1: Preview how many rows will be deleted (run this first)
SELECT id, customer_id, followed_by, notes, followed_date
FROM TL_followups
WHERE notes IN (
    'Lead from Facebook ad (multi-credential)',
    'Lead from Facebook ad'
);

-- Step 2: Delete those rows (run after confirming above)
DELETE FROM TL_followups
WHERE notes IN (
    'Lead from Facebook ad (multi-credential)',
    'Lead from Facebook ad'
);
