import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";
import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";

const WARRANTY_SEARCH_FIELDS = [
  "wp.product_name",
  "wp.specification",
  "wp.model",
  "wp.serial_number",
  "wp.customer_name",
  "wp.email",
  "wp.contact_person",
  "wp.contact",
  "wp.invoice_number",
  "wp.installed_address",
  "wp.state",
];

/** All searchable text as one blob (addresses with punctuation/spaces). */
const WARRANTY_SEARCH_BLOB = `CONCAT_WS(' ',
  COALESCE(wp.product_name, ''),
  COALESCE(wp.specification, ''),
  COALESCE(wp.model, ''),
  COALESCE(wp.serial_number, ''),
  COALESCE(wp.customer_name, ''),
  COALESCE(wp.email, ''),
  COALESCE(wp.contact_person, ''),
  COALESCE(wp.contact, ''),
  COALESCE(wp.invoice_number, ''),
  COALESCE(wp.installed_address, ''),
  COALESCE(wp.state, '')
)`;

/** Strip spaces / common separators so "AB 12" matches "AB12". */
function sqlCompact(columnExpr) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${columnExpr}, ''), ' ', ''), '-', ''), '/', ''), '_', '')`;
}

function normalizeWarrantySearchTokens(search) {
  return String(search || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * Flexible warranty search (placeholder fields + address):
 * - phrase match
 * - space-insensitive identifiers
 * - multi-word / address: enough significant tokens must match (not every token)
 */
function buildWarrantyProductsSearchClause(search) {
  const raw = String(search || "").trim().replace(/\s+/g, " ");
  if (!raw) return { sql: "", params: [] };

  const tokens = normalizeWarrantySearchTokens(raw);
  const significant = tokens.filter((t) => t.length >= 3);
  const noSpace = raw.replace(/\s+/g, "").replace(/[-/_]/g, "");
  const groups = [];
  const params = [];

  // 1) Full phrase
  groups.push(
    `(${WARRANTY_SEARCH_FIELDS.map((f) => `${f} LIKE ?`).join(" OR ")})`,
  );
  params.push(...WARRANTY_SEARCH_FIELDS.map(() => `%${raw}%`));

  // 2) Compact / space-insensitive ("AB 12" → "AB12")
  if (noSpace.length >= 3) {
    const compactCols = [
      "wp.serial_number",
      "wp.invoice_number",
      "wp.model",
      "wp.product_name",
      "wp.customer_name",
      "wp.contact_person",
      "wp.contact",
      "wp.specification",
      "wp.installed_address",
    ];
    groups.push(
      `(${compactCols.map((f) => `${sqlCompact(f)} LIKE ?`).join(" OR ")})`,
    );
    params.push(...compactCols.map(() => `%${noSpace}%`));
  }

  // 3) Short query (1–2 tokens): any token hits any field
  if (tokens.length > 0 && tokens.length <= 2) {
    for (const token of tokens) {
      groups.push(`(${WARRANTY_SEARCH_BLOB} LIKE ?)`);
      params.push(`%${token}%`);
    }
  }

  // 4) Long / address query: enough significant tokens must match (not every word).
  // "ASC Center South No-04 gate agram post, Bangalore Karnataka -560007" still hits.
  if (significant.length >= 2) {
    // ~1/3 of words is enough — addresses rarely match every token exactly.
    const minScore = Math.max(
      2,
      Math.min(3, Math.ceil(significant.length * 0.3)),
    );
    const scoreExpr = significant
      .map((token) => {
        params.push(`%${token}%`);
        return `(CASE WHEN ${WARRANTY_SEARCH_BLOB} LIKE ? THEN 1 ELSE 0 END)`;
      })
      .join(" + ");
    groups.push(`((${scoreExpr}) >= ${minScore})`);
  }

  return {
    sql: `(${groups.join(" OR ")})`,
    params,
  };
}

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
  const geoTagFilter =
    searchParams.get("geoTag") || searchParams.get("geo_tag") || "";
  const warrantyFilter =
    searchParams.get("warranty") ||
    searchParams.get("warrantyFilter") ||
    "";
  const serialFilter =
    searchParams.get("serial") ||
    searchParams.get("serialFilter") ||
    "";

  const offset = (page - 1) * limit;

  const pool = await getDbConnection();

  try {
    // Build WHERE conditions and params
    const conditions = [];
    const params = [];

    if (String(search || "").trim()) {
      const searchClause = buildWarrantyProductsSearchClause(search);
      if (searchClause.sql) {
        conditions.push(searchClause.sql);
        params.push(...searchClause.params);
      }
    }

    if (modelFilter) {
      conditions.push(`wp.model LIKE ?`);
      params.push(`%${modelFilter}%`);
    }

    if (stateFilter) {
      conditions.push(`wp.state LIKE ?`);
      params.push(`%${stateFilter}%`);
    }

    const geoTaggedSql = `(
      wp.lat IS NOT NULL
      AND wp.longt IS NOT NULL
      AND TRIM(CAST(wp.lat AS CHAR)) <> ''
      AND TRIM(CAST(wp.longt AS CHAR)) <> ''
      AND TRIM(CAST(wp.lat AS CHAR)) NOT IN ('0', '0.0', '0.000000')
      AND TRIM(CAST(wp.longt AS CHAR)) NOT IN ('0', '0.0', '0.000000')
    )`;

    if (geoTagFilter === "with") {
      conditions.push(geoTaggedSql);
    } else if (geoTagFilter === "without") {
      conditions.push(`NOT ${geoTaggedSql}`);
    }

    const inWarrantySql = `(
      wp.warranty_period IS NOT NULL
      AND TRIM(CAST(wp.warranty_period AS CHAR)) <> ''
      AND (
        (wp.installation_date IS NOT NULL AND TRIM(CAST(wp.installation_date AS CHAR)) NOT IN ('', '0000-00-00'))
        OR (wp.invoice_date IS NOT NULL AND TRIM(CAST(wp.invoice_date AS CHAR)) NOT IN ('', '0000-00-00'))
      )
      AND DATE_ADD(
        DATE(
          COALESCE(
            NULLIF(TRIM(CAST(wp.installation_date AS CHAR)), ''),
            NULLIF(TRIM(CAST(wp.invoice_date AS CHAR)), '')
          )
        ),
        INTERVAL CAST(wp.warranty_period AS UNSIGNED) MONTH
      ) >= CURDATE()
    )`;

    if (warrantyFilter === "in-warranty" || warrantyFilter === "in") {
      conditions.push(inWarrantySql);
    } else if (
      warrantyFilter === "out-of-warranty" ||
      warrantyFilter === "out"
    ) {
      conditions.push(`NOT ${inWarrantySql}`);
    }

    const missingSerialSql = `(wp.serial_number IS NULL OR TRIM(wp.serial_number) = '')`;
    const withSerialSql = `(wp.serial_number IS NOT NULL AND TRIM(wp.serial_number) <> '')`;

    if (serialFilter === "without" || serialFilter === "missing") {
      conditions.push(missingSerialSql);
    } else if (serialFilter === "with") {
      conditions.push(withSerialSql);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [serialStatsRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN ${missingSerialSql} THEN 1 ELSE 0 END) AS missing_serial,
         SUM(CASE WHEN ${withSerialSql} THEN 1 ELSE 0 END) AS with_serial
       FROM warranty_products wp`,
    );
    const serialStats = {
      total: Number(serialStatsRows[0]?.total) || 0,
      missingSerial: Number(serialStatsRows[0]?.missing_serial) || 0,
      withSerial: Number(serialStatsRows[0]?.with_serial) || 0,
    };

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
      `SELECT wp.*,
         (
           SELECT sr.service_id
           FROM service_records sr
           WHERE ${sqlTrimUtf8EqColumns("sr.serial_number", "wp.serial_number")}
             AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
           ORDER BY sr.service_id DESC
           LIMIT 1
         ) AS installation_service_id
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
      pageSize: limit,
      serialStats,
    });
  } catch (error) {
    console.error("Error fetching warranty products:", error);
    return NextResponse.json({ products: [], total: 0, totalPages: 0, error: "Failed to fetch products" }, { status: 500 });
  }
}
