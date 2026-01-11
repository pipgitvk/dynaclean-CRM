import { getSessionPayload } from "@/lib/auth";
import BulkReassignTable from "./BulkReassignTable";

export const dynamic = "force-dynamic";

export default async function BulkReassignPage() {
    const payload = await getSessionPayload();

    if (!payload) {
        return null;
    }

    // Only allow admin roles to access this page
    if (!["ADMIN", "SUPERADMIN"].includes(payload.role)) {
        return (
            <div className="min-h-screen bg-gray-100 p-8">
                <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
                    <p className="text-gray-700">
                        You do not have permission to access this page. Only administrators can perform bulk lead reassignment.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Bulk Lead Reassignment</h1>
                    <p className="text-gray-600 mt-2">
                        Filter and select multiple leads to reassign them to a different employee
                    </p>
                </div>

                <BulkReassignTable />
            </div>
        </div>
    );
}
