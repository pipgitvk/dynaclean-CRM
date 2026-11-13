/** Last note for TL customer search — TL_followups only (not employee follow-ups). */
export function pickLatestNoteForSearch(row) {
  const tlNote = String(row.tl_notes ?? "").trim();
  const tlWhen = row.tl_followed_date || row.tl_created_at || null;
  return { last_note: tlNote, last_note_at: tlWhen };
}
