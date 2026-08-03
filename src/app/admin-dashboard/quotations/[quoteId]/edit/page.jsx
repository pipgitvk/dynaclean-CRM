import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import QuotationEditForm from "./QuotationEditForm";

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({ params }) {
  const { quoteId } = await params;

  // Superadmin-only access
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(process.env.JWT_SECRET),
  );

  if (payload.role !== "SUPERADMIN") {
    redirect("/admin-dashboard/quotations");
  }

  return (
    <div className="max-w-screen-xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <QuotationEditForm quoteId={quoteId} />
    </div>
  );
}
