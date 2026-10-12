import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  const token = req.cookies.get("token")?.value;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return NextResponse.json({ products: [], total: 0, totalPages: 0 }, { status: 401 });
  }

  // Get pagination & filter parameters from URL
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const modelFilter = searchParams.get("model") || "";
  const stateFilter = searchParams.get("state") || "";

  const offset = (page - 1) * limit;

  const pool = await getDbConnection();

  try {
    // Build WHERE conditions and params
    const conditions = [];
    const params = [];

    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(`(
        wp.product_name LIKE ? OR 
        wp.specification LIKE ? OR 
        wp.model LIKE ? OR 
        wp.serial_number LIKE ? OR 
        wp.customer_name LIKE ? OR 
        wp.email LIKE ? OR 
        wp.contact_person LIKE ? OR 
        wp.contact LIKE ? OR 
        wp.invoice_number LIKE ? OR 
        wp.installed_address LIKE ?
      )`);
      params.push(...Array(10).fill(searchTerm));
    }

    if (modelFilter) {
      conditions.push(`wp.model LIKE ?`);
      params.push(`%${modelFilter}%`);
    }

    if (stateFilter) {
      conditions.push(`wp.state LIKE ?`);
      params.push(`%${stateFilter}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count (distinct warranty products matching filters)
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM warranty_products wp
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get paginated data (state comes directly from warranty_products)
    const [rows] = await pool.execute(
      `SELECT *
       FROM warranty_products wp
       ${whereClause}
       ORDER BY wp.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Check AMC status and get AMC details for each product
    const productsWithAMC = await Promise.all(
      rows.map(async (product) => {
        try {
          const [amcRecords] = await pool.execute(
            `SELECT amc_start_datetime, amc_end_datetime, contact, model, company_name 
             FROM amc_cmc 
             WHERE serial_number = ? 
             ORDER BY amc_end_datetime DESC 
             LIMIT 1`,
            [product.serial_number]
          );
          
          if (amcRecords && amcRecords.length > 0) {
            const amc = amcRecords[0];
            return {
              ...product,
              has_amc: true,
              amc_details: {
                start_date: amc.amc_start_datetime,
                end_date: amc.amc_end_datetime,
                contact: amc.contact,
                model: amc.model,
                company_name: amc.company_name
              }
            };
          }
          
          return {
            ...product,
            has_amc: false,
            amc_details: null
          };
        } catch (error) {
          console.error(`Error checking AMC for ${product.serial_number}:`, error);
          return {
            ...product,
            has_amc: false,
            amc_details: null
          };
        }
      })
    );

    return NextResponse.json({ 
      products: productsWithAMC, 
      total, 
      totalPages,
      currentPage: page,
      pageSize: limit
    });
  } catch (error) {
    console.error("Error fetching warranty products:", error);
    return NextResponse.json({ products: [], total: 0, totalPages: 0, error: "Failed to fetch products" }, { status: 500 });
  }
}
