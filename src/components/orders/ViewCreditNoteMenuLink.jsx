import Link from "next/link";
import { FileText } from "lucide-react";
import { canViewOrderCreditNoteRole } from "@/lib/roleKeyUtils";

/** Saved credit note on order (return initiated, fully returned, return completed, etc.). */
export function orderHasViewableCreditNote(order) {
  const cnId = order?.credit_note_id;
  return cnId != null && cnId !== "" && String(cnId) !== "0";
}

export default function ViewCreditNoteMenuLink({
  order,
  userRole,
  hrefBase = "/admin-dashboard",
  linkClassName = "flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-teal-700",
  wrapperClassName = "border-t border-gray-100 mt-1 pt-1",
  onClick,
}) {
  if (!canViewOrderCreditNoteRole(userRole)) return null;
  if (!orderHasViewableCreditNote(order)) return null;

  return (
    <div className={wrapperClassName} onClick={onClick}>
      <Link
        href={`${hrefBase}/credit-notes/${order.credit_note_id}`}
        className={linkClassName}
        title="View Credit Note"
        onClick={onClick}
      >
        <FileText size={16} />
        <span>View Credit Note</span>
      </Link>
    </div>
  );
}
