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
  const status = searchParams.get('status') || 'pending';

  const connection = await getDbConnection();

  try {
    let query = `
      SELECT 
        t.task_id, 
        t.taskname, 
        t.createdby, 
        t.taskassignto, 
        (
          SELECT tf.reassign 
          FROM task_followup tf 
          WHERE tf.task_id = t.task_id 
          ORDER BY tf.id DESC 
          LIMIT 1
        ) AS reassign,
        (
          SELECT tf.taskassignto 
          FROM task_followup tf 
          WHERE tf.task_id = t.task_id 
          ORDER BY tf.id ASC 
          LIMIT 1
        ) AS first_assignto,
        t.followed_date, 
        t.next_followup_date, 
        t.status, 
        t.task_completion_date
      FROM 
        task t
      WHERE 
        t.status = ?
      ORDER BY 
        t.task_id DESC
    `;

    const [rows] = await connection.execute(query, [status]);
    console.log('Director tasks query result:', rows.length, 'tasks with status:', status);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks', details: error.message }, { status: 500 });
  }
}
