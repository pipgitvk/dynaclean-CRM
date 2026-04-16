/**
 * MySQL scalar expression aligned with {@link pickEffectiveNextFollowup} in
 * `src/utils/tlNextFollowupResolve.js`.
 * Requires joined aliases `tlf` (latest TL_followups) and `cf` (latest customers_followup).
 */
export const SQL_EFFECTIVE_NEXT_FOLLOWUP = `(
  CASE
    WHEN tlf.next_followup_date IS NULL AND cf.next_followup_date IS NULL THEN NULL
    WHEN tlf.next_followup_date IS NULL THEN cf.next_followup_date
    WHEN cf.next_followup_date IS NULL THEN tlf.next_followup_date
    WHEN tlf.next_followup_date >= NOW() AND cf.next_followup_date >= NOW()
      THEN LEAST(tlf.next_followup_date, cf.next_followup_date)
    WHEN tlf.next_followup_date >= NOW() THEN tlf.next_followup_date
    WHEN cf.next_followup_date >= NOW() THEN cf.next_followup_date
    ELSE GREATEST(tlf.next_followup_date, cf.next_followup_date)
  END
)`;

/**
 * Aligned with {@link pickLatestChronologicalNextFollowup} — the later of TL vs regular
 * next follow-up. Use for next-followup date filters when TL list mode is ON (matches the
 * NEXT FOLLOWUP column when `tlOnly` is true).
 */
export const SQL_LATEST_CHRONOLOGICAL_NEXT_FOLLOWUP = `(
  CASE
    WHEN tlf.next_followup_date IS NULL AND cf.next_followup_date IS NULL THEN NULL
    WHEN tlf.next_followup_date IS NULL THEN cf.next_followup_date
    WHEN cf.next_followup_date IS NULL THEN tlf.next_followup_date
    ELSE GREATEST(tlf.next_followup_date, cf.next_followup_date)
  END
)`;
