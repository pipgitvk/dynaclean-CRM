import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { getSessionPayload } from '@/lib/auth';

export async function GET(request) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (payload?.role || '').toUpperCase();
  if (role !== 'DIRECTOR' && role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // YYYY-MM format

  if (!month) {
    return NextResponse.json({ error: 'Month parameter required' }, { status: 400 });
  }

  const connection = await getDbConnection();

  try {
    // Calculate date range for the selected month
    const startDate = `${month}-01`;
    const [year, monthNum] = month.split('-');
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${lastDay}`;

    // Fetch employee expenses with breakdown
    const [rows] = await connection.execute(
      `SELECT 
        e.username as employeeName,
        SUM(exp.amount) as amount,
        SUM(CASE WHEN exp.paid = 1 THEN exp.amount ELSE 0 END) as paid,
        SUM(CASE WHEN exp.paid = 0 THEN exp.amount ELSE 0 END) as remaining
      FROM expenses exp
      JOIN rep_list e ON exp.username = e.username
      WHERE DATE(exp.created_at) BETWEEN ? AND ?
      GROUP BY e.username
      ORDER BY amount DESC`,
      [startDate, endDate]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching expenses breakdown:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses breakdown' }, { status: 500 });
  }
}
