import { NextResponse } from "next/server";
import { getSessionPayload } from "../../../lib/auth";
import mysql from "mysql2/promise";

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// GET - Fetch all terms and conditions
export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
      SELECT 
        id,
        title,
        terms_text,
        applicable_for,
        created_at,
        updated_at
      FROM terms_conditions 
      ORDER BY updated_at DESC
    `);

    await connection.end();

    return NextResponse.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error("Error fetching terms and conditions:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
}

// POST - Create new terms and conditions
export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { title, terms, applicable } = await request.json();

    if (!title || !terms) {
      return NextResponse.json({
        success: false,
        error: "Title and terms are required"
      }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      INSERT INTO terms_conditions (title, terms_text, applicable_for, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `, [title, terms, JSON.stringify(applicable || {})]);

    await connection.end();

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertId,
        title,
        terms_text: terms,
        applicable_for: applicable
      }
    });

  } catch (error) {
    console.error("Error creating terms and conditions:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
}

// PUT - Update existing terms and conditions
export async function PUT(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id, title, terms, applicable } = await request.json();

    if (!id || !title || !terms) {
      return NextResponse.json({
        success: false,
        error: "ID, title and terms are required"
      }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      UPDATE terms_conditions 
      SET title = ?, terms_text = ?, applicable_for = ?, updated_at = NOW()
      WHERE id = ?
    `, [title, terms, JSON.stringify(applicable || {}), id]);

    await connection.end();

    if (result.affectedRows === 0) {
      return NextResponse.json({
        success: false,
        error: "Terms and conditions not found"
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        title,
        terms_text: terms,
        applicable_for: applicable
      }
    });

  } catch (error) {
    console.error("Error updating terms and conditions:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
}

// DELETE - Delete terms and conditions
export async function DELETE(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: "ID is required"
      }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      DELETE FROM terms_conditions WHERE id = ?
    `, [id]);

    await connection.end();

    if (result.affectedRows === 0) {
      return NextResponse.json({
        success: false,
        error: "Terms and conditions not found"
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Terms and conditions deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting terms and conditions:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
}