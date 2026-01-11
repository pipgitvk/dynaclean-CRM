import { getDbConnection } from "@/lib/db";
import CustomerTable from "../CustomerTable";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }) {
  const conn = await getDbConnection();

  const [rows] = await conn.execute("SELECT * FROM demoregistration ");

  // await conn.end();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
          All Demo Records
        </h1>
        <a href="/admin-dashboard/demo_details" passHref>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600 transition">
            Back
          </button>
        </a>
      </div>
      <CustomerTable rows={rows} searchParams={searchParams} />
    </div>
  );
}
