import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy sidebar path → canonical leads-manage route. */
export default function BulkReassignPage() {
  redirect("/sales-dashboard/leads-manage/bulk-reassign");
}