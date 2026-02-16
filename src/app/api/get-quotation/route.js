import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const quotationNumber = searchParams.get("quotation_number");

    if (!quotationNumber) {
      return NextResponse.json(
        { success: false, error: "Quotation number is required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();

    // 1️⃣ Fetch quotation record
    // const [quotationRows] = await conn.execute(
    //   `SELECT * FROM quotations_records WHERE quote_number = ? LIMIT 1`,
    //   [quotationNumber],
    // );

    const [quotationRows] = await conn.execute(
      `
  SELECT 
    q.*,
    c.first_name,
    c.email,
    c.phone
  FROM quotations_records q
  LEFT JOIN customers c 
    ON q.customer_id = c.customer_id
  WHERE q.quote_number = ?
  LIMIT 1
  `,
      [quotationNumber],
    );

    if (quotationRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Quotation not found" },
        { status: 404 },
      );
    }

    // amount paid
    // 3️⃣ Fetch total amount paid from neworder table
    //   const [paymentRows] = await conn.execute(
    //     `
    // SELECT
    //   COALESCE(
    //     SUM(
    //       CAST(
    //         SUBSTRING_INDEX(
    //           SUBSTRING_INDEX(payment_amount, ',', numbers.n),
    //           ',', -1
    //         ) AS DECIMAL(10,2)
    //       )
    //     ), 0
    //   ) AS amount_paid
    // FROM neworder
    // JOIN (
    //   SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
    // ) numbers
    // ON CHAR_LENGTH(payment_amount) - CHAR_LENGTH(REPLACE(payment_amount, ',', '')) >= numbers.n - 1
    // WHERE quote_number = ?
    // `,
    //     [quotationNumber],
    //   );

    //   const amountPaid = Number(paymentRows[0]?.amount_paid || 0);

    const [paymentRows] = await conn.execute(
      `
  SELECT 
    COALESCE(
      SUM(
        CAST(
          SUBSTRING_INDEX(
            SUBSTRING_INDEX(payment_amount, ',', numbers.n),
            ',', -1
          ) AS DECIMAL(10,2)
        )
      ), 0
    ) AS amount_paid,
    MAX(duedate) AS duedate
  FROM neworder
  JOIN (
    SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  ) numbers
    ON CHAR_LENGTH(payment_amount) - CHAR_LENGTH(REPLACE(payment_amount, ',', '')) >= numbers.n - 1
  WHERE quote_number = ?
  `,
      [quotationNumber],
    );

    const amountPaid = Number(paymentRows[0]?.amount_paid || 0);
    const dueDate = paymentRows[0]?.duedate || null;
    // console.log("due date :", dueDate);

    // console.log("amount paid by client:", amountPaid);

    const quotation = quotationRows[0];

    // 2️⃣ Fetch quotation items (JOIN BY quote_number)
    const [itemRows] = await conn.execute(
      `SELECT * FROM quotation_items WHERE quote_number = ?`,
      [quotationNumber],
    );

    return NextResponse.json({
      success: true,
      quotation: {
        quotation_id: quotation["S.No."],
        quotation_number: quotation.quote_number,
        quotation_date: quotation.quote_date,

        customer_id: quotation.customer_id || "",
        customer_name: quotation.first_name || quotation.company_name || "",
        customer_email: quotation.email || "",
        customer_contact: quotation.phone || "",

        billing_address: quotation.company_address || "",
        shipping_address: quotation.ship_to || "",

        gst_number: quotation.gstin || "",
        state: quotation.state || "",

        amount_paid: Number(amountPaid),
        due_date: dueDate,

        terms_conditions: quotation.term_con || "",

        items: itemRows.map((item) => ({
          item_name: item.item_name,
          item_code: item.item_code,
          description: item.specification,
          hsn_code: item.hsn_sac,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.price_per_unit,
          discount_percent: 0,
          discount_amount: 0,
          cgst_percent: item.cgsttax,
          sgst_percent: item.sgsttax,
          igst_percent: item.igsttax,
          img_url: item.img_url,
        })),
      },
    });
  } catch (err) {
    console.error("Quotation fetch error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
