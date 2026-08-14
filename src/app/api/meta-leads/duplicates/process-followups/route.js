import { NextResponse } from 'next/server';
const { processHistoricalDuplicateFollowups } = require('@/lib/services/metaDuplicateLeadHandler');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate } = body || {};

    const result = await processHistoricalDuplicateFollowups({ startDate, endDate });

    return NextResponse.json({
      success: true,
      message: `Updated follow-up dates for ${result.processed} duplicate lead(s)`,
      data: result,
    });
  } catch (error) {
    console.error('Error processing duplicate follow-ups:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
