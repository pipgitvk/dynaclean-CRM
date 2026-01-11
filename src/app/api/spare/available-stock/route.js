import { getDbConnection } from "@/lib/db";

export async function GET() {
    const conn = await getDbConnection();

    try {
        // const [rows] = await conn.execute(`
        // SELECT
        //     ss.spare_id,
        //     spl.spare_number,
        //     spl.item_name as spare_name,
        //     spl.image as spare_image,
        //     ss.total_quantity as total,
        //     ss.Delhi as delhi,
        //     ss.South as south,
        //     ss.updated_at,
        //     sl.location
        // FROM stock_summary ss
        // LEFT JOIN spare_list spl ON ss.spare_id = spl.id
        // LEFT JOIN (
        //     SELECT spare_id, location
        //     FROM stock_list
        //     WHERE (spare_id, created_at) IN (
        //         SELECT spare_id, MAX(created_at)
        //         FROM stock_list
        //         GROUP BY spare_id
        //     )
        // ) sl ON ss.spare_id = sl.spare_id
        // ORDER BY ss.updated_at DESC
        // `);

        const [rows] = await conn.execute(`
    SELECT
        ss.spare_id,
        spl.spare_number,
        spl.item_name AS spare_name,
        spl.image AS spare_image,
        ss.total_quantity AS total,
        ss.Delhi AS delhi,
        ss.South AS south,
        ss.updated_at,
        sl.location
    FROM stock_summary ss
    LEFT JOIN spare_list spl 
        ON ss.spare_id = spl.id
    LEFT JOIN stock_list sl 
        ON sl.id = (
            SELECT id 
            FROM stock_list 
            WHERE spare_id = ss.spare_id 
              AND stock_status = 'in'
            ORDER BY created_at DESC
            LIMIT 1
        )
    ORDER BY ss.updated_at DESC
`);

        console.log("Available spare stock data fetched successfully:", rows.length, "records found");

        return Response.json(rows);
    } catch (error) {
        console.error("Database error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch available stock data." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
