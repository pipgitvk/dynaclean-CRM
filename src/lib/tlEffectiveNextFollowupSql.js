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
