import { getDbConnection } from '@/lib/db';
import { verify } from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'your-secret-key';

// GET -  return products fetch 
export async function GET(request) {
  try {
    const pool = await getDbConnection();

    // Check which columns exist in return_products
    const [rpColumns] = await pool.query(`SHOW COLUMNS FROM return_products`);
    const rpColNames = rpColumns.map(col => col.Field);
    const hasRpUpdatedBy = rpColNames.includes('updated_by');

    // Check which columns exist in return_items
    const [riColumns] = await pool.query(`SHOW COLUMNS FROM return_items`);
    const riColNames = riColumns.map(col => col.Field);
    const hasRiUpdatedBy = riColNames.includes('updated_by');
    const hasRiQuotationNo = riColNames.includes('quotation_no');

    // Build main query with explicit columns (avoid rp.* to prevent serialization issues)
    const rpFields = [
      'rp.id', 'rp.quotation_no', 'rp.invoice_no', 'rp.model_no', 'rp.serial_no',
      'rp.pricing_total', 'rp.tracking_no', 'rp.return_type', 'rp.return_status',
      'rp.reason', 'rp.return_image', 'rp.created_by', 'rp.customer_id',
      'rp.created_at', 'rp.updated_at',
      'c.first_name', 'c.last_name', 'c.company',
      'e.username AS created_by_username',
    ];
    if (hasRpUpdatedBy) {
      rpFields.push('rp.updated_by', 'eu.username AS updated_by_username');
    }

    let fromClause = `
      FROM return_products rp
      LEFT JOIN customers c ON rp.customer_id = c.customer_id
      LEFT JOIN rep_list e ON rp.created_by = e.username
    `;
    if (hasRpUpdatedBy) {
      fromClause += '\n      LEFT JOIN rep_list eu ON rp.updated_by = eu.username';
    }

    const query = `SELECT ${rpFields.join(', ')} ${fromClause} ORDER BY rp.created_at DESC`;

    const [rows] = await pool.query(query);

    // Fetch all return items in a single query, then group by return_id
    const returnIds = rows.map(r => r.id);
    let allItems = [];

    if (returnIds.length > 0) {
      const riFields = [
        'ri.id', 'ri.return_id', 'ri.item_code', 'ri.item_name',
        'ri.quantity', 'ri.price_per_unit', 'ri.total_price', 'ri.serial_no',
        'ri.created_at', 'ri.updated_at',
      ];
      if (hasRiQuotationNo) riFields.push('ri.quotation_no');
      if (hasRiUpdatedBy) {
        riFields.push('ri.updated_by', 'ieu.username AS updated_by_username');
      }

      const itemFromClause = hasRiUpdatedBy
        ? 'FROM return_items ri LEFT JOIN rep_list ieu ON ri.updated_by = ieu.username'
        : 'FROM return_items ri';

      const placeholders = returnIds.map(() => '?').join(', ');
      const itemsQuery = `SELECT ${riFields.join(', ')} ${itemFromClause} WHERE ri.return_id IN (${placeholders})`;

      const [itemRows] = await pool.query(itemsQuery, returnIds);
      allItems = itemRows;
    }

    // Group items by return_id and attach to parent rows
    const itemsByReturnId = {};
    for (const item of allItems) {
      const rid = item.return_id;
      if (!itemsByReturnId[rid]) itemsByReturnId[rid] = [];
      itemsByReturnId[rid].push({ ...item });
    }

    // Build plain objects to avoid RowDataPacket serialization issues
    const data = rows.map(row => ({
      ...row,
      items: itemsByReturnId[row.id] || [],
    }));

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching return products:', error);
    return Response.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

// POST - नया return product create करें
export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    let userId = 1;

    if (token) {
      try {
        const decoded = verify(token, SECRET);
        userId = decoded.username || decoded.empId || decoded.id || decoded.userId || decoded.client_index || 1;
      } catch (err) {
        console.error('Token verification failed:', err);
      }
    }

    const body = await request.json();
    const {
      quotation_no,
      invoice_no,
      model_no,
      serial_no,
      pricing_total,
      tracking_no,
      return_type,
      reason,
      customer_id,
      items,
    } = body;

    // Validation
    if (!quotation_no || !invoice_no) {
      return Response.json(
        { success: false, message: 'Required fields missing' },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // First, check if updated_by column exists in return_products
      const [columns] = await connection.query(`
        SHOW COLUMNS FROM return_products LIKE 'updated_by'
      `);
      const hasUpdatedBy = columns.length > 0;

      // Build insert query dynamically based on whether updated_by exists
      let insertFields = [
        'quotation_no',
        'invoice_no',
        'model_no',
        'serial_no',
        'pricing_total',
        'tracking_no',
        'return_type',
        'return_status',
        'reason',
        'created_by',
        'customer_id'
      ];
      let insertValues = [
        quotation_no,
        invoice_no,
        model_no || (items && items.length > 0 ? items.map(i => i.item_code).join(', ') : ''),
        serial_no || (items && items.length > 0 ? items.map(i => i.serial_no || '').join(', ') : ''),
        pricing_total || 0,
        tracking_no || null,
        return_type || 'partial',
        'return_booking',
        reason || null,
        userId,
        customer_id || null
      ];

      if (hasUpdatedBy) {
        insertFields.splice(10, 0, 'updated_by'); // Insert after created_by
        insertValues.splice(10, 0, userId); // Add userId as updated_by
      }

      // Add created_at and updated_at as NOW() directly (not parameters)
      insertFields.push('created_at', 'updated_at');

      const insertQuery = `
        INSERT INTO return_products (
          ${insertFields.join(', ')}
        ) VALUES (${insertValues.map(() => '?').join(', ')}, NOW(), NOW())
      `;

      const [result] = await connection.query(insertQuery, insertValues);

      const returnId = result.insertId;

      // If items are provided, insert them into return_items
      if (items && items.length > 0) {
        // Check which columns exist in return_items
        const [itemColumns] = await connection.query(`
          SHOW COLUMNS FROM return_items
        `);
        const existingColumns = itemColumns.map(col => col.Field);
        const hasQuotationNo = existingColumns.includes('quotation_no');
        const hasUpdatedBy = existingColumns.includes('updated_by');
        const hasUpdatedAt = existingColumns.includes('updated_at');
        const hasCreatedAt = existingColumns.includes('created_at');

        for (const item of items) {
          // Build item insert query dynamically
          let itemFields = ['return_id', 'item_code', 'item_name', 'quantity', 'price_per_unit', 'total_price', 'serial_no'];
          let itemValues = [
            returnId,
            item.item_code,
            item.item_name,
            item.quantity || 1,
            item.price_per_unit || 0,
            item.total_price || ((item.price_per_unit || 0) * (item.quantity || 1)),
            item.serial_no || null
          ];

          if (hasQuotationNo) {
            itemFields.splice(1, 0, 'quotation_no');
            itemValues.splice(1, 0, quotation_no);
          }

          // Add createdAt if it exists (but it should default to NOW())
          // For updated_at and updated_by, we'll add them at the end
          const nowFields = [];
          const nowValues = [];

          if (hasCreatedAt) {
            nowFields.push('created_at');
          }
          if (hasUpdatedAt) {
            nowFields.push('updated_at');
          }
          if (hasUpdatedBy) {
            itemFields.push('updated_by');
            itemValues.push(userId);
          }

          const allItemFields = [...itemFields, ...nowFields];
          const placeholders = [...itemValues.map(() => '?'), ...nowFields.map(() => 'NOW()')];

          const itemInsertQuery = `
            INSERT INTO return_items (
              ${allItemFields.join(', ')}
            ) VALUES (${placeholders.join(', ')})
          `;

          await connection.query(itemInsertQuery, itemValues);
        }
      }

      await connection.commit();

      return Response.json(
        {
          success: true,
          message: 'Return product added successfully',
          data: { id: returnId },
        },
        { status: 201 }
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating return product:', error);
    return Response.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
