// Run this script to backfill employee_name in invoices by matching company_name from quotations with buyer_name in invoices
const mysql = require('mysql2/promise');

async function backfillEmployeeNameByCompanyMatch() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dynaclean_crm',
  });
  
  try {
    // Check if employee_name column exists
    try {
      await conn.execute("SELECT employee_name FROM invoices LIMIT 1");
      console.log("employee_name column exists in invoices table");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE invoices ADD COLUMN employee_name VARCHAR(255) NULL DEFAULT NULL AFTER gst_number");
        console.log("Added employee_name column to invoices table");
      } catch (__) {
        console.error("Failed to add employee_name column to invoices table");
        return;
      }
    }

    // First, try to update by quotation_id (most reliable)
    const [resultByQuotationId] = await conn.execute(
      `UPDATE invoices i
       INNER JOIN quotations_records q ON i.quotation_id = q.quote_number
       SET i.employee_name = q.emp_name
       WHERE i.employee_name IS NULL OR i.employee_name = ''`
    );

    console.log(`Updated ${resultByQuotationId.affectedRows} invoices with employee_name by matching quotation_id`);

    // Then, try to update by company_name (for invoices without quotation_id)
    const [resultByCompany] = await conn.execute(
      `UPDATE invoices i
       INNER JOIN quotations_records q ON LOWER(TRIM(q.company_name)) = LOWER(TRIM(i.customer_name))
       SET i.employee_name = q.emp_name
       WHERE i.employee_name IS NULL OR i.employee_name = ''`
    );

    console.log(`Updated ${resultByCompany.affectedRows} invoices with employee_name by matching company_name (case-insensitive)`);

    // Verify the update
    const [verifyResult] = await conn.execute(
      `SELECT i.id, i.invoice_number, i.customer_name as buyer_name, i.employee_name, i.quotation_id,
              q.company_name as quotation_company_name, q.emp_name as quotation_emp_name
       FROM invoices i
       LEFT JOIN quotations_records q ON i.quotation_id = q.quote_number
       WHERE i.employee_name IS NOT NULL
       LIMIT 10`
    );

    console.log("Sample updated invoices:");
    console.log(verifyResult);

  } catch (err) {
    console.error("Error backfilling employee_name by company match:", err);
  } finally {
    await conn.end();
  }
}

// Run the function
backfillEmployeeNameByCompanyMatch();
