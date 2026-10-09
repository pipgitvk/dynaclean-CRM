import { redirect } from "next/navigation";

export default function CatchAll({ params }) {
  const { slug } = params;
  
  // Redirect all non-dashboard pages to user-dashboard
  // Director gets only the dashboard home page
  const path = slug?.join("/") || "";
  
  redirect(`/user-dashboard/${path}`);
}
