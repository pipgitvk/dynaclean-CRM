import AddCustomerForm from "./AddCustomerForm";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AddCustomerPage() {
  // no initial fetch needed—this is a blank form
  return (
    <div className="max-w-7xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-10 text-gray-700">
      <h1 className="text-3xl font-bold mb-6 text-center">Add New Customer</h1>
      <AddCustomerForm />
    </div>
  );
}
