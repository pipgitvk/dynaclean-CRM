import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BulkReassignPage() {
  redirect("/admin-dashboard/leads-manage/bulk-reassign");
}