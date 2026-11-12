/** Pick the newest note + timestamp for TL customer search suggestions. */
export function pickLatestNoteForSearch(row) {
  const tlNote = String(row.tl_notes ?? "").trim();
  const cfNote = String(row.cf_notes ?? "").trim();

  const tlWhen = row.tl_followed_date || row.tl_created_at || null;
  const cfWhen = row.cf_followed_date || row.cf_time_stamp || null;

  const tlMs = tlWhen ? Date.parse(tlWhen) : 0;
  const cfMs = cfWhen ? Date.parse(cfWhen) : 0;

  if (tlNote && !cfNote) {
    return { last_note: tlNote, last_note_at: tlWhen };
  }
  if (!tlNote && cfNote) {
    return { last_note: cfNote, last_note_at: cfWhen };
  }
  if (tlNote && cfNote) {
    if (tlMs >= cfMs) {
      return { last_note: tlNote, last_note_at: tlWhen };
    }
    return { last_note: cfNote, last_note_at: cfWhen };
  }
  return { last_note: "", last_note_at: null };
}
