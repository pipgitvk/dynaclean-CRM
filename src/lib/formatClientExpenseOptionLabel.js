/** Short line for lists: id, expense name, client — no head/sub (Statements picker). */
export function formatClientExpenseShort(e) {
  if (!e) return "";
  const txn = e.transaction_id ? ` · Txn:${String(e.transaction_id).trim()}` : "";
  return `${e.id} — ${e.expense_name || ""} (${e.client_name || ""}${txn})`;
}

/**
 * Label for Expense ID dropdowns (Statements, etc.): id, names, txn, head, sub-heads.
 */
export function formatClientExpenseOptionLabel(e) {
  if (!e) return "";
  const txn = e.transaction_id ? ` · Txn: ${e.transaction_id}` : "";
  const head = e.head != null && String(e.head).trim() !== "" ? String(e.head).trim() : "";
  let subStr = "";
  if (Array.isArray(e.sub_heads)) {
    subStr = e.sub_heads.map((s) => String(s || "").trim()).filter(Boolean).join(", ");
  } else if (e.sub_heads_joined != null && String(e.sub_heads_joined).trim() !== "") {
    subStr = String(e.sub_heads_joined).trim();
  }
  const base = `${e.id} — ${e.expense_name || ""} (${e.client_name || ""}${txn})`;
  const bits = [base];
  if (head) bits.push(`Head: ${head}`);
  if (subStr) bits.push(`Sub: ${subStr}`);
  return bits.join(" · ");
}
