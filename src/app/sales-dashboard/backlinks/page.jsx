import BacklinksTable from "@/components/backlinks/BacklinksTable";

export default function AdminBacklinksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <BacklinksTable />
      </div>
    </div>
  );
}
