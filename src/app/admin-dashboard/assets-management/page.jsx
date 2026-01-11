import AssetTypeCard from "@/components/models/AssetTypeCard";
import CreateAssetTypeModal from "@/components/models/CreateAssetTypeModal";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssetsManagementPage() {
  const conn = await getDbConnection();
  const [types] = await conn.execute(`SELECT DISTINCT type FROM assets`);
  // await conn.end();

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Assets Management</h1>
        <CreateAssetTypeModal />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(({ type }) => (
          <AssetTypeCard key={type} type={type} />
        ))}
      </div>
    </div>
  );
}
