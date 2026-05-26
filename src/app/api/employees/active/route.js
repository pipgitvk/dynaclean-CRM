import { NextResponse } from 'next/server';
const { getDbConnection } = require('@/lib/db');

// GET active employees from rep_list
export async function GET(request) {
  try {
    const conn = await getDbConnection();
    
    const [rows] = await conn.execute(
      `SELECT username, empId FROM rep_list WHERE status = 1 ORDER BY username ASC`
    );
    
    return NextResponse.json({ 
      success: true, 
      data: rows.map(row => ({
        username: row.username,
        empId: row.empId,
        name: row.username
      }))
    });
  } catch (error) {
    console.error('Error fetching active employees:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
