import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

// GET duplicate leads (leads that exist in both meta_leads and customers)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const skip = parseInt(searchParams.get('skip')) || 0;

    const conn = await getDbConnection();

    // Get leads that exist in both meta_leads and customers tables
    const query = `
      SELECT ml.*, c.customer_id as crm_customer_id
      FROM meta_leads ml
      INNER JOIN customers c ON JSON_UNQUOTE(JSON_EXTRACT(ml.lead_data, '$.phone_number')) IS NOT NULL
      AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(ml.lead_data, '$.phone_number')), ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10) = RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10)
      WHERE ml.is_imported_to_crm = 0
      ORDER BY ml.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await conn.execute(query, [limit, skip]);

    // Get total count
    const [countRows] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM meta_leads ml
      INNER JOIN customers c ON JSON_UNQUOTE(JSON_EXTRACT(ml.lead_data, '$.phone_number')) IS NOT NULL
      AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(ml.lead_data, '$.phone_number')), ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10) = RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10)
      WHERE ml.is_imported_to_crm = 0
    `);

    const total = countRows[0].count;

    const leads = rows.map(row => ({
      ...row,
      leadData: JSON.parse(row.lead_data),
      fieldData: JSON.parse(row.field_data || '[]'),
      isImportedToCRM: Boolean(row.is_imported_to_crm),
      _id: row.id.toString()
    }));

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + leads.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching duplicate leads:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
