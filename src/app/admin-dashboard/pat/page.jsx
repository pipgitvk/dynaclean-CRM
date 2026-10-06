import Link from "next/link";
import PatStatementView from "@/components/admin/PatStatementView";

export const dynamic = "force-dynamic";

export default function AdminPatPage() {
  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 md:p-8">
      <Link
        href="/admin-dashboard"
        className="mb-4 inline-flex text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
      >
        ← Back to dashboard
      </Link>
      <PatStatementView />
    </div>
  );
}
