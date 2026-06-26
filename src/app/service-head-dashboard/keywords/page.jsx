import UserKeywordsTable from "@/components/keywords/UserKeywordsTable";

export default function ServiceHeadKeywordsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <UserKeywordsTable />
      </div>
    </div>
  );
}
