import { redirect } from "next/navigation";

export default function Page() {
  redirect("/user-dashboard/leads-manage/manually-assigned");
}