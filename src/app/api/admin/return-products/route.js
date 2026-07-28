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
      company_name,
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

      // ── 1. Ledger entry create (company_name 1st priority) ──
      try {
        // Ensure ledger_entries table exists
        try {
          await connection.query(`
            CREATE TABLE IF NOT EXISTS ledger_entries (
              id INT AUTO_INCREMENT PRIMARY KEY,
              entry_date DATE NOT NULL,
              particulars VARCHAR(255) NOT NULL,
              vch_type VARCHAR(50) DEFAULT NULL,
              vch_no VARCHAR(100) DEFAULT NULL,
              debit DECIMAL(15,2) DEFAULT 0.00,
              credit DECIMAL(15,2) DEFAULT 0.00,
              buyer_name VARCHAR(255) DEFAULT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_ledger_buyer (buyer_name),
              INDEX idx_ledger_entry_date (entry_date),
              INDEX idx_ledger_vch (vch_type, vch_no)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
          `);
        } catch (ce) { /* ignore already exists */ }

        try {
          await connection.query(`
            ALTER TABLE ledger_entries
            ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255) DEFAULT NULL
          `);
        } catch (ae) { /* ignore already exists */ }

        // Resolve buyer_name — company_name 1st priority
        let buyerName = null;
        if (company_name && String(company_name).trim()) {
          buyerName = String(company_name).trim();
        }
        if (!buyerName && invoice_no) {
          try {
            const trimmedInv = String(invoice_no).trim();
            const [invRows] = await connection.query(
              `SELECT customer_name, grand_total FROM invoices WHERE TRIM(invoice_number) = ? LIMIT 1`,
              [trimmedInv]
            );
            if (invRows.length > 0 && invRows[0].customer_name) {
              buyerName = invRows[0].customer_name;
            }
          } catch (errInv) { console.warn('invoice lookup:', errInv.message); }
        }
        if (!buyerName && quotation_no) {
          try {
            const trimmedQ = String(quotation_no).trim();
            const [qRows] = await connection.query(
              `SELECT qr.buyer_name
               FROM quotations_records qr
               WHERE TRIM(qr.quote_number) = ? LIMIT 1`,
              [trimmedQ]
            );
            if (qRows.length > 0 && qRows[0].buyer_name) {
              buyerName = qRows[0].buyer_name;
            }
          } catch (errQ) { console.warn('quotation lookup:', errQ.message); }
        }
        if (!buyerName && customer_id) {
          try {
            const [custRows] = await connection.query(
              `SELECT company FROM customers WHERE id = ? LIMIT 1`,
              [customer_id]
            );
            if (custRows.length > 0 && custRows[0].company) {
              buyerName = custRows[0].company;
            }
          } catch (errCust) { console.warn('customer lookup:', errCust.message); }
        }

        if (buyerName) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const isFull = return_type === 'full';
          const invNoTrim = String(invoice_no || quotation_no || '').trim();
          const particulars = `Return (${isFull ? 'Full' : 'Partial'})` + (invNoTrim ? ` – ${invNoTrim}` : '');
          const creditAmt = Number(pricing_total || 0);

          await connection.query(
            `INSERT INTO ledger_entries (entry_date, particulars, vch_type, vch_no, debit, credit, buyer_name, created_at, updated_at)
             VALUES (?, ?, 'Return', ?, 0, ?, ?, NOW(), NOW())`,
            [todayStr, particulars, invNoTrim || null, creditAmt, buyerName]
          );
        }
      } catch (ledgerErr) {
        console.warn('[return-products] ledger entry skipped:', ledgerErr.message);
      }

      // ── 2. Same sync as installation/action: neworder, dispatch, invoices, order_return_items ──
      try {
        const trimmedQ = String(quotation_no || '').trim();
        const trimmedInv = String(invoice_no || '').trim();
        const isFull = return_type === 'full';

        // Resolve order_id from neworder
        let orderIdForReturn = null;
        if (trimmedQ) {
          try {
            const [ord] = await connection.query(
              `SELECT order_id FROM neworder WHERE TRIM(quote_number) = ? LIMIT 1`,
              [trimmedQ]
            );
            if (ord.length > 0) orderIdForReturn = ord[0].order_id;
          } catch (e) { /* ignore */ }
        }
        if (!orderIdForReturn && trimmedInv) {
          try {
            const [ord2] = await connection.query(
              `SELECT order_id FROM neworder WHERE TRIM(invoice_number) = ? LIMIT 1`,
              [trimmedInv]
            );
            if (ord2.length > 0) orderIdForReturn = ord2[0].order_id;
          } catch (e) { /* ignore */ }
        }

        if (orderIdForReturn) {
          // ── 2a. UPDATE neworder ──
          try {
            await connection.query(
              `UPDATE neworder SET installation_status = 0, is_returned = ? WHERE order_id = ?`,
              [isFull ? 1 : 2, orderIdForReturn]
            );
          } catch (e) { console.warn('neworder update:', e.message); }

          // ── 2b. UPDATE invoices returned_date + returned_status ──
          if (trimmedQ) {
            try {
              const [qDt] = await connection.query(
                `SELECT \`S.No.\` as quotation_id FROM quotations_records WHERE TRIM(quote_number) = ? LIMIT 1`,
                [trimmedQ]
              );
              if (qDt.length > 0) {
                const qid = qDt[0].quotation_id;
                await connection.query(
                  `UPDATE invoices SET returned_date = NOW(), returned_status = ? WHERE quotation_id = ?`,
                  [isFull ? 'full' : 'partial', qid]
                );
              }
            } catch (e) { console.warn('invoices update:', e.message); }
          }

          // ── 2c. UPDATE dispatch rows (stock_deducted=0 + returned_date) + order_return_items ──
          if (trimmedQ) {
            if (isFull) {
              try {
                await connection.query(
                  `UPDATE dispatch SET stock_deducted = 0, returned_date = NOW(), updated_at = NOW()
                   WHERE TRIM(quote_number) = ? AND stock_deducted = 1`,
                  [trimmedQ]
                );
              } catch (e) { console.warn('dispatch full update:', e.message); }
            } else if (items && items.length > 0) {
              for (const itm of items) {
                try {
                  const ic = String(itm.item_code || '').trim();
                  if (!ic) continue;
                  const [match] = await connection.query(
                    `SELECT id, godown FROM dispatch WHERE TRIM(quote_number) = ? AND TRIM(item_code) = ? AND stock_deducted = 1 LIMIT 1`,
                    [trimmedQ, ic]
                  );
                  if (match.length > 0) {
                    const did = match[0].id;
                    const gd = match[0].godown || '';
                    await connection.query(
                      `UPDATE dispatch SET stock_deducted = 0, returned_date = NOW(), updated_at = NOW() WHERE id = ?`,
                      [did]
                    );
                    // order_return_items insert (stock_reversed=0 since actual reversal happens later at warehouse-in PUT step)
                    try {
                      await connection.query(
                        `INSERT INTO order_return_items
                         (order_id, dispatch_id, item_code, item_name, quantity_returned, return_reason, returned_by, godown, stock_reversed, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
                        [
                          orderIdForReturn,
                          did,
                          ic,
                          itm.item_name || null,
                          Number(itm.quantity || 1),
                          reason || null,
                          userId,
                          gd
                        ]
                      );
                    } catch (ori) { console.warn('order_return_items insert:', ori.message); }
                  }
                } catch (e) { console.warn('dispatch partial item skip:', e.message); }
              }
            }
          }
        }
      } catch (syncErr) {
        console.warn('[return-products] installation-style sync skipped:', syncErr.message);
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
