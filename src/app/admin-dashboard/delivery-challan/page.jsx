import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import DeliveryChallanTable from "./DeliveryChallanTable";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function DeliveryChallanPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  let username = "";
  let role = "";
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    username = payload.username;
    role = payload.role;
  } catch (err) {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  const conn = await getDbConnection();

  // Create tables if they don't exist
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS delivery_challans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      delivery_challan_for VARCHAR(255),
      ship_to VARCHAR(255),
      transportation_details TEXT,
      delivery_date DATE,
      delivery_location VARCHAR(255),
      challan_no VARCHAR(255),
      challan_date DATE,
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS delivery_challan_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      delivery_challan_id INT,
      product_code VARCHAR(255),
      product_name VARCHAR(255),
      product_hsn VARCHAR(255),
      product_specification TEXT,
      product_unit VARCHAR(255),
      product_price DECIMAL(10,2),
      product_quantity INT DEFAULT 1,
      product_image VARCHAR(255),
      FOREIGN KEY (delivery_challan_id) REFERENCES delivery_challans(id) ON DELETE CASCADE
    )
  `);

  // Fetch all delivery challans with their items
  const [rows] = await conn.execute(`
    SELECT dc.*, 
           GROUP_CONCAT(CONCAT(dci.product_code, '|', dci.product_name, '|', dci.product_quantity) SEPARATOR ';;') as products_info
    FROM delivery_challans dc
    LEFT JOIN delivery_challan_items dci ON dc.id = dci.delivery_challan_id
    GROUP BY dc.id
    ORDER BY dc.created_at DESC
  `);

  // Parse products_info for each row
  const parsedRows = rows.map(row => {
    let products = [];
    if (row.products_info) {
      products = row.products_info.split(';;').map(p => {
        const [code, name, qty] = p.split('|');
        return { code, name, qty };
      });
    }
    return { ...row, products };
  });

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Delivery Challan</h1>
        <a
          href="/admin-dashboard/delivery-challan/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
        >
          Add Delivery Challan
        </a>
      </div>
      <DeliveryChallanTable rows={parsedRows} />
    </div>
  );
}
