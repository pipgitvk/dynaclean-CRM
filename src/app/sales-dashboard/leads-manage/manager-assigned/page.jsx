import { redirect } from "next/navigation";

export default function Page() {
  redirect("/sales-dashboard/leads-manage/manually-assigned");
}