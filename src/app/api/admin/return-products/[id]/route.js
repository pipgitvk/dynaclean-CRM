import { getDbConnection } from '@/lib/db';
import { verify } from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';

const SECRET = process.env.JWT_SECRET || 'your-secret-key';

// GET - एक return product fetch करें
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const pool = await getDbConnection();

    // Check which columns exist in return_products
    const [rpColumns] = await pool.query(`SHOW COLUMNS FROM return_products`);
    const rpColNames = rpColumns.map(col => col.Field);
    const hasRpUpdatedBy = rpColNames.includes('updated_by');

    // Check which columns exist in return_items
    const [riColumns] = await pool.query(`SHOW COLUMNS FROM return_items`);
    const riColNames = riColumns.map(col => col.Field);
    const hasRiUpdatedBy = riColNames.includes('updated_by');

    // Build main query dynamically
    let selectFields = ['rp.*', 'c.first_name', 'c.last_name', 'c.company', 'e.username AS created_by_username'];
    let fromClause = `
      FROM return_products rp
      LEFT JOIN customers c ON rp.customer_id = c.customer_id
      LEFT JOIN rep_list e ON rp.created_by = e.username
    `;
    
    if (hasRpUpdatedBy) {
      selectFields.push('eu.username AS updated_by_username');
      fromClause += 'LEFT JOIN rep_list eu ON rp.updated_by = eu.username';
    }

    const query = `
      SELECT 
        ${selectFields.join(', ')}
      ${fromClause}
      WHERE rp.id = ?
    `;

    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return Response.json(
        { success: false, message: 'Return product not found' },
        { status: 404 }
      );
    }

    // Fetch return items with employee names
    let itemSelectFields = ['ri.*'];
    let itemFromClause = 'FROM return_items ri';
    let itemJoinClause = '';

    if (hasRiUpdatedBy) {
      itemSelectFields.push('eu.username AS updated_by_username');
      itemJoinClause = 'LEFT JOIN rep_list eu ON ri.updated_by = eu.username';
    }

    const itemsQuery = `
      SELECT 
        ${itemSelectFields.join(', ')}
      ${itemFromClause}
      ${itemJoinClause}
      WHERE ri.return_id = ?
    `;

    const [items] = await pool.query(itemsQuery, [id]);
    rows[0].items = items;

    return Response.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error fetching return product:', error);
    return Response.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

// PUT - return product update करें (सिर्फ status, tracking_no, notes, reason, return_image)
export async function PUT(request, { params }) {
  try {
    const { id } = await params;

    // Get user ID from token first
    const token = request.headers.get('authorization')?.split(' ')[1];
    let userId = 1;
    let username = 'system';
    if (token) {
      try {
        const decoded = verify(token, SECRET);
        userId = decoded.username || decoded.empId || decoded.id || decoded.userId || decoded.client_index || 1;
        username = decoded.username || 'system';
      } catch (err) {
        console.error('Token verification failed:', err);
      }
    }

    let body = {};
    let returnImagePath = null;

    // Check content type to decide if it's FormData or JSON
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {
        return_status: formData.get('return_status'),
        tracking_no: formData.get('tracking_no'),
        notes: formData.get('notes'),
        reason: formData.get('reason'),
        godown: formData.get('godown'),
      };
      const file = formData.get('return_image');
      if (file && file.size > 0) {
        const UPLOAD_DIR = path.join(process.cwd(), 'public', 'ADMIN', 'RETURN_PRODUCTS');
        try { await fs.access(UPLOAD_DIR); } catch { await fs.mkdir(UPLOAD_DIR, { recursive: true }); }
        const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
        returnImagePath = `/ADMIN/RETURN_PRODUCTS/${filename}`;
      }
    } else {
      body = await request.json();
    }

    const { return_status, tracking_no, notes, reason, godown } = body;

    const pool = await getDbConnection();

    // Check if exists — fetch full record for stock reversal later
    const [existing] = await pool.query(
      'SELECT * FROM return_products WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return Response.json(
        { success: false, message: 'Return product not found' },
        { status: 404 }
      );
    }

    const returnRecord = existing[0];
    const previousStatus = returnRecord.return_status;

    // Check which columns exist in return_products
    const [rpColumns] = await pool.query(`SHOW COLUMNS FROM return_products`);
    const rpColNames = rpColumns.map(col => col.Field);
    const hasRpUpdatedBy = rpColNames.includes('updated_by');
    const hasRpReturnImage = rpColNames.includes('return_image');
    const hasRpNotes = rpColNames.includes('notes');
    const hasRpTrackingNo = rpColNames.includes('tracking_no');
    const hasRpReason = rpColNames.includes('reason');
    const hasRpReturnStatus = rpColNames.includes('return_status');

    // Build update query
    let updateFields = [];
    let updateValues = [];

    if (return_status && hasRpReturnStatus) {
      updateFields.push('return_status = ?');
      updateValues.push(return_status);
    }
    if (tracking_no !== undefined && hasRpTrackingNo) {
      updateFields.push('tracking_no = ?');
      updateValues.push(tracking_no);
    }
    if (notes !== undefined && hasRpNotes) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    if (reason !== undefined && hasRpReason) {
      updateFields.push('reason = ?');
      updateValues.push(reason);
    }
    if (returnImagePath && hasRpReturnImage) {
      updateFields.push('return_image = ?');
      updateValues.push(returnImagePath);
    }

    if (updateFields.length === 0) {
      return Response.json({
        success: true,
        message: 'No changes to update',
      });
    }

    updateFields.push('updated_at = NOW()');
    if (hasRpUpdatedBy) {
      updateFields.push('updated_by = ?');
      updateValues.push(userId);
    }
    
    const updateQuery = `UPDATE return_products SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(id);

    await pool.query(updateQuery, updateValues);

    // Check if updated_by column exists in return_items
    const [riColumns] = await pool.query(`SHOW COLUMNS FROM return_items`);
    const riColNames = riColumns.map(col => col.Field);
    const hasRiUpdatedBy = riColNames.includes('updated_by');
    const hasRiUpdatedAt = riColNames.includes('updated_at');

    if (hasRiUpdatedBy || hasRiUpdatedAt) {
      let riUpdateFields = [];
      let riUpdateValues = [];
      
      if (hasRiUpdatedAt) {
        riUpdateFields.push('updated_at = NOW()');
      }
      if (hasRiUpdatedBy) {
        riUpdateFields.push('updated_by = ?');
        riUpdateValues.push(userId);
      }
      
      if (riUpdateFields.length > 0) {
        const riUpdateQuery = `UPDATE return_items SET ${riUpdateFields.join(', ')} WHERE return_id = ?`;
        riUpdateValues.push(id);
        
        await pool.query(riUpdateQuery, riUpdateValues);
      }
    }

    // ── STOCK REVERSAL: jab status 'completed' ho (Warehouse In) ──────────────
    if (return_status === 'delivered_in_warehouse' && previousStatus !== 'delivered_in_warehouse') {
      const [items] = await pool.query('SELECT * FROM return_items WHERE return_id = ?', [id]);
      const targetGodown = godown || 'Delhi - Mundka';
      const locationColumn = targetGodown === 'Delhi - Mundka' ? 'Delhi' : 'South';

      for (const item of items) {
        const itemCode = item.item_code;
        const qty = Number(item.quantity) || 1;
        const isProduct = /[a-zA-Z]/.test(itemCode);

        if (isProduct) {
          const [lastRows] = await pool.query(
            `SELECT total, delhi, south FROM product_stock WHERE product_code = ? ORDER BY created_at DESC LIMIT 1`,
            [itemCode]
          );
          let totalDB = 0, delhiDB = 0, southDB = 0;
          if (lastRows.length > 0) {
            totalDB = Number(lastRows[0].total) || 0;
            delhiDB = Number(lastRows[0].delhi) || 0;
            southDB = Number(lastRows[0].south) || 0;
          }
          const delhiD = targetGodown === 'Delhi - Mundka' ? delhiDB + qty : delhiDB;
          const southD = targetGodown === 'Delhi - Mundka' ? southDB : southDB + qty;
          const totalD = totalDB + qty;

          await pool.query(
            `INSERT INTO product_stock
              (product_code, quantity, amount_per_unit, net_amount, note, location, stock_status,
               gst, hs_code, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
             VALUES (?, ?, NULL, NULL, ?, ?, 'IN', NULL, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
            [itemCode, qty, `Return Warehouse In (Return #${id})`, targetGodown,
             returnRecord.model_no || null, returnRecord.model_no || null,
             returnRecord.quotation_no || null, username, targetGodown, totalD, delhiD, southD]
          );

          const [summary] = await pool.query(
            `SELECT total_quantity, ${locationColumn} FROM product_stock_summary WHERE product_code = ?`,
            [itemCode]
          );
          if (summary.length > 0) {
            await pool.query(
              `UPDATE product_stock_summary SET last_updated_quantity = ?, total_quantity = ?, last_status = 'IN', updated_at = NOW(), ${locationColumn} = ? WHERE product_code = ?`,
              [qty, (Number(summary[0].total_quantity) || 0) + qty, (Number(summary[0][locationColumn]) || 0) + qty, itemCode]
            );
          } else {
            await pool.query(
              `INSERT INTO product_stock_summary (product_code, last_updated_quantity, total_quantity, Delhi, South, last_status) VALUES (?, ?, ?, ?, ?, 'IN')`,
              [itemCode, qty, qty, targetGodown === 'Delhi - Mundka' ? qty : 0, targetGodown === 'Delhi - Mundka' ? 0 : qty]
            );
          }
        } else {
          const [lastRows] = await pool.query(
            `SELECT total, delhi, south FROM stock_list WHERE spare_id = ? ORDER BY created_at DESC LIMIT 1`,
            [itemCode]
          );
          let totalDB = 0, delhiDB = 0, southDB = 0;
          if (lastRows.length > 0) {
            totalDB = Number(lastRows[0].total) || 0;
            delhiDB = Number(lastRows[0].delhi) || 0;
            southDB = Number(lastRows[0].south) || 0;
          }
          const delhiD = targetGodown === 'Delhi - Mundka' ? delhiDB + qty : delhiDB;
          const southD = targetGodown === 'Delhi - Mundka' ? southDB : southDB + qty;
          const totalD = totalDB + qty;

          await pool.query(
            `INSERT INTO stock_list
              (spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status,
               to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
             VALUES (?, ?, NULL, NULL, ?, ?, 'IN', ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
            [itemCode, qty, `Return Warehouse In (Return #${id})`, targetGodown,
             returnRecord.model_no || null, returnRecord.model_no || null,
             returnRecord.quotation_no || null, username, targetGodown, totalD, delhiD, southD]
          );

          const [summary] = await pool.query(
            `SELECT total_quantity, ${locationColumn} FROM stock_summary WHERE spare_id = ?`,
            [itemCode]
          );
          if (summary.length > 0) {
            await pool.query(
              `UPDATE stock_summary SET last_updated_quantity = ?, total_quantity = ?, last_status = 'IN', updated_at = NOW(), ${locationColumn} = ? WHERE spare_id = ?`,
              [qty, (Number(summary[0].total_quantity) || 0) + qty, (Number(summary[0][locationColumn]) || 0) + qty, itemCode]
            );
          } else {
            await pool.query(
              `INSERT INTO stock_summary (spare_id, last_updated_quantity, total_quantity, Delhi, South, last_status) VALUES (?, ?, ?, ?, ?, 'IN')`,
              [itemCode, qty, qty, targetGodown === 'Delhi - Mundka' ? qty : 0, targetGodown === 'Delhi - Mundka' ? 0 : qty]
            );
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return Response.json({
      success: true,
      message: 'Return product updated successfully',
    });
  } catch (error) {
    console.error('Error updating return product:', error);
    return Response.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - return product delete करें
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const pool = await getDbConnection();

    // Check if exists
    const [existing] = await pool.query(
      'SELECT id FROM return_products WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return Response.json(
        { success: false, message: 'Return product not found' },
        { status: 404 }
      );
    }

    await pool.query('DELETE FROM return_products WHERE id = ?', [id]);

    return Response.json({
      success: true,
      message: 'Return product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting return product:', error);
    return Response.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
