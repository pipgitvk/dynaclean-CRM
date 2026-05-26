import { NextResponse } from 'next/server';
import { getSyncLogsWithCredentialInfo } from '@/lib/mysql/metaSyncLogModel';

// GET sync logs
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get('credentialId');
    const limit = parseInt(searchParams.get('limit'));
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const filters = {};
    if (credentialId) filters.credentialId = credentialId;
    if (limit) filters.limit = limit;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const logs = await getSyncLogsWithCredentialInfo(filters);
    
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
