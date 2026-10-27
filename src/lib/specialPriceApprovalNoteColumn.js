/**
 * DB may not have `special_price.approval_note` until migration is applied.
 * Use this to fall back to queries/updates without that column.
 */
export function isUnknownApprovalNoteColumnError(err) {
  if (!err) return false;
  if (err.code === "ER_BAD_FIELD_ERROR" || err.errno === 1054) {
    const msg = String(err.message || "");
    return msg.includes("approval_note");
  }
  return false;
}
