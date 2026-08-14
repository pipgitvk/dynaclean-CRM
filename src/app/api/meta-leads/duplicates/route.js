import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

const CUSTOMER_PHONE_LAST10 = `
  RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10)
`;

const META_LEAD_PHONE_EXPR = `
  COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ml.lead_data, '$.phone')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ml.lead_data, '$.phone_number')), '')
  )
`;

const META_LEAD_PHONE_LAST10 = `
  RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${META_LEAD_PHONE_EXPR}, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10)
`;

const DUPLICATE_JOIN = `${META_LEAD_PHONE_LAST10} = ${CUSTOMER_PHONE_LAST10}`;

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function parseLeadRow(row) {
  let leadData = {};
  let fieldData = [];

  try {
    leadData = typeof row.lead_data === 'string' ? JSON.parse(row.lead_data) : row.lead_data || {};
  } catch {
    leadData = {};
  }

  try {
    fieldData = typeof row.field_data === 'string' ? JSON.parse(row.field_data || '[]') : row.field_data || [];
  } catch {
    fieldData = [];
  }

  const crmAssignee =
    row.crm_lead_source && row.crm_lead_source !== 'Automatic'
      ? row.crm_lead_source
      : row.crm_sales_rep || row.crm_lead_source || '-';

  return {
    id: row.id,
    leadgen_id: row.leadgen_id,
    leadgenId: row.leadgen_id,
    assigned_to: row.assigned_to || '-',
    assignedTo: row.assigned_to || '-',
    employee_name: row.employee_name || '-',
    employeeName: row.employee_name || '-',
    form_id: row.form_id,
    formId: row.form_id,
    page_id: row.page_id,
    pageId: row.page_id,
    products_interest: row.products_interest || leadData.products_interest || '-',
    productsInterest: row.products_interest || leadData.products_interest || '-',
    created_at: row.created_at,
    createdAt: row.created_at,
    lead_data: row.lead_data,
    leadData,
    fieldData,
    isImportedToCRM: Boolean(row.is_imported_to_crm),
    crm_customer_id: row.crm_customer_id,
    crmCustomerId: row.crm_customer_id,
    crmAssignee,
    crmLeadSource: row.crm_lead_source || '-',
    crmSalesRep: row.crm_sales_rep || '-',
    crmStatus: row.crm_status || '-',
    crmProductsInterest: row.crm_products_interest || '-',
    crmName: row.crm_first_name || leadData.first_name || '-',
    crmPhone: row.crm_phone || leadData.phone || '-',
    assigneeStatus:
      row.assignee_status === 1 ? 'Active' : row.assignee_status === 0 ? 'Inactive' : 'Unknown',
    _id: String(row.id),
  };
}

// GET duplicate leads with assignment details (meta + CRM)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit'), 10) || 50, 200);
    const skip = parseInt(searchParams.get('skip'), 10) || 0;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const conn = await getDbConnection();

    const whereParts = [
      'ml.is_imported_to_crm = 0',
      `${META_LEAD_PHONE_EXPR} IS NOT NULL`,
      `${META_LEAD_PHONE_EXPR} != ''`,
    ];
    const queryParams = [];

    if (isValidDateString(startDate)) {
      whereParts.push('DATE(ml.created_at) >= ?');
      queryParams.push(startDate);
    }
    if (isValidDateString(endDate)) {
      whereParts.push('DATE(ml.created_at) <= ?');
      queryParams.push(endDate);
    }

    const whereClause = whereParts.join(' AND ');

    const baseFrom = `
      FROM meta_leads ml
      INNER JOIN customers c ON ${DUPLICATE_JOIN}
      LEFT JOIN rep_list rep ON rep.username = ml.assigned_to
      WHERE ${whereClause}
    `;

    const [rows] = await conn.execute(
      `SELECT
        ml.id,
        ml.leadgen_id,
        ml.assigned_to,
        ml.employee_name,
        ml.form_id,
        ml.page_id,
        ml.products_interest,
        ml.created_at,
        ml.lead_data,
        ml.field_data,
        ml.is_imported_to_crm,
        c.customer_id AS crm_customer_id,
        c.lead_source AS crm_lead_source,
        c.sales_representative AS crm_sales_rep,
        c.status AS crm_status,
        c.products_interest AS crm_products_interest,
        c.first_name AS crm_first_name,
        c.phone AS crm_phone,
        rep.status AS assignee_status
      ${baseFrom}
      ORDER BY ml.created_at DESC
      LIMIT ? OFFSET ?`,
      [...queryParams, limit, skip]
    );

    const [countRows] = await conn.execute(`SELECT COUNT(*) AS count ${baseFrom}`, queryParams);
    const total = countRows[0]?.count || 0;

    return NextResponse.json({
      success: true,
      data: rows.map(parseLeadRow),
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + rows.length < total,
      },
      filters: {
        startDate: isValidDateString(startDate) ? startDate : null,
        endDate: isValidDateString(endDate) ? endDate : null,
      },
    });
  } catch (error) {
    console.error('Error fetching duplicate leads:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
