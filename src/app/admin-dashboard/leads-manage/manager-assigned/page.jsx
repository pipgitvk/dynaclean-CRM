import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin-dashboard/leads-manage/manually-assigned");
}