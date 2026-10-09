import PatStatementView from "@/components/admin/PatStatementView";

export const dynamic = "force-dynamic";

export default function AdminPatPage() {
  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PatStatementView />
      </div>
    </div>
  );
}
