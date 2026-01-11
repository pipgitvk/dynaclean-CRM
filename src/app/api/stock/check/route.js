
// import { getDbConnection } from "@/lib/db";

// export async function POST(req) {
//   try {
//     console.log("Received request:", req);  // Log request data

//     const { quote_number, godown } = await req.json();

//     if (!quote_number || !godown) {
//       console.log("Missing parameters:", { quote_number, godown });  // Log missing parameters
//       return new Response(JSON.stringify({ error: "Quote number and godown are required" }), { status: 400 });
//     }

//     const conn = await getDbConnection();
//     console.log("Database connection established");  // Log DB connection success

//     // Step 1: Get item_code from the quotation_items table
//     console.log("Querying quotation_items table for quote_number:", quote_number);
//     const [quotationItems] = await conn.execute(
//       "SELECT item_code FROM quotation_items WHERE quote_number = ?",
//       [quote_number]
//     );

//     if (quotationItems.length === 0) {
//       console.log("No items found for quote_number:", quote_number);  // Log if no items found
//           // await conn.end();
//       return new Response(JSON.stringify({ error: "No items found for this quote number" }), { status: 404 });
//     }

//     const locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";
//     console.log("Determined location column:", locationColumn);  // Log determined location

//     let stockResults = [];  // Array to store results for all item_codes

//     // Iterate over all quotation items
//     for (const item of quotationItems) {
//       const item_code = item.item_code;

//       console.log("Processing item_code:", item_code);

//       // Check if item_code contains alphabets
//       const containsAlphabets = /[a-zA-Z]/.test(item_code);
//       let stock_count = null;

//       if (containsAlphabets) {
//         console.log("Found product_stock for quote_number:", quote_number);  // Log if product_stock exists
//         // Case 1: Use product_stock_summary
//         console.log("Querying product_stock_summary for item_code:", item_code);
//         const query = `SELECT ${locationColumn} AS stock_count FROM product_stock_summary WHERE product_code = ?`;
//          const checkQuery = "SELECT  min_qty FROM products_list WHERE item_code = ?";

//         try {
//           const [summary] = await conn.execute(query, [item_code]);
//           const [newsum] = await conn.execute(checkQuery, [item_code]);

//           if (summary.length > 0) {
//             stock_count = summary[0].stock_count;
//             console.log("Found stock_count in product_stock_summary:", stock_count);  // Log stock_count
//             // Push the stock count with item_code (as it is) for Case 1
//             stockResults.push({ item_code, stock_count });
//           } else {
//             console.log("No stock_count found in product_stock_summary for item_code:", item_code);  // Log if no stock found
//             // Push the stock count as 0 if no stock found for Case 1
//             stockResults.push({ item_code, stock_count: 0 });
//           }
//         } catch (error) {
//           console.error("Error querying product_stock_summary:", error);
//         }
//       } else {
//         console.log("No product_stock found for quote_number:", quote_number);  // Log if no product_stock
//         // Case 2: Use stock_summary
//         console.log("Querying stock_summary for item_code:", item_code);
//         const query = `SELECT ${locationColumn} AS stock_count FROM stock_summary WHERE spare_id = ?`;

//         try {
//           const [summary] = await conn.execute(query, [item_code]);

//           if (summary.length > 0) {
//             stock_count = summary[0].stock_count;
//             console.log("Found stock_count in stock_summary:", stock_count);  // Log stock_count

//             // Fetch the item name from spare_list for this item_code
//             const nameQuery = "SELECT item_name, min_qty FROM spare_list WHERE id = ?";
//             const [nameResult] = await conn.execute(nameQuery, [item_code]);

//             if (nameResult.length > 0) {
//               const item_name = nameResult[0].item_name;
//               const min_qty = nameAndQtyResult[0].min_qty;
//               console.log("Found item_name in spare_list:", item_name);  // Log item_name

//               // Push the stock count along with the item_name (not item_code) in the response for Case 2
//               stockResults.push({ item_code: item_name, stock_count });
//             } else {
//               console.log("No item_name found in spare_list for item_code:", item_code);
//               // If no item_name, push item_code and stock_count as is
//               stockResults.push({ item_code, stock_count: 0 });
//             }
//           } else {
//             console.log("No stock_count found in stock_summary for item_code:", item_code);  // Log if no stock found
//             // If no stock found, push 0 stock count and item_code
//             stockResults.push({ item_code, stock_count: 0 });
//           }
//         } catch (error) {
//           console.error("Error querying stock_summary:", error);
//         }
//       }
//     }

     
//     console.log("Database connection closed");  // Log DB connection closure

//     if (stockResults.length > 0) {
//       console.log("Returning stock counts:", stockResults);  // Log returning stock counts
//       return new Response(JSON.stringify({ stockResults }), { status: 200 });
//     } else {
//       console.log("Returning 0 stock_count with message");  // Log returning 0 stock count
//       return new Response(JSON.stringify({ stock_count: 0, message: "No stock found for this item." }), { status: 200 });
//     }
//   } catch (error) {
//     console.error("API error:", error);  // Log any error that occurs
//     return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
//   }
// }




// /api/stock/check/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from 'next/server';

export async function POST(req) {
    let conn;
    try {
        const { quote_number, godown } = await req.json();

        if (!quote_number || !godown) {
            return NextResponse.json({ error: "Quote number and godown are required" }, { status: 400 });
        }

        conn = await getDbConnection();

        // Step 1: Get item_code from the quotation_items table
        const [quotationItems] = await conn.execute(
            "SELECT item_code FROM quotation_items WHERE quote_number = ?",
            [quote_number]
        );

        if (quotationItems.length === 0) {
            return NextResponse.json({ error: "No items found for this quote number" }, { status: 404 });
        }

        const locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";

        let stockResults = [];

        for (const item of quotationItems) {
            const item_code = item.item_code;
            const containsAlphabets = /[a-zA-Z]/.test(item_code);

            if (containsAlphabets) {
                // Case 1: Products
                const query = `
                    SELECT 
                        T1.${locationColumn} AS stock_count,
                        T2.min_qty,
                        T2.item_name
                    FROM product_stock_summary AS T1
                    LEFT JOIN products_list AS T2 ON T1.product_code = T2.item_code
                    WHERE T1.product_code = ?`;

                const [summary] = await conn.execute(query, [item_code]);
                
                if (summary.length > 0) {
                    const result = summary[0];
                    stockResults.push({ 
                        item_code, 
                        item_name: result.item_name, 
                        stock_count: result.stock_count,
                        min_qty: result.min_qty
                    });
                } else {
                    stockResults.push({ item_code, item_name: "N/A", stock_count: 0, min_qty: null });
                }

            } else {
                // Case 2: Spares
                const query = `
                    SELECT 
                        T1.${locationColumn} AS stock_count,
                        T2.min_qty,
                        T2.item_name
                    FROM stock_summary AS T1
                    LEFT JOIN spare_list AS T2 ON T1.spare_id = T2.id
                    WHERE T1.spare_id = ?`;

                const [summary] = await conn.execute(query, [item_code]);

                if (summary.length > 0) {
                    const result = summary[0];
                    stockResults.push({ 
                        item_code, 
                        item_name: result.item_name, 
                        stock_count: result.stock_count,
                        min_qty: result.min_qty
                    });
                } else {
                    stockResults.push({ item_code, item_name: "N/A", stock_count: 0, min_qty: null });
                }
            }
        }

        if (stockResults.length > 0) {
            return NextResponse.json({ stockResults }, { status: 200 });
        } else {
            return NextResponse.json({ stockResults: [], message: "No stock found for this item." }, { status: 200 });
        }
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    } finally {
      console.log("Closing database connection");
      
    }
}